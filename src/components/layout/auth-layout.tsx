"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth" 
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface AuthLayoutProps {
  children: React.ReactNode
  redirectTo?: string
  allowedRoles?: string[]
}

export function AuthLayout({ children, redirectTo = "/login", allowedRoles = [] }: AuthLayoutProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push(redirectTo)
      } else if (allowedRoles.length > 0 && (!user.role || !allowedRoles.includes(user.role))) {
        // If user has no role but we require specific roles, redirect to registration for residents
        if (!user.role && allowedRoles.includes("resident")) {
          router.push("/resident/register-google")
        } else {
          console.log('Unauthorized access attempt:', { userRole: user.role, allowedRoles })
          router.push("/unauthorized")
        }
      }
    }
  }, [user, loading, redirectTo, router, allowedRoles])

  // Show loading state while checking auth or redirecting
  // For resident dashboard, show a brief loading state while session refreshes
  // instead of instantly redirecting to prevent blank screen
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Please wait..." />
      </div>
    )
  }
  
  // If user is not authenticated, redirect to login
  if (!user) {
    router.push(redirectTo)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Redirecting to login..." />
      </div>
    )
  }
  
  // If specific roles are required and user doesn't have them, redirect appropriately
  if (allowedRoles.length > 0 && (!user.role || !allowedRoles.includes(user.role))) {
    // If user has no role but we require specific roles, redirect to registration for residents
    if (!user.role && allowedRoles.includes("resident")) {
      router.push("/resident/register-google")
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Redirecting to profile setup..." />
        </div>
      )
    } else {
      console.log('Unauthorized access attempt:', { userRole: user.role, allowedRoles })
      router.push("/unauthorized")
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      )
    }
  }

  // User is authenticated and authorized, render children
  return <>{children}</>
}