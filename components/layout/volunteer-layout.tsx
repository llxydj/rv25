"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, AlertTriangle, User, X } from "lucide-react"
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SystemClock } from "@/components/system-clock"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
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
    return pathname === path
  }

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
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button className="p-1 rounded-md lg:hidden hover:bg-green-700" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            <Link
              href="/volunteer/dashboard"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/volunteer/dashboard") ? "bg-green-700 text-white" : "hover:bg-green-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/volunteer/incidents"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/volunteer/incidents") ? "bg-green-700 text-white" : "hover:bg-green-700"
              }`}
            >
              <Bell className="h-5 w-5" />
              <span>Assigned Incidents</span>
            </Link>

            <Link
              href="/volunteer/schedules"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/volunteer/schedules") ? "bg-green-700 text-white" : "hover:bg-green-700"
              }`}
            >
              <Calendar className="h-5 w-5" />
              <span>Schedules</span>
            </Link>

            <Link
              href="/volunteer/profile"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/volunteer/profile") ? "bg-green-700 text-white" : "hover:bg-green-700"
              }`}
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </Link>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 disabled:opacity-50"
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
          <header className="bg-white shadow-sm z-10">
            <div className="flex items-center justify-between p-4">
              <button className="p-1 rounded-md lg:hidden hover:bg-gray-200" onClick={() => setSidebarOpen(true)}>
                <X className="h-6 w-6 text-gray-700" />
              </button>

              <div className="flex items-center space-x-4">
                <SystemClock className="hidden md:block" />
                <div className="relative">
                  <Bell className="h-6 w-6 text-gray-500 cursor-pointer hover:text-gray-700" />
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                    V
                  </div>
                  <span className="hidden md:inline-block font-medium">Volunteer</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">{children}</main>
        </div>
      </div>
    </AuthLayout>
  )
}
