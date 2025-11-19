"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, PanelLeft } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

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

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
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

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            {process.env.NEXT_PUBLIC_FEATURE_INTER_LGU_ENABLED === 'true' && (
              <Link
                href="/admin/handoffs"
                className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                  isActive("/admin/handoffs") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium truncate">Inter-LGU Handoffs</span>
              </Link>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <PanelLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}

