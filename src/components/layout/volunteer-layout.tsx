"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full text-white ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700 text-white"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5 text-white" />
                <span className="text-white">{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left text-white hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-white" />
                  <span className="text-white">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <button
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
            
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800 hidden lg:block">Volunteer Portal</h1>
              <div className="flex items-center space-x-4 ml-auto">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto text-gray-900 bg-gray-50" style={{ color: '#111827' }}>
                <div style={{ color: '#111827' }}>
                  {children}
                </div>
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}
