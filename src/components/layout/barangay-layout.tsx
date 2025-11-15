"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X } from "lucide-react"
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { BarangayNotifications } from "@/components/barangay/barangay-notifications"
import { SystemClock } from "@/components/system-clock"

interface BarangayLayoutProps {
  children: React.ReactNode
}

export function BarangayLayout({ children }: BarangayLayoutProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    const { success } = await signOut()
    if (success) {
      router.push("/login")
    }
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/barangay/dashboard",
      icon: AlertTriangle,
    },
    {
      name: "Report Incident",
      href: "/barangay/report",
      icon: AlertTriangle,
    },
    {
      name: "Incidents",
      href: "/barangay/incidents",
      icon: AlertTriangle,
    },
    {
      name: "Notifications",
      href: "/barangay/notifications",
      icon: AlertTriangle,
    },
    {
      name: "Profile",
      href: "/barangay/profile",
      icon: User,
    },
  ]

  return (
    <AuthLayout allowedRoles={["barangay"]}>
      <div className="min-h-screen bg-gray-100">
        {/* Mobile menu */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between bg-blue-600 px-4 py-2">
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-white">Barangay Panel</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white focus:outline-none"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <X className="h-6 w-6" />
              )}
            </button>
          </div>
          {isMobileMenuOpen && (
            <div className="bg-white border-b">
              <nav className="px-4 py-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center space-x-2 px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                ))}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center space-x-2 px-2 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
          <div className="flex min-h-0 flex-1 flex-col bg-blue-600">
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex items-center justify-center h-16">
                <span className="text-xl font-bold text-white">Barangay Panel</span>
              </div>
              <nav className="flex-1 space-y-1 px-4 py-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center space-x-2 px-2 py-2 text-white hover:bg-blue-700 rounded-md"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                ))}
              </nav>
              <div className="flex flex-shrink-0 border-t border-blue-700 p-4">
                <div className="flex items-center w-full">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-blue-700 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user?.firstName?.[0]}
                        {user?.lastName?.[0]}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-blue-200">{user?.barangay}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex-shrink-0 text-blue-200 hover:text-white"
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Barangay Panel</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <BarangayNotifications />
            </div>
          </div>

          <main className="py-6 px-4 sm:px-6 lg:px-8">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}