"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { createBarangayAccount } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function NewBarangayAccountPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [barangay, setBarangay] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError("You must be logged in as an admin to create a barangay account")
      return
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    
    if (!email.includes("@")) {
      setError("Please enter a valid email address")
      return
    }
    
    if (!firstName || !lastName) {
      setError("First name and last name are required")
      return
    }

    if (!barangay) {
      setError("Barangay is required")
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      const result = await createBarangayAccount(
        user.id,
        email,
        password,
        firstName,
        lastName,
        phone,
        barangay
      )
      
      if (result.success) {
        setSuccess("Barangay account created successfully!")
        // Clear form
        setEmail("")
        setPassword("")
        setConfirmPassword("")
        setFirstName("")
        setLastName("")
        setPhone("")
        setBarangay("")
        // Redirect to users list after a short delay
        setTimeout(() => {
          router.push("/admin/barangay")
        }, 1500)
      } else {
        setError(result.message || "Failed to create barangay account")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">Create Barangay Account</h1>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-green-700">{success}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div>
                <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">
                  Barangay
                </label>
                <select
                  id="barangay"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                >
                  <option value="">Select a barangay</option>
                  <option value="ZONE 1">Zone 1</option>
                  <option value="ZONE 2">Zone 2</option>
                  <option value="ZONE 3">Zone 3</option>
                  <option value="ZONE 4">Zone 4</option>
                  <option value="ZONE 4-A">Zone 4-A</option>
                  <option value="ZONE 5">Zone 5</option>
                  <option value="ZONE 6">Zone 6</option>
                  <option value="ZONE 7">Zone 7</option>
                  <option value="ZONE 8">Zone 8</option>
                  <option value="ZONE 9">Zone 9</option>
                  <option value="ZONE 10">Zone 10</option>
                  <option value="ZONE 11">Zone 11</option>
                  <option value="ZONE 12">Zone 12</option>
                  <option value="ZONE 14">Zone 14</option>
                  <option value="ZONE 14-A">Zone 14-A</option>
                  <option value="ZONE 15">Zone 15</option>
                  <option value="CONCEPCION">Concepcion</option>
                  <option value="MATAB-ANG">Matab-ang</option>
                  <option value="DOS HERMANAS">Dos Hermanas</option>
                  <option value="BUBOG">Bubog</option>
                  <option value="CABATANGAN">Cabatangan</option>
                  <option value="EFIGENIO LIZARES">Efigenio Lizares</option>
                  <option value="KATILINGBAN">Katilingban</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <LoadingSpinner size="sm" color="text-white" />
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
} 