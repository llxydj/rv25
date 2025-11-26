"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import type { UserRole } from "@/lib/auth"

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

interface UserData {
  role: string
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const { data: sessionData } = await supabase.auth.getSession()
      
      if (sessionData.session) {
        // Get user role from the users table
        const { data: userData, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", sessionData.session.user.id)
          .maybeSingle()

        if (error) {
          // Treat missing profile row as benign during first-time login flows
          console.warn("Role lookup warning (auth-guard):", error)
        }

        const role = (userData as UserData | null)?.role ?? null
        setUserRole(role as UserRole | null)
        setAuthenticated(true)

        // If roles are specified and user's role is not allowed, redirect
        if (allowedRoles && role && !allowedRoles.includes(role as UserRole)) {
          // Redirect to appropriate dashboard based on role
          switch (role) {
            case "admin":
              router.replace("/admin/dashboard")
              break
            case "volunteer":
              router.replace("/volunteer/dashboard")
              break
            case "resident":
              router.replace("/resident/dashboard")
              break
            case "barangay":
              router.replace("/barangay/dashboard")
              break
            default:
              router.replace('/login')
          }
          return
        }
        
        // If user has no role and we're on a protected page, redirect to registration
        if (allowedRoles && !role) {
          router.replace("/resident/register-google")
          return
        }
      } else {
        router.replace('/login')
      }
      setLoading(false)
    }
    
    checkAuth()
  }, [router, allowedRoles])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Please wait..." />
      </div>
    )
  }

  if (!authenticated || (allowedRoles && !userRole)) {
    return null // Will redirect to login or registration
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return null // Will redirect to appropriate dashboard
  }

  return <>{children}</>
}