"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface AuthLayoutProps {
  children: React.ReactNode
  allowedRoles?: Array<"admin" | "volunteer" | "resident" | "barangay">
  redirectTo?: string
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, allowedRoles, redirectTo = "/login" }) => {
  const { user, loading } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    )
  }

  // If no user is logged in, redirect to login
  if (!user) {
    router.push(redirectTo)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Redirecting to login..." />
      </div>
    )
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!user.role) {
      router.push("/resident/register-google")
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Redirecting you to complete your profile..." />
        </div>
      )
    }

    if (!allowedRoles.includes(user.role)) {
      if (user.role === "admin") {
        router.push("/admin/dashboard")
      } else if (user.role === "volunteer") {
        router.push("/volunteer/dashboard")
      } else if (user.role === "resident") {
        router.push("/resident/dashboard")
      } else if (user.role === "barangay") {
        router.push("/barangay/dashboard")
      } else {
        router.push(redirectTo)
      }

      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Redirecting to your dashboard..." />
        </div>
      )
    }
  }

  return <>{children}</>
}
