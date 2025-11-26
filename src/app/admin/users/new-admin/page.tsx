"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { createAdminAccount } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"

export default function NewAdminAccountPage() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!user) {
      const errorMsg = "You must be logged in as an admin to create an admin account"
      setError(errorMsg)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      })
      return
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      const errorMsg = "Please enter a valid email address"
      setError(errorMsg)
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive"
      })
      return
    }
    
    if (password !== confirmPassword) {
      const errorMsg = "Passwords do not match"
      setError(errorMsg)
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive"
      })
      return
    }
    
    if (password.length < 8) {
      const errorMsg = "Password must be at least 8 characters"
      setError(errorMsg)
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive"
      })
      return
    }
    
    if (!firstName.trim() || !lastName.trim()) {
      const errorMsg = "First name and last name are required"
      setError(errorMsg)
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive"
      })
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      
      const result = await createAdminAccount(
        user.id,
        email.trim().toLowerCase(),
        password,
        firstName.trim(),
        lastName.trim(),
        phone.trim() || ""
      )
      
      if (!result.success) {
        const errorMsg = result.message || "Failed to create admin account"
        setError(errorMsg)
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive"
        })
        return
      }
      
      // Success
      const successMsg = "Admin account created successfully!"
      setSuccess(successMsg)
      toast({
        title: "Success",
        description: successMsg,
      })
      
      // Clear form
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setFirstName("")
      setLastName("")
      setPhone("")
      
      // Redirect to users list after a short delay
      setTimeout(() => {
        router.push("/admin/users")
      }, 2000)
    } catch (err: any) {
      const errorMsg = err.message || "An unexpected error occurred"
      setError(errorMsg)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">Create Admin Account</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">New Administrator</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Create a new administrator account. The new admin will have full access to the system.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">Error</p>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">Success</p>
                      <p className="text-sm text-green-700 mt-1">{success}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    className="text-gray-900"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    className="text-gray-900"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long</p>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    minLength={8}
                    className="text-gray-900"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    id="first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    className="text-gray-900"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    id="last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    className="text-gray-900"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+63 912 345 6789"
                    className="text-gray-900"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                  className="text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" color="text-white" />
                      <span className="ml-2">Creating...</span>
                    </>
                  ) : (
                    "Create Admin Account"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}