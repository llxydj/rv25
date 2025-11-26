"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, BarChart3 } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"
import { SignOutModal } from "@/components/ui/signout-modal"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Initialize push notifications
  useEffect(() => {
    if (user?.id) {
      pushNotificationService.initialize().catch((error) => {
        console.log('[Resident] Push notification initialization skipped:', error.message)
      })
    }
  }, [user?.id])

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
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
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

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

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={() => setShowSignOutModal(true)}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
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
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
              onClick={toggleSidebar}
              aria-label="Open menu"
            >
              <BarChart3 className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>

      <SignOutModal
        open={showSignOutModal}
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutModal(false)}
        loading={loading}
        roleLabel="resident"
      />
    </AuthLayout>
  )
}
