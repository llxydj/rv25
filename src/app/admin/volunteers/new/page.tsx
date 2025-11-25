"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react"

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

interface CreateVolunteerPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  barangay: string
  password: string
  skills: string[]
  status: "ACTIVE" | "INACTIVE"
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Phone validation (Philippine format - optional)
const PHONE_REGEX = /^(\+63|0)?[0-9]{10,11}$/

export default function NewVolunteerPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Form state - all text stored in UPPERCASE (except email)
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

  // Barangay dropdown state
  const [barangayOptions, setBarangayOptions] = useState<string[]>([])
  const [barangayLoading, setBarangayLoading] = useState(false)

  // Authorization check (optional - uncomment if needed)
  // useEffect(() => {
  //   if (!user || user.role !== "ADMIN") {
  //     router.push("/unauthorized")
  //   }
  // }, [user, router])

  useEffect(() => {
    const fetchBarangays = async () => {
      setBarangayLoading(true)
      try {
        const res = await fetch("/api/barangays")
        const data = await res.json()
        
        // Handle both formats: array directly OR { data: array }
        const barangayList = Array.isArray(data) ? data : data?.data
        
        if (res.ok && Array.isArray(barangayList)) {
          // Sort alphabetically for better UX
          const sorted = barangayList
            .map((b: any) => (typeof b === 'string' ? b : b.name).toUpperCase())
            .sort((a: string, b: string) => a.localeCompare(b))
          setBarangayOptions(sorted)
        } else {
          console.error("Failed to fetch barangays", data)
        }
      } catch (err) {
        console.error("Error fetching barangays:", err)
      } finally {
        setBarangayLoading(false)
      }
    }
    fetchBarangays()
  }, [])

  const handleSkillChange = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    )
  }

  const validateForm = (): string | null => {
    if (!firstName.trim()) return "First name is required"
    if (!lastName.trim()) return "Last name is required"
    if (!email.trim()) return "Email is required"
    if (!EMAIL_REGEX.test(email.trim())) return "Please enter a valid email address"
    if (!barangay) return "Please select a barangay"
    if (!password) return "Password is required"
    if (password.length < 8) return "Password must be at least 8 characters"
    if (password !== confirmPassword) return "Passwords do not match"
    // Optional: Phone validation (only if provided)
    if (phone.trim() && !PHONE_REGEX.test(phone.replace(/[\s-]/g, ""))) {
      return "Please enter a valid phone number"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setShowErrorModal(true)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const payload: CreateVolunteerPayload = {
        firstName: firstName.trim(), // Already uppercase from input
        lastName: lastName.trim(),   // Already uppercase from input
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),     // Already uppercase from input
        barangay: barangay,          // Already uppercase from options
        password,
        skills,
        status,
      }

      const response = await fetch("/api/admin/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to create volunteer")
      }

      setSuccess("Volunteer created successfully!")
      setShowSuccessModal(true)

      setTimeout(() => {
        router.push("/admin/volunteers")
      }, 2000)
    } catch (err: any) {
      console.error("Error:", err)
      setError(err.message || "An unexpected error occurred")
      setShowErrorModal(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Add New Volunteer
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Create a new volunteer account
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Account Information */}
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Account Information
                </h3>
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  {/* First Name */}
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="first-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm uppercase"
                      placeholder="JUAN"
                      autoComplete="given-name"
                    />
                  </div>

                  {/* Last Name */}
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="last-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value.toUpperCase())}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm uppercase"
                      placeholder="DELA CRUZ"
                      autoComplete="family-name"
                    />
                  </div>

                  {/* Email */}
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toLowerCase())}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm lowercase"
                      placeholder="volunteer@example.com"
                      autoComplete="email"
                    />
                  </div>

                  {/* Password */}
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Minimum 8 characters
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="confirm-password"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Contact Information
                </h3>
                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  {/* Phone */}
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      placeholder="09171234567"
                      autoComplete="tel"
                    />
                  </div>

                  {/* Barangay */}
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="barangay"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Barangay <span className="text-red-500">*</span>
                    </label>
                    {barangayLoading ? (
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <LoadingSpinner size="sm" color="text-gray-400" />
                        <span className="ml-2">Loading barangays...</span>
                      </div>
                    ) : (
                      <select
                        id="barangay"
                        value={barangay}
                        onChange={(e) => setBarangay(e.target.value)}
                        disabled={barangayLoading}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-describedby="barangay-description"
                      >
                        <option value="">Select Barangay</option>
                        {barangayOptions.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Address */}
                  <div className="sm:col-span-6">
                    <label
                      htmlFor="address"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value.toUpperCase())}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm uppercase"
                      placeholder="123 RIZAL STREET"
                      autoComplete="street-address"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Skills & Status */}
            <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Skills & Status
                </h3>
                <div className="mt-6 space-y-6">
                  {/* Skills */}
                  <fieldset>
                    <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Skills
                    </legend>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Select all applicable skills
                    </p>
                    <div className="mt-4" role="group" aria-label="Volunteer skills">
                      <div className="flex flex-wrap gap-2">
                        {VOLUNTEER_SKILLS.map((skill) => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => handleSkillChange(skill)}
                            aria-pressed={skills.includes(skill)}
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 ${
                              skills.includes(skill)
                                ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-2 border-red-500"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-2 border-transparent"
                            }`}
                          >
                            {skills.includes(skill) && (
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  </fieldset>

                  {/* Status */}
                  <fieldset>
                    <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Initial Status
                    </legend>
                    <div className="mt-4">
                      <div className="flex items-center space-x-6">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value="ACTIVE"
                            checked={status === "ACTIVE"}
                            onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                            className="h-4 w-4 text-red-600 border-gray-300 dark:border-gray-600 focus:ring-red-500 dark:bg-gray-700"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Active
                          </span>
                        </label>
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            value="INACTIVE"
                            checked={status === "INACTIVE"}
                            onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                            className="h-4 w-4 text-red-600 border-gray-300 dark:border-gray-600 focus:ring-red-500 dark:bg-gray-700"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Inactive
                          </span>
                        </label>
                      </div>
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || barangayLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" color="text-white" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  "Create Volunteer"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="error-title"
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
              <h2 id="error-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Error
              </h2>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{error}</p>
            <button
              onClick={() => setShowErrorModal(false)}
              className="mt-4 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors"
              autoFocus
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
              <h2 id="success-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Success!
              </h2>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{success}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Redirecting to volunteers list...
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}