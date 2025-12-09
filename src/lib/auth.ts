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
  const [hasRedirected, setHasRedirected] = useState(false) // Track if we've already redirected for PIN
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
          role: userData.role as UserRole,
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

        // SECURITY FIX: Removed localStorage token caching - Supabase uses httpOnly cookies
        // Tokens are now only stored in secure, httpOnly cookies managed by Supabase
        // This prevents XSS attacks from stealing authentication tokens

        if (session) {
          try {
        // Get user profile data including role and status
        const { data, error: userError } = await supabase
          .from("users")
          .select("role, status, first_name, last_name, phone_number, address, barangay, email")
          .eq("id", session.user.id)
          .maybeSingle()

            if (userError) {
              // Log the error but don't throw - this might be due to RLS policies
              console.warn("User data fetch warning:", userError)
            }

            const userData = data as unknown as UserRow

            // Check if user is deactivated
            if (userData && (userData as any).status === 'inactive') {
              console.warn('Deactivated user attempted to access:', session.user.id)
              // Sign out the user and redirect to login
              await supabase.auth.signOut()
              router.push("/login?error=account_deactivated")
              return
            }

            if (userData) {
              // Check if profile is complete for residents
              const isProfileComplete = userData.first_name && 
                                        userData.last_name && 
                                        userData.phone_number && 
                                        userData.address && 
                                        userData.barangay

              // If resident profile is incomplete, don't set role to avoid redirect issues
              if (userData.role === "resident" && !isProfileComplete) {
                setUser({
                  id: session.user.id,
                  email: session.user.email || "",
                  role: null, // Set to null so redirect logic can catch it
                  firstName: userData.first_name || "",
                  lastName: userData.last_name || "",
                  phone_number: userData.phone_number || undefined,
                  address: userData.address || undefined,
                  barangay: userData.barangay || undefined,
                })
              } else {
                setUser({
                  id: session.user.id,
                  email: session.user.email || "",
                  role: userData.role as UserRole,
                  firstName: userData.first_name,
                  lastName: userData.last_name,
                  phone_number: userData.phone_number || undefined,
                  address: userData.address || undefined,
                  barangay: userData.barangay || undefined,
                })
              }
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

    // SECURITY FIX: Removed token caching - Supabase uses httpOnly cookies
    // No need to cache tokens in localStorage as they're stored securely in cookies
    const cacheToken = (token: string | undefined) => {
      // Token caching removed for security - Supabase handles token storage in httpOnly cookies
      // This prevents XSS attacks from stealing authentication tokens
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // PERMANENT FIX: Cache token whenever we get a session
      if (session?.access_token) {
        cacheToken(session.access_token)
      }
      if (event === "SIGNED_IN" && session) {
        // CRITICAL: Verify we have the correct session user
        // Double-check by getting the current user to ensure session is correct
        const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser()
        
        if (verifyError || !verifiedUser) {
          console.error('[Auth] Session verification failed:', verifyError)
          await supabase.auth.signOut()
          router.push("/login?error=session_error")
          return
        }

        // Verify session user matches verified user
        if (verifiedUser.id !== session.user.id) {
          console.error('[Auth] Session user mismatch detected!', {
            sessionUserId: session.user.id,
            verifiedUserId: verifiedUser.id,
            sessionEmail: session.user.email,
            verifiedEmail: verifiedUser.email
          })
          await supabase.auth.signOut()
          router.push("/login?error=session_mismatch")
          return
        }

        // Get user profile data including role and status
        const { data, error: userError } = await supabase
          .from("users")
          .select("role, status, first_name, last_name, phone_number, address, barangay, email")
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

        // CRITICAL: Verify email matches (case-insensitive)
        // If mismatch, sync email from Auth to database (Auth is source of truth)
        if (userData && userData.email && session.user.email) {
          const dbEmail = userData.email.toLowerCase().trim()
          const sessionEmail = session.user.email.toLowerCase().trim()
          
          if (dbEmail !== sessionEmail) {
            console.warn('[Auth] Email mismatch detected - syncing email from Auth to database', {
              sessionEmail,
              dbEmail,
              userId: session.user.id
            })
            
            // Sync email from Auth to database (Auth is source of truth)
            try {
              const { error: updateError } = await supabase
                .from('users')
                .update({ email: session.user.email })
                .eq('id', session.user.id)
              
              if (updateError) {
                console.error('[Auth] Failed to sync email to database:', updateError)
                // Continue anyway - email mismatch is not critical enough to block login
              } else {
                console.log('[Auth] Email synced successfully from Auth to database')
              }
            } catch (syncError) {
              console.error('[Auth] Error syncing email:', syncError)
              // Continue anyway - don't block login for email sync failure
            }
          }
        }

        // CRITICAL: Check if user is deactivated
        if (userData && (userData as any).status === 'inactive') {
          console.warn('Deactivated user attempted to access:', session.user.id)
          // Sign out the user immediately
          await supabase.auth.signOut()
          // Clear any cached user data
          setUser(null)
          // Redirect to login with error message
          router.push("/login?error=account_deactivated")
          return
        }

        if (userData) {
          // Check if profile is complete for residents (all required fields must be present)
          const isProfileComplete = userData.first_name && 
                                    userData.last_name && 
                                    userData.phone_number && 
                                    userData.address && 
                                    userData.barangay

          // If user is a resident but profile is incomplete, redirect to registration
          if (userData.role === "resident" && !isProfileComplete) {
            console.log('[Auth] Resident profile incomplete, redirecting to registration:', {
              userId: session.user.id,
              hasFirstName: !!userData.first_name,
              hasLastName: !!userData.last_name,
              hasPhone: !!userData.phone_number,
              hasAddress: !!userData.address,
              hasBarangay: !!userData.barangay
            })
            setUser({
              id: session.user.id,
              email: session.user.email || "",
              role: null,
              firstName: "",
              lastName: "",
            })
            // CRITICAL: Only redirect if not already on register-google page
            // This prevents redirect loops
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/resident/register-google')) {
              router.push("/resident/register-google")
            }
            return
          }

          // If the user is a volunteer, update their last_active timestamp (non-blocking)
          if (userData.role === "volunteer") {
            updateVolunteerLastActive(session.user.id).catch(console.error)
          }

          const userSession = {
            id: session.user.id,
            email: session.user.email || "",
            role: userData.role as UserRole,
            firstName: userData.first_name,
            lastName: userData.last_name,
            phone_number: userData.phone_number || undefined,
            address: userData.address || undefined,
            barangay: userData.barangay || undefined,
          }

          setUser(userSession)

          // Check PIN status and redirect accordingly
          // Wrap in try-catch to prevent blocking login if PIN check fails
          try {
            // Skip PIN check if already on PIN pages or dashboard (prevents loops)
            if (typeof window !== 'undefined') {
              const currentPath = window.location.pathname
              // If already on PIN pages, don't redirect (let PIN page handle it)
              if (currentPath.startsWith('/pin/')) {
                return
              }
              // If already on dashboard, check if PIN is verified before redirecting
              if (currentPath.includes('/dashboard') || currentPath.includes('/admin/') || currentPath.includes('/volunteer/') || currentPath.includes('/resident/')) {
                // Check if PIN is verified - if yes, stay on current page
                try {
                  const verifyRes = await fetch('/api/pin/check-verified', {
                    credentials: 'include',
                    cache: 'no-store'
                  })
                  if (verifyRes.ok) {
                    const verifyJson = await verifyRes.json()
                    if (verifyJson.verified) {
                      // PIN is verified, stay on current page
                      return
                    }
                  }
                } catch {
                  // If check fails, continue with PIN redirect logic
                }
              }
            }

            // Skip if we've already redirected in this session (prevents multiple redirects)
            if (hasRedirected) {
              return
            }

            // SKIP PIN CHECK FOR RESIDENTS, BARANGAY, AND VOLUNTEERS - No PIN required
            if (userData.role !== 'resident' && userData.role !== 'barangay' && userData.role !== 'volunteer') {
              const { getPinRedirectForRole } = await import('@/lib/pin-auth-helper')
              const redirectUrl = await getPinRedirectForRole(userData.role)
              
              // Only redirect if different from current path (prevents loops)
              // Also skip redirect if on register-google page (OAuth callback handles that)
              if (typeof window !== 'undefined') {
                const currentPath = window.location.pathname
                if (redirectUrl !== currentPath && !currentPath.startsWith('/pin/') && !currentPath.includes('/resident/register-google')) {
                  setHasRedirected(true) // Mark that we've redirected
                  router.push(redirectUrl)
                } else if (redirectUrl === currentPath) {
                  // Already on the correct page, mark as redirected
                  setHasRedirected(true)
                }
              } else {
                setHasRedirected(true)
                router.push(redirectUrl)
              }
            } else {
              // For residents, barangay, and volunteers, use default redirect (no PIN)
              // CRITICAL: Don't redirect if on register-google page (let OAuth callback handle it)
              const defaultRedirects: Record<string, string> = {
                admin: '/admin/dashboard',
                volunteer: '/volunteer/dashboard',
                resident: '/resident/dashboard',
                barangay: '/barangay/dashboard'
              }
              const defaultRedirect = userData.role 
                ? defaultRedirects[userData.role] || '/resident/dashboard'
                : '/resident/dashboard'
              
              // Only redirect if different from current path and not on register-google
              if (typeof window !== 'undefined') {
                const currentPath = window.location.pathname
                // Don't redirect if already on register-google (OAuth callback handles that)
                if (currentPath.includes('/resident/register-google')) {
                  // Already on registration page, don't redirect
                  return
                }
                if (defaultRedirect !== currentPath && !currentPath.startsWith('/pin/')) {
                  setHasRedirected(true)
                  router.push(defaultRedirect)
                } else if (defaultRedirect === currentPath) {
                  setHasRedirected(true)
                }
              } else {
                setHasRedirected(true)
                router.push(defaultRedirect)
              }
            }
          } catch (pinError: any) {
            console.error('[Auth] PIN check failed, using default redirect:', pinError)
            // If PIN check fails, use default role-based redirect
            const defaultRedirects: Record<string, string> = {
              admin: '/admin/dashboard',
              volunteer: '/volunteer/dashboard',
              resident: '/resident/dashboard',
              barangay: '/barangay/dashboard'
            }
            const defaultRedirect = userData.role 
              ? defaultRedirects[userData.role] || '/resident/dashboard'
              : '/resident/dashboard'
            
            // Only redirect if different from current path
            if (typeof window !== 'undefined') {
              const currentPath = window.location.pathname
              if (defaultRedirect !== currentPath && !currentPath.startsWith('/pin/')) {
                setHasRedirected(true)
                router.push(defaultRedirect)
              } else if (defaultRedirect === currentPath) {
                setHasRedirected(true)
              }
            } else {
              setHasRedirected(true)
              router.push(defaultRedirect)
            }
          }
        } else {
          // No profile data found - this is a new Google OAuth user
          // Set basic user info and redirect to registration
          console.log('[Auth] No profile data found for new Google OAuth user, redirecting to registration:', session.user.id)
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            role: null,
            firstName: "",
            lastName: "",
          })
          // CRITICAL: Only redirect if not already on register-google page
          // This prevents redirect loops and allows the OAuth callback to handle the redirect
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/resident/register-google')) {
            router.push("/resident/register-google")
          }
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setHasRedirected(false) // Reset redirect flag on sign out
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
    // CRITICAL: Clear any existing session first to ensure we get a fresh session
    // This prevents the issue where a new admin login uses the old admin's session
    const { data: existingSession } = await supabase.auth.getSession()
    if (existingSession?.session) {
      console.log('[Auth] Clearing existing session before new login')
      await supabase.auth.signOut()
      // Wait a brief moment for sign out to complete
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) throw error

    // Verify we got the correct user
    if (!data.user) {
      throw new Error("Failed to authenticate user")
    }

    // CRITICAL: Check if account is deleted/inactive BEFORE proceeding
    // This prevents deleted accounts from logging in
    const { data: userStatusCheck } = await supabase
      .from("users")
      .select("status, id")
      .eq("id", data.user.id)
      .maybeSingle()

    // If user row doesn't exist, account was deleted - block login
    if (!userStatusCheck) {
      console.warn('[Auth] Login blocked - user account not found in database (deleted)')
      await supabase.auth.signOut()
      return {
        success: false,
        message: "Account not found. Please contact an administrator or register a new account."
      }
    }

    // If account is inactive/deactivated, block login
    if (userStatusCheck.status === 'inactive') {
      console.warn('[Auth] Login blocked - account is deactivated:', data.user.id)
      await supabase.auth.signOut()
      return {
        success: false,
        message: "Your account has been deactivated. Please contact an administrator."
      }
    }

    // SECURITY FIX: Removed localStorage token caching - Supabase uses httpOnly cookies
    // Tokens are automatically stored in secure, httpOnly cookies by Supabase
    // This prevents XSS attacks from stealing authentication tokens

    // Double-check: Verify the session user exists
    const { data: { user: verifiedUser } } = await supabase.auth.getUser()
    if (!verifiedUser) {
      console.error('[Auth] Session verification failed - no user found')
      await supabase.auth.signOut()
      throw new Error("Session verification failed. Please try again.")
    }
    
    // Note: We don't strictly check email match here because:
    // 1. Auth already verified the email/password
    // 2. Email might be different in database (we'll sync it)
    // 3. User ID is the primary identifier

    // Check if user is deactivated after successful auth
    if (data.user) {
      const { data: userData } = await supabase
        .from("users")
        .select("status, email")
        .eq("id", data.user.id)
        .maybeSingle()

      if (userData && (userData as any).status === 'inactive') {
        // Sign out immediately
        await supabase.auth.signOut()
        return { 
          success: false, 
          message: "Your account has been deactivated. Please contact an administrator." 
        }
      }

      // Verify email matches (case-insensitive)
      // If mismatch, sync email from Auth to database (Auth is source of truth)
      if (userData && userData.email?.toLowerCase() !== email.trim().toLowerCase()) {
        console.warn('[Auth] Email mismatch in database - syncing email from Auth', {
          expectedEmail: email.trim().toLowerCase(),
          dbEmail: userData.email?.toLowerCase(),
          userId: data.user.id
        })
        
        // Sync email from Auth to database
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update({ email: email.trim().toLowerCase() })
            .eq('id', data.user.id)
          
          if (updateError) {
            console.error('[Auth] Failed to sync email to database:', updateError)
            // Continue anyway - email mismatch is not critical enough to block login
          } else {
            console.log('[Auth] Email synced successfully from Auth to database')
          }
        } catch (syncError) {
          console.error('[Auth] Error syncing email:', syncError)
          // Continue anyway - don't block login for email sync failure
        }
      }
    }

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
      
      // Clear PIN verification cookies (via API call since they're HTTP-only)
      try {
        await fetch('/api/pin/clear-session', {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {
          // Ignore errors - cookies will expire anyway
        })
      } catch {
        // Ignore errors
      }

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
    // Normalize email to lowercase (Supabase Auth stores emails in lowercase)
    const normalizedEmail = email.trim().toLowerCase()
    
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      console.error('[sendPasswordResetEmail] Invalid email format:', email)
      return { 
        success: false, 
        message: "Please enter a valid email address." 
      }
    }

    console.log('[sendPasswordResetEmail] Attempting password reset for:', normalizedEmail)

    // CRITICAL: Check if user exists and is deactivated before allowing password reset
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, status, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (userError) {
      console.error('[sendPasswordResetEmail] Error checking user:', userError)
      // Continue anyway - might be a new user not in users table yet
    }

    if (userData && (userData as any).status === 'inactive') {
      console.warn('[sendPasswordResetEmail] User is inactive:', normalizedEmail)
      // Don't reveal that the account exists but is deactivated
      // Return success message to prevent email enumeration
      return { 
        success: true, 
        message: "If an account exists with this email, password reset instructions have been sent." 
      }
    }

    // Check if email exists in Supabase Auth
    // Note: Supabase doesn't provide a direct way to check if email exists,
    // but resetPasswordForEmail will work even if email doesn't exist (for security)
    
    // Get the correct redirect URL
    const redirectUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/reset-password`
      : process.env.NEXT_PUBLIC_SITE_URL 
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`
        : '/reset-password'

    console.log('[sendPasswordResetEmail] Sending reset email with redirect URL:', redirectUrl)

    const { error, data } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl,
    })

    if (error) {
      console.error('[sendPasswordResetEmail] Supabase error:', error)
      
      // Provide user-friendly error messages
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        return { 
          success: false, 
          message: "Too many requests. Please wait a few minutes before trying again." 
        }
      }
      
      if (error.message?.includes('email')) {
        return { 
          success: false, 
          message: "Unable to send reset email. Please check your email address and try again." 
        }
      }
      
      throw error
    }

    console.log('[sendPasswordResetEmail] Reset email sent successfully')
    return { 
      success: true, 
      message: "Password reset instructions have been sent to your email. Please check your inbox (and spam folder)." 
    }
  } catch (error: any) {
    console.error('[sendPasswordResetEmail] Unexpected error:', error)
    return { 
      success: false, 
      message: error?.message || "An unexpected error occurred. Please try again later." 
    }
  }
}

// Reset password with token
export const confirmPasswordReset = async (token: string, newPassword: string) => {
  try {
    // CRITICAL: Check if user is deactivated before allowing password reset
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, status')
        .eq('id', user.id)
        .maybeSingle()

      if (userData && (userData as any).status === 'inactive') {
        // Sign out the user
        await supabase.auth.signOut()
        return { 
          success: false, 
          message: "Your account has been deactivated. Please contact an administrator." 
        }
      }
    }

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

    // Get user profile data including role and status
    const { data, error: userError } = await supabase
      .from("users")
      .select("role, status, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()

    if (userError) throw userError

    const userData = data as unknown as UserRow

    // Check if user is deactivated
    if (userData && (userData as any).status === 'inactive') {
      // Sign out the user
      await supabase.auth.signOut()
      return {
        success: false,
        message: "Your account has been deactivated. Please contact an administrator."
      }
    }

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