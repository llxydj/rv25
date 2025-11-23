"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, LogOut } from "lucide-react"
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SystemClock } from "@/components/system-clock"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export const ResidentLayout: React.FC<ResidentLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (path: string) => pathname === path

  const handleEmergencyCall = () => {
    window.location.href = "tel:09998064555"
  }

  const handleSignOut = async () => {
    setShowModal(false) // close modal
    setLoading(true)

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      setLoading(false)
      alert("Sign out took too long. Please try again.")
    }, 8000) // 8s timeout

    try {
      const result = await signOut({ signal: controller.signal })
      clearTimeout(timeoutId)
      if (result.success) {
        router.push("/login")
      } else {
        setLoading(false)
        alert(result.message || "Failed to sign out.")
      }
    } catch (err: any) {
      setLoading(false)
      alert(err.message || "Failed to sign out.")
    }
  }

  return (
    <AuthLayout allowedRoles={["resident"]}>
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
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button className="p-1 rounded-md lg:hidden hover:bg-red-700" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            <Link
              href="/resident/dashboard"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/resident/dashboard") ? "bg-red-700 text-white" : "hover:bg-red-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/resident/report"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/resident/report") ? "bg-red-700 text-white" : "hover:bg-red-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Report Incident</span>
            </Link>

            <Link
              href="/resident/history"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/resident/history") ? "bg-red-700 text-white" : "hover:bg-red-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Report History</span>
            </Link>

            <Link
              href="/resident/profile"
              className={`flex items-center space-x-2 p-2 rounded-md ${
                isActive("/resident/profile") ? "bg-red-700 text-white" : "hover:bg-red-700"
              }`}
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </Link>

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={() => setShowModal(true)}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50"
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
                <button
                  onClick={handleEmergencyCall}
                  className="bg-red-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 hover:bg-red-500 md:hidden"
                >
                  <Phone className="h-5 w-5" />
                  <span>Emergency</span>
                </button>

                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                    R
                  </div>
                  <span className="hidden md:inline-block font-medium">Resident</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">{children}</main>
        </div>

        {/* Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 w-80 text-center">
              <h3 className="text-lg font-semibold mb-4">Are you sure you want to sign out?</h3>
              <div className="flex justify-between space-x-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
