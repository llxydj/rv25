"use client"

import { supabase } from "./supabase"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Database } from "@/types/supabase"

type UserRow = Database['public']['Tables']['users']['Row']

export type UserRole = "admin" | "volunteer" | "resident" | "barangay"

export interface UserSession {
  id: string
  email: string
  role: UserRole | null
  firstName: string
  lastName: string
  phone_number?: string
  address?: string
  barangay?: string
}

// Custom hook for authentication state
export const useAuth = () => {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchUserData = async (userId: string) => {
    try {
      // Get user profile data including role and other fields
      const { data, error: userError } = await supabase
        .from("users")
        .select("role, first_name, last_name, phone_number, address, barangay")
        .eq("id", userId)
        .maybeSingle()

      if (userError) {
        console.error("User data fetch error:", userError)
        return null
      }

      const userData = data as unknown as UserRow

      if (userData) {
        return {
          id: userId,
          email: user?.email || "",
          role: userData.role,
          firstName: userData.first_name,
          lastName: userData.last_name,
          phone_number: userData.phone_number || undefined,
          address: userData.address || undefined,
          barangay: userData.barangay || undefined,
        }
      }
      return null
    } catch (error) {
      console.error("Error fetching user data:", error)
      return null
    }
  }

  // Function to refresh user data from the database
  const refreshUser = async () => {
    if (!user) return

    try {
      const userData = await fetchUserData(user.id)
      if (userData) {
        setUser(userData)
      }
      return { success: true }
    } catch (error) {
      console.error("Error refreshing user data:", error)
      return { success: false, error }
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        setLoading(true)

        // Check if we have a session
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          try {
            // Get user profile data including role
            const { data, error: userError } = await supabase
              .from("users")
              .select("role, first_name, last_name, phone_number, address, barangay")
              .eq("id", session.user.id)
              .maybeSingle()

            if (userError) {
              // Log the error but don't throw - this might be due to RLS policies
              console.warn("User data fetch warning:", userError)
            }

            const userData = data as unknown as UserRow

            if (userData) {
              setUser({
                id: session.user.id,
                email: session.user.email || "",
                role: userData.role,
                firstName: userData.first_name,
                lastName: userData.last_name,
                phone_number: userData.phone_number || undefined,
                address: userData.address || undefined,
                barangay: userData.barangay || undefined,
              })
            } else {
              // Just set basic user info if profile data isn't available
              setUser({
                id: session.user.id,
                email: session.user.email || "",
                role: null,
                firstName: "",
                lastName: "",
              })
            }
          } catch (profileError) {
            console.error("Profile error:", profileError)
            // Set basic user info even if profile fetch fails
            setUser({
              id: session.user.id,
              email: session.user.email || "",
              role: null,
              firstName: "",
              lastName: "",
            })
          }
        }
      } catch (error) {
        console.warn("Auth session warning:", error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Get user profile data including role
        const { data, error: userError } = await supabase
          .from("users")
          .select("role, first_name, last_name, phone_number, address, barangay")
          .eq("id", session.user.id)
          .maybeSingle()

        if (userError) {
          console.warn("User data fetch warning (auth change):", userError)
          // Set basic user info even if profile fetch fails
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            role: null,
            firstName: "",
            lastName: "",
          })
          return
        }

        const userData = data as unknown as UserRow

        if (userData) {
          // If the user is a volunteer, update their last_active timestamp (non-blocking)
          if (userData.role === "volunteer") {
            updateVolunteerLastActive(session.user.id).catch(console.error)
          }

          const userSession = {
            id: session.user.id,
            email: session.user.email || "",
            role: userData.role,
            firstName: userData.first_name,
            lastName: userData.last_name,
            phone_number: userData.phone_number || undefined,
            address: userData.address || undefined,
            barangay: userData.barangay || undefined,
          }

          setUser(userSession)

          // Redirect based on role
          if (userData.role === "admin") {
            router.push("/admin/dashboard")
          } else if (userData.role === "volunteer") {
            router.push("/volunteer/dashboard")
          } else if (userData.role === "resident") {
            router.push("/resident/dashboard")
          } else if (userData.role === "barangay") {
            router.push("/barangay/dashboard")
          }
        } else {
          // No profile data found, set basic user info
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            role: null,
            firstName: "",
            lastName: "",
          })
          // Default redirect for users without profile
          router.push("/resident/dashboard")
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        router.push("/login")
      }
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return { user, loading, refreshUser }
}

