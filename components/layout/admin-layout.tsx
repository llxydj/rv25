"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, User, Users, X } from "lucide-react"
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
  const pathname = usePathname()
  const router = useRouter()

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
    if (!pathname) return false
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-background">
        {/* Skip link for keyboard users */}
        <a href="#main-content" className="skip-link">Skip to content</a>
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-sidebar text-sidebar-foreground transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Admin sidebar"
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              aria-expanded={sidebarOpen}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/admin/dashboard") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white" : "hover:bg-blue-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white" : "hover:bg-blue-700"
              }`}
            >
              <User className="h-5 w-5" />
              <span>Volunteers</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/admin/users") ? "bg-blue-700 text-white" : "hover:bg-blue-700"
              }`}
            >
              <Users className="h-5 w-5" />
              <span>User Management</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white" : "hover:bg-blue-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/admin/reports") ? "bg-blue-700 text-white" : "hover:bg-blue-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Reports</span>
            </Link>

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/admin/settings") ? "bg-blue-700 text-white" : "hover:bg-blue-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Settings</span>
            </Link>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-sidebar-accent disabled:opacity-50"
              aria-label="Sign out"
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
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top navbar */}
          <header className="bg-card shadow-sm z-10">
            <div className="flex items-center justify-between p-4">
              <button className="p-1 rounded-md lg:hidden hover:bg-muted" onClick={() => setSidebarOpen(true)}>
                <X className="h-6 w-6 text-foreground" />
              </button>

              <div className="flex items-center space-x-4">
                <SystemClock className="hidden md:block" />
                <div className="relative">
                  <AlertTriangle className="h-6 w-6 text-muted-foreground cursor-pointer hover:text-foreground" />
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                    A
                  </div>
                  <span className="hidden md:inline-block font-medium text-foreground">Admin</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main id="main-content" className="flex-1 overflow-y-auto p-4">{children}</main>
        </div>
      </div>
    </AuthLayout>
  )
}
