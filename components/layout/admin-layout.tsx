// @/components/layout/admin-layout.tsx
"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertTriangle,
  User,
  Users,
  X,
  Menu,
  LayoutDashboard,
  FileText,
  Calendar,
  Settings,
  LogOut,
} from "lucide-react"
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SystemClock } from "@/components/system-clock"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const pathname = usePathname()
  const router = useRouter()

  const isActive = (path: string) => {
    if (!pathname) return false
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  // Updated nav items including SMS Management
  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/incidents", label: "Incidents", icon: AlertTriangle },
    { href: "/admin/volunteers", label: "Volunteers", icon: User },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/schedules", label: "Schedules", icon: Calendar },
    { href: "/admin/reports", label: "Reports", icon: FileText },
    { href: "/admin/sms", label: "SMS", icon: FileText },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ]

  const handleSignOut = async () => {
    setShowModal(false)
    setLoading(true)

    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        {/* Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 
          focus:px-4 focus:py-2 focus:bg-white focus:text-blue-600 focus:rounded-md"
        >
          Skip to content
        </a>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-blue-800 dark:bg-gray-800 
          text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>

            <button
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 dark:hover:bg-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 p-2 rounded-md transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-700 dark:bg-blue-600 text-white"
                      : "hover:bg-blue-700 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            {/* Sign Out Button */}
            <button
              onClick={() => setShowModal(true)}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left
              hover:bg-blue-700 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top Bar */}
          <header className="bg-white dark:bg-gray-800 shadow-sm z-10 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4">
              <button
                className="p-2 rounded-md lg:hidden hover:bg-gray-100 dark:hover:bg-gray-700 
                text-gray-600 dark:text-gray-300"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>

              <div className="flex items-center space-x-4">
                <SystemClock className="hidden md:block text-gray-600 dark:text-gray-300" />

                <div className="relative">
                  <AlertTriangle className="h-6 w-6 text-gray-500 dark:text-gray-400 hover:text-gray-700" />
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500" />
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    A
                  </div>
                  <span className="hidden md:inline-block font-medium text-gray-700 dark:text-gray-200">
                    Admin
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main id="main-content" className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>

      {/* SIGN OUT MODAL — FIXED OUTSIDE LAYOUT */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-80 text-center shadow-lg">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">
              Are you sure you want to sign out?
            </h3>

            <div className="flex justify-between space-x-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>

              <button
                onClick={handleSignOut}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  )
}
