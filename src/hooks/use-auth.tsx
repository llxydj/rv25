"use client"

import { useState, useEffect, createContext, useContext } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface UserData {
  role: string;
}

interface ExtendedUser extends User {
  role?: string;
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
        .select("role")
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
        return { ...sessionUser, role: undefined } as ExtendedUser
      }

      return { ...sessionUser, role: (data as UserData | null)?.role } as ExtendedUser
    } catch (error) {
      // Avoid throwing; just return base user and warn with structured context
      const err: any = error
      console.warn("Error fetching role:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
      })
      return { ...sessionUser, role: undefined } as ExtendedUser
    }
  }

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          const userWithRole = await updateUserWithRole(session.user)
          setUser(userWithRole)
        } else {
          setUser(null)
        }
      } catch (error) {
        const err: any = error
        console.warn("Auth session warning:", {
          message: err?.message,
          code: err?.code,
          details: err?.details,
        })
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const userWithRole = await updateUserWithRole(session.user)
          setUser(userWithRole)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
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