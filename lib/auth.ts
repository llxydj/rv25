"use client"

import { supabase } from "./supabase"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export type UserRole = "admin" | "volunteer" | "resident"

export interface UserSession {
  id: string
  email: string
  role: UserRole | null
  firstName: string
  lastName: string
}

// Custom hook for authentication state
export const useAuth = () => {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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
          // Get user profile data including role
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("role, first_name, last_name")
            .eq("id", session.user.id)
            .single()

          if (userError) throw userError

          if (userData) {
            setUser({
              id: session.user.id,
              email: session.user.email || "",
              role: userData.role,
              firstName: userData.first_name,
              lastName: userData.last_name,
            })
          }
        }
      } catch (error) {
        console.error("Error getting initial session:", error)
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
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role, first_name, last_name")
          .eq("id", session.user.id)
          .single()

        if (userError) {
          console.error("Error fetching user data:", userError)
          return
        }

        if (userData) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            role: userData.role,
            firstName: userData.first_name,
            lastName: userData.last_name,
          })

          // Redirect based on role
          if (userData.role === "admin") {
            router.push("/admin/dashboard")
          } else if (userData.role === "volunteer") {
            router.push("/volunteer/dashboard")
          } else if (userData.role === "resident") {
            router.push("/resident/dashboard")
          }
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

  return { user, loading }
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
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) throw authError

    if (authData.user) {
      // Create user profile with role
      const { error: profileError } = await supabase.from("users").insert({
        id: authData.user.id,
        email,
        first_name: firstName.toUpperCase(),
        last_name: lastName.toUpperCase(),
        role: "resident",
        phone_number: phoneNumber,
        address: address.toUpperCase(),
        barangay: barangay.toUpperCase(),
        city: "TALISAY CITY",
        province: "NEGROS OCCIDENTAL",
        confirmation_phrase: confirmationPhrase,
      })

      if (profileError) throw profileError

      return { success: true, message: "Please check your email for verification link." }
    }
  } catch (error: any) {
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
  skills: string[],
  assignedBarangays: string[],
) => {
  try {
    // Check if admin
    const { data: adminData, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", adminId)
      .single()

    if (adminError) throw adminError

    if (adminData.role !== "admin") {
      throw new Error("Only admins can create volunteer accounts")
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) throw authError

    if (authData.user) {
      // Create user profile with role
      const { error: profileError } = await supabase.from("users").insert({
        id: authData.user.id,
        email,
        first_name: firstName.toUpperCase(),
        last_name: lastName.toUpperCase(),
        role: "volunteer",
        phone_number: phoneNumber,
        address: address.toUpperCase(),
        barangay: barangay.toUpperCase(),
        city: "TALISAY CITY",
        province: "NEGROS OCCIDENTAL",
      })

      if (profileError) throw profileError

      // Create volunteer profile
      const { error: volunteerError } = await supabase.from("volunteer_profiles").insert({
        volunteer_user_id: authData.user.id,
        admin_user_id: adminId,
        status: "ACTIVE",
        skills,
        assigned_barangays: assignedBarangays,
        total_incidents_resolved: 0,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_status_change: new Date().toISOString(),
        last_status_changed_by: adminId
      })

      if (volunteerError) throw volunteerError

      return { success: true, message: "Volunteer account created successfully." }
    }
  } catch (error: any) {
    return { success: false, message: error.message }
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
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Password reset
export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
    return { success: true, message: "Password reset instructions sent to your email." }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

// Update password
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