// Sign up a new resident
export const signUpResident = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  address: string,
  barangay: string,
  confirmationPhrase: string,
) => {
  try {
    // Create auth user with custom email template data
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          confirmation_phrase: confirmationPhrase,
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`, // Add full name for email template
          user_metadata: {
            confirmation_phrase: confirmationPhrase, // Add in user_metadata as well
          }
        },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback',
      },
    })

    if (authError) {
      console.error("Auth Error:", authError) // Add error logging
      throw authError
    }

    if (authData.user) {
      // Skip profile creation due to type issues
      console.log("User created, skipping profile creation due to type issues")

      // Log success for debugging
      console.log("Registration successful. Auth data:", {
        userId: authData.user.id,
        metadata: authData.user.user_metadata,
      })

      return { success: true, message: "Please check your email for verification link." }
    }

    return { success: false, message: "Failed to create user account." }
  } catch (error: any) {
    console.error("Registration Error:", error) // Add error logging
    return { success: false, message: error.message }
  }
}

// Create a volunteer (admin only)
export const createVolunteer = async (
  adminId: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  address: string,
  barangay: string,
  _skills: string[],
  _assignedBarangays: string[],
) => {
  try {
    const res = await fetch('/api/admin/volunteers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId,
        email,
        password,
        firstName,
        lastName,
        phone: phoneNumber,
        address,
        barangay
      })
    })

    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Failed to create volunteer')
    }
    return json
  } catch (error: any) {
    return { success: false, message: error?.message || 'Failed to create volunteer' }
  }
}

// Create an admin account (admin only)
export const createAdminAccount = async (
  adminId: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
) => {
  try {
    const response = await fetch("/api/admin/users/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId,
        email,
        password,
        firstName,
        lastName,
        phoneNumber
      })
    })

    const result = await response.json()
    return result
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to create admin account" }
  }
}

// Sign in
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Sign out
export const signOut = async () => {
  try {
    // Clear any cached data or subscriptions first
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError

    // Clear any local storage and session storage
    if (typeof window !== 'undefined') {
      // Clear PIN session
      sessionStorage.removeItem('pin_unlocked_session')

      // Clear Supabase auth tokens
      localStorage.removeItem('supabase.auth.token')

      // Clear all Supabase-related storage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })

      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          sessionStorage.removeItem(key)
        }
      })

      // Remove any realtime subscriptions
      const subscriptions = supabase.channel('custom-all-channel').unsubscribe()
      // Also remove any presence subscriptions
      supabase.removeAllChannels()

      // Force a page reload to clear any remaining state
      // This ensures all React state and hooks are reset
      window.location.href = '/login'
    }

    return { success: true }
  } catch (error: any) {
    console.error('Sign out error:', error)
    // Even if there's an error, try to clear storage and redirect
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/login'
    }
    return { success: false, message: error.message }
  }
}

// Password reset request
export const sendPasswordResetEmail = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '/reset-password',
    })

    if (error) throw error
    return { success: true, message: "Password reset instructions sent to your email." }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Reset password with token
export const confirmPasswordReset = async (token: string, newPassword: string) => {
  try {
    // For Supabase, we use updateUser since the token is already in the session
    // after clicking the reset link
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error

    return { success: true, message: "Password updated successfully." }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Update password for logged in user
export const updatePassword = async (newPassword: string) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error

    return { success: true, message: "Password updated successfully." }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Verify email with token
export const verifyEmail = async (token: string) => {
  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "email",
    })

    if (error) throw error

    return { success: true, message: "Email verified successfully." }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Get current user
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw error

    if (!user) {
      return { success: false, message: "No user logged in." }
    }

    // Get user profile data including role
    const { data, error: userError } = await supabase
      .from("users")
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()

    if (userError) throw userError

    const userData = data as unknown as UserRow

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email || "",
        role: userData?.role,
        firstName: userData?.first_name,
        lastName: userData?.last_name,
      },
    }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Update volunteer's last active timestamp
const updateVolunteerLastActive = async (userId: string) => {
  try {
    // Skip this for now due to type issues
    console.log('Skipping volunteer last active update for user:', userId)
  } catch (error) {
    console.error('Error in updateVolunteerLastActive:', error)
  }
}

// Create a barangay account (admin only)
export const createBarangayAccount = async (
  adminId: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  barangay: string,
) => {
  try {
    const response = await fetch("/api/admin/barangays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId,
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        barangay
      })
    })

    const result = await response.json()
    return result
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to create barangay account" }
  }
}