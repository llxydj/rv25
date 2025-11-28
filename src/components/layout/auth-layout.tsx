"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
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
  const pathname = usePathname()

  useEffect(() => {
    // Don't run checks while loading
    if (loading) return

    // Don't redirect if already on the target page (prevents loops)
    if (!user) {
      if (pathname !== redirectTo && !pathname.startsWith('/login')) {
        router.push(redirectTo)
      }
      return
    }

    // Check role authorization
    if (allowedRoles.length > 0 && (!user.role || !allowedRoles.includes(user.role))) {
      if (!user.role && allowedRoles.includes("resident")) {
        if (pathname !== "/resident/register-google") {
          router.push("/resident/register-google")
        }
      } else {
        if (pathname !== "/unauthorized") {
          console.log('Unauthorized access attempt:', { userRole: user.role, allowedRoles })
          router.push("/unauthorized")
        }
      }
      return
    }

    // Check profile completeness for residents
    if (user.role === "resident" && !(user as any).isProfileComplete) {
      if (pathname !== "/resident/register-google") {
        console.log('Resident profile incomplete, redirecting to registration')
        router.push("/resident/register-google")
      }
    }
  }, [user, loading, redirectTo, router, allowedRoles, pathname])

  // Show loading state while checking auth or redirecting
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Please wait..." />
      </div>
    )
  }
  
  // If user is not authenticated, show loading while redirecting
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Redirecting to login..." />
      </div>
    )
  }
  
  // If specific roles are required and user doesn't have them, show loading while redirecting
  if (allowedRoles.length > 0 && (!user.role || !allowedRoles.includes(user.role))) {
    // If user has no role but we require specific roles, redirect to registration for residents
    if (!user.role && allowedRoles.includes("resident")) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Redirecting to profile setup..." />
        </div>
      )
    } else {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      )
    }
  }

  // If resident with incomplete profile, show loading while redirecting to registration
  if (user.role === "resident" && !(user as any).isProfileComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Redirecting to complete profile..." />
      </div>
    )
  }

  // User is authenticated and authorized, render children
  return <>{children}</>
}