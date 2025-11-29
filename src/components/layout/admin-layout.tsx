"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, MessageSquare, ChevronDown, Power } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"
import { SignOutModal } from "@/components/ui/signout-modal"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Initialize push notifications (silently check permission, don't force request)
  useEffect(() => {
    if (user?.id) {
      // Initialize without requesting permission (just checks if already granted)
      pushNotificationService.initialize(false).then((success) => {
        if (success) {
          console.log('[Admin] Push notifications enabled')
        } else {
          // User can enable notifications later via settings or browser prompt
          console.log('[Admin] Push notifications not enabled (permission needed)')
        }
      })
    }
  }, [user?.id])

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  // Helper to check if a path should be active, considering parent/child routes
  const isRouteActive = (path: string, exact: boolean = false) => {
    if (!pathname) return false
    if (exact) {
      return pathname === path
    }
    // For parent routes, only match if no more specific child route is active
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  // Navigation groups structure
  interface NavItem {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    exact?: boolean
  }

  interface NavGroup {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    items: NavItem[]
  }

  const navigationGroups: NavGroup[] = useMemo(() => [
    {
      id: 'core-operations',
      label: 'Operations',
      icon: BarChart3,
      items: [
        { href: '/admin/documents', label: 'Documents', icon: FileText },
        { href: '/admin/incidents', label: 'Incidents', icon: AlertTriangle },
        { href: '/admin/schedules', label: 'Schedules', icon: Calendar },
        { href: '/admin/schedules/analytics', label: 'Schedule Analytics', icon: BarChart3 },
        { href: '/admin/activities/dashboard', label: 'Activity Dashboard', icon: BarChart3 },
        { href: '/admin/activities/reports', label: 'Activity Reports', icon: BarChart3 },
      ],
    },
    {
      id: 'volunteers',
      label: 'Volunteers',
      icon: User,
      items: [
        { href: '/admin/volunteers', label: 'Volunteers', icon: User },
        { href: '/admin/volunteers/analytics', label: 'Volunteer Analytics', icon: BarChart3 },
        { href: '/admin/volunteers/map', label: 'Volunteer Tracking', icon: MapPin },
      ],
    },
    {
      id: 'locations',
      label: 'Locations & Areas',
      icon: MapPin,
      items: [
        { href: '/admin/barangay', label: 'Barangay', icon: MapPin },
        { href: '/admin/area-map', label: 'Area Map', icon: MapPin },
      ],
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: BarChart3,
      items: [
        { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      id: 'communication',
      label: 'Communication',
      icon: MessageSquare,
      items: [
        { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
        { href: '/admin/announcements', label: 'Announcements', icon: Bell },
        { href: '/admin/sms', label: 'SMS Management', icon: Phone },
        { href: '/admin/contacts', label: 'Contacts', icon: Phone },
        { href: '/admin/lgu-contacts', label: 'LGU Contacts', icon: Phone },
      ],
    },
    {
      id: 'management',
      label: 'Management',
      icon: Settings,
      items: [
        { href: '/admin/users', label: 'Users', icon: User },
        ...(process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' ? [
          { href: '/admin/trainings', label: 'Trainings', icon: Calendar },
          { href: '/admin/training-evaluations', label: 'Training Evaluations', icon: FileText },
        ] : []),
        { href: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ], [])

  // Check if any item in a group is active (for auto-expand)
  const isGroupActive = (group: NavGroup): boolean => {
    return group.items.some(item => {
      if (item.exact) {
        return pathname === item.href
      }
      return pathname === item.href || pathname?.startsWith(`${item.href}/`)
    })
  }

  // State for open/closed collapsible sections
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  // Auto-expand active sections on mount and pathname change
  useEffect(() => {
    const activeSections = navigationGroups
      .filter(group => isGroupActive(group))
      .map(group => group.id)
    setOpenSections(new Set(activeSections))
  }, [pathname, navigationGroups])

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-[999] bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-[1000] w-72 sm:w-80 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 lg:z-auto flex flex-col ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header - Fixed at top */}
          <div className="flex items-center justify-between p-4 border-b border-blue-700 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation with collapsible groups - Flex layout to ensure sign out is always visible */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Scrollable navigation area */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden min-h-0 pb-2">
              {/* Dashboard - Always visible, standalone */}
              <Link
                href="/admin/dashboard"
                className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 text-white min-h-[44px] ${
                  isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md text-white"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Home className="h-5 w-5 flex-shrink-0 text-white" />
                <span className="font-medium text-white whitespace-nowrap">Dashboard</span>
              </Link>

              {/* Collapsible Navigation Groups */}
              {navigationGroups.map((group) => {
                const isOpen = openSections.has(group.id)
                const GroupIcon = group.icon
                const hasActiveItem = isGroupActive(group)

                return (
                  <Collapsible
                    key={group.id}
                    open={isOpen}
                    onOpenChange={() => toggleSection(group.id)}
                  >
                    <CollapsibleTrigger
                      className={`flex items-center justify-between w-full p-3 rounded-lg transition-colors duration-200 text-white min-h-[44px] cursor-pointer ${
                        hasActiveItem ? "bg-blue-700/50 text-white" : "hover:bg-blue-700 hover:shadow-md text-white"
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <GroupIcon className="h-5 w-5 flex-shrink-0 text-white" />
                        <span className="font-medium text-white whitespace-nowrap">{group.label}</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 flex-shrink-0 text-white transition-transform duration-200 ${
                          isOpen ? "transform rotate-180" : ""
                        }`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down pointer-events-auto">
                      <div className="pl-6 pt-1 space-y-1">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon
                          // Check if this item matches the current pathname
                          const itemMatches = item.exact
                            ? pathname === item.href
                            : pathname === item.href || pathname?.startsWith(`${item.href}/`)
                          
                          // Only highlight if this item matches AND there's no more specific item that also matches
                          let isItemActive = false
                          if (itemMatches) {
                            // Check if there's a more specific item (longer path) that also matches
                            const hasMoreSpecificMatch = group.items.some(otherItem => {
                              if (otherItem.href === item.href) return false // Skip self
                              if (otherItem.href.length <= item.href.length) return false // Not more specific
                              
                              // Check if the more specific item matches
                              if (otherItem.exact) {
                                return pathname === otherItem.href
                              }
                              return pathname === otherItem.href || pathname?.startsWith(`${otherItem.href}/`)
                            })
                            
                            // Only highlight if no more specific match exists
                            isItemActive = !hasMoreSpecificMatch
                          }

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center space-x-3 p-2.5 rounded-lg transition-colors duration-200 text-white min-h-[44px] relative z-10 cursor-pointer ${
                                isItemActive
                                  ? "bg-blue-700 text-white shadow-lg"
                                  : "hover:bg-blue-700/70 hover:shadow-md text-white"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSidebarOpen(false)
                              }}
                            >
                              <ItemIcon className="h-4 w-4 flex-shrink-0 text-white" />
                              <span className="font-medium text-white text-sm whitespace-nowrap">{item.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </nav>

            {/* Sign Out Button - ALWAYS VISIBLE at bottom, outside scrollable area */}
            <div className="flex-shrink-0 border-t border-blue-700 p-3">
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  setShowSignOutModal(true)
                }}
                disabled={loading}
                className="flex items-center justify-center space-x-2 px-3 py-2 rounded-md w-full text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-blue-800 transition-colors duration-200 text-sm font-medium"
                aria-label="Sign out"
              >
                {loading ? (
                  <LoadingSpinner size="sm" color="text-white" />
                ) : (
                  <>
                    <Power className="h-4 w-4 flex-shrink-0 text-white" />
                    <span className="text-white whitespace-nowrap">Sign Out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <BarChart3 className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 text-gray-900 bg-gray-50" style={{ color: '#111827' }}>
            <div className="min-h-full" style={{ color: '#111827' }}>
              <SubscribeBanner userId={user?.id} />
              {children}
            </div>
          </main>
        </div>
      </div>

      <SignOutModal
        open={showSignOutModal}
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutModal(false)}
        loading={loading}
        roleLabel="admin"
      />
    </AuthLayout>
  )
}

