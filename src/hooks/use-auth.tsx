"use client"

import { useState, useEffect, createContext, useContext } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface UserData {
  role: string;
}

interface ExtendedUser extends User {
  role?: string;
  isProfileComplete?: boolean;
}

type AuthContextType = {
  user: ExtendedUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [loading, setLoading] = useState(true)

  const updateUserWithRole = async (sessionUser: User) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("role, first_name, last_name, phone_number, address, barangay")
        .eq("id", sessionUser.id)
        .maybeSingle()

      // Some Supabase clients may return a benign error for 0 rows; treat missing
      // profile as non-fatal and do not spam the console with empty error objects
      if (error) {
        const code = (error as any)?.code
        const message = (error as any)?.message
        const details = (error as any)?.details
        // Known benign conditions: 0 rows or 404-like responses for optional profile
        const isBenignNoRows =
          message?.toLowerCase?.().includes?.("row") ||
          details?.toLowerCase?.().includes?.("row")

        if (!isBenignNoRows) {
          console.warn("Role lookup warning:", { code, message, details })
        }
        // Return the user with no role instead of throwing
        return { ...sessionUser, role: undefined, isProfileComplete: false } as ExtendedUser
      }

      // Check if profile is complete for residents
      const profileData = data as any
      const isProfileComplete = !!(
        profileData?.first_name &&
        profileData?.last_name &&
        profileData?.phone_number &&
        profileData?.address &&
        profileData?.barangay
      )

      return { 
        ...sessionUser, 
        role: profileData?.role,
        isProfileComplete 
      } as ExtendedUser
    } catch (error) {
      // Avoid throwing; just return base user and warn with structured context
      const err: any = error
      console.warn("Error fetching role:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
      })
      return { ...sessionUser, role: undefined, isProfileComplete: false } as ExtendedUser
    }
  }

  useEffect(() => {
    let mounted = true

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (session) {
          const userWithRole = await updateUserWithRole(session.user)
          if (mounted) {
            setUser(userWithRole)
          }
        } else {
          if (mounted) {
            setUser(null)
          }
        }
      } catch (error) {
        if (!mounted) return
        const err: any = error
        console.warn("Auth session warning:", {
          message: err?.message,
          code: err?.code,
          details: err?.details,
        })
        setUser(null)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getSession()

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        if (session) {
          const userWithRole = await updateUserWithRole(session.user)
          if (mounted) {
            setUser(userWithRole)
          }
        } else {
          if (mounted) {
            setUser(null)
          }
        }
        if (mounted) {
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Clear all Supabase-related storage
      if (typeof window !== 'undefined') {
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
        
        // Force redirect to login to ensure clean state
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Error during sign out:', error)
      // Even on error, try to redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  const refreshSession = async () => {
    await supabase.auth.refreshSession()
  }

  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const userWithRole = await updateUserWithRole(session.user)
        setUser(userWithRole)
      } else {
        setUser(null)
      }
    } catch (error) {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshSession, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)