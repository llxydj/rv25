"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings } from "lucide-react"

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 