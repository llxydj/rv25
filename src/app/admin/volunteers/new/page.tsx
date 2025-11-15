"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { createVolunteer } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle } from "lucide-react"

// Available skills for volunteers
const VOLUNTEER_SKILLS = [
  "FIRST AID",
  "FIREFIGHTING",
  "WATER RESCUE",
  "MEDICAL PROFESSIONAL",
  "SEARCH AND RESCUE",
  "EMERGENCY RESPONSE",
  "DRIVER",
  "COMMUNICATIONS",
  "LEADERSHIP",
  "COMMUNITY OUTREACH",
]

export default function NewVolunteerPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [barangay, setBarangay] = useState("")
  const [skills, setSkills] = useState<string[]>([])
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSkillChange = (skill: string) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter((s) => s !== skill))
    } else {
      setSkills([...skills, skill])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError("You must be logged in as an admin to create a volunteer account")
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
    
    try {
      setLoading(true)
      setError(null)
      
      const result = await createVolunteer({
        email,
        password,
        firstName,
        lastName,
        phone,
        address,
        barangay,
        adminId: user.id
      })
      
      if (result.success) {
        setSuccess("Volunteer created successfully!")
        // Redirect to the volunteer details page after a short delay
        setTimeout(() => {
          router.push(`/admin/volunteers`)
        }, 1500)
      } else {
        setError(result.message || "Failed to create volunteer")
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
          <div>
            <h1 className="text-2xl font-bold text-black">Add New Volunteer</h1>
            <p className="text-gray-600 mt-1">Create a new volunteer account</p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Account Information</h3>
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first-name"
                    id="first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last-name"
                    id="last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                    required
                  />
                </div>

                <div className="sm:col-span-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                    required
                    minLength={8}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirm-password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Contact Information</h3>
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">
                    Barangay
                  </label>
                  <input
                    type="text"
                    name="barangay"
                    id="barangay"
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md text-black"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Skills & Status</h3>
              <div className="mt-6 space-y-6">
                <fieldset>
                  <legend className="text-sm font-medium text-gray-700">Skills</legend>
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {VOLUNTEER_SKILLS.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => handleSkillChange(skill)}
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                            skills.includes(skill)
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-medium text-gray-700">Initial Status</legend>
                  <div className="mt-4">
                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="ACTIVE"
                          checked={status === "ACTIVE"}
                          onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Active</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="status"
                          value="INACTIVE"
                          checked={status === "INACTIVE"}
                          onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Inactive</span>
                      </label>
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Creating...</span>
                </>
              ) : (
                "Create Volunteer"
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
} 