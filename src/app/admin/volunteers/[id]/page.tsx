"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, User, FileText, Activity, GraduationCap, BarChart3, MapPin } from "lucide-react"
import { ProfileCompletenessIndicator } from "@/components/volunteer/profile-completeness-indicator"
import { TrainingHistory } from "@/components/volunteer/training-history"
import { IncidentHistory } from "@/components/volunteer/incident-history"
import { PerformanceMetrics } from "@/components/volunteer/performance-metrics"
import { UserWithVolunteerProfile } from "@/types/volunteer"

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
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'performance' | 'history' | 'training' | 'incidents'>('overview')

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

  // Auto-clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [success])

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
    const baseClass = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
    switch (status) {
      case "ACTIVE":
        return (
          <span className={`${baseClass} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300`}>
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className={`${baseClass} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300`}>
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className={`${baseClass} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300`}>
            Suspended
          </span>
        )
      default:
        return (
          <span className={`${baseClass} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300`}>
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
        <div className="flex justify-center py-12 p-4">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-800 p-4 m-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200 underline"
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
        <div className="text-center py-12 p-4">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Volunteer not found</p>
          <button
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
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
      <div className="space-y-4 md:space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
              Volunteer Profile
            </h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center px-3 md:px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2 flex-shrink-0" />
            Back to List
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-800 p-3 md:p-4">
            <div className="flex gap-2 md:gap-3">
              <div className="flex-shrink-0">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm text-green-700 dark:text-green-300">{success}</p>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="flex-shrink-0 text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-200"
                aria-label="Dismiss success message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
                {/* Avatar & Info */}
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-xl md:text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white truncate">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-1.5 md:gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 whitespace-nowrap">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 whitespace-nowrap">
                          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="hidden sm:inline">Last active: </span>
                          {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex sm:flex-col gap-2 sm:flex-shrink-0">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs md:text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
                      aria-label="Call volunteer"
                    >
                      <Phone className="h-3 w-3 md:h-4 md:w-4 sm:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Call</span>
                    </button>
                  )}
                  {volunteer.email && (
                    <button
                      onClick={handleEmailVolunteer}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs md:text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
                      aria-label="Email volunteer"
                    >
                      <Mail className="h-3 w-3 md:h-4 md:w-4 sm:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Email</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs md:text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
                    aria-label="Change volunteer status"
                  >
                    <Settings className="h-3 w-3 md:h-4 md:w-4 sm:mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">Change Status</span>
                  </button>
                </div>
              </div>

              {/* Contact & Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Contact Information
                  </h3>
                  <div className="space-y-2">
                    <p className="text-xs md:text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Email:</span>{" "}
                      <span className="text-gray-900 dark:text-white break-all">{volunteer.email}</span>
                    </p>
                    <p className="text-xs md:text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Phone:</span>{" "}
                      <span className="text-gray-900 dark:text-white">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-xs md:text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Address:</span>{" "}
                      <span className="text-gray-900 dark:text-white">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-xs md:text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Barangay:</span>{" "}
                      <span className="text-gray-900 dark:text-white">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Assigned Areas
                  </h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        {volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                          <span
                            key={barangay}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                          >
                            {barangay}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Skills & Availability */}
              <div className="mt-6">
                <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Skills & Availability
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="mt-6">
                <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Performance & Activity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 md:p-4 rounded-md">
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Incidents Resolved</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 md:p-4 rounded-md">
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Member Since</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 md:p-4 rounded-md">
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Last Activity</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {volunteer.volunteer_profiles?.bio && (
                <div className="mt-6">
                  <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Bio / Description
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-3 md:p-4 rounded-md">
                    <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                      {volunteer.volunteer_profiles.bio}
                    </p>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Admin Notes
                  </h3>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 md:p-4 rounded-md">
                    <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                      {volunteer.volunteer_profiles.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabbed Interface */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mt-4 md:mt-6">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex -mb-px overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'overview'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Overview
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('performance')}
                    className={`px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'performance'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Performance
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('training')}
                    className={`px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'training'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Training
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('incidents')}
                    className={`px-4 py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'incidents'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Incidents
                    </div>
                  </button>
                </nav>
              </div>

              <div className="p-4 md:p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Profile Completeness */}
                    {volunteer && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Profile Completeness</h3>
                        <ProfileCompletenessIndicator 
                          profile={volunteer as UserWithVolunteerProfile} 
                          showDetails={true} 
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'performance' && id && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
                    <PerformanceMetrics volunteerId={id as string} />
                  </div>
                )}

                {activeTab === 'training' && id && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Training History</h3>
                    <TrainingHistory volunteerId={id as string} />
                  </div>
                )}

                {activeTab === 'incidents' && id && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Incident History</h3>
                    <IncidentHistory volunteerId={id as string} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-4 md:space-y-6">
            {/* Account Info Card */}
            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Account Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                  <p className="text-xs md:text-sm text-gray-900 dark:text-white break-all">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Account Created</p>
                  <p className="text-xs md:text-sm text-gray-900 dark:text-white">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
                  <p className="text-xs md:text-sm text-gray-900 dark:text-white">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Created By</p>
                    <p className="text-xs md:text-sm text-gray-900 dark:text-white break-all">
                      Admin (ID: {volunteer.volunteer_profiles.created_by})
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Completeness Card */}
            {volunteer && (
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                <ProfileCompletenessIndicator 
                  profile={volunteer as UserWithVolunteerProfile} 
                  compact={true}
                />
              </div>
            )}

            {/* Actions Card */}
            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-xs md:text-sm font-medium rounded-md transition-colors ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 dark:border-green-800 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-xs md:text-sm font-medium rounded-md transition-colors ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-xs md:text-sm font-medium rounded-md transition-colors ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Change Modal */}
        {showStatusModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowStatusModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-modal-title"
          >
            <div
              className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="status-modal-title" className="text-base md:text-lg font-medium text-gray-900 dark:text-white mb-4">
                Change Volunteer Status
              </h3>
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="active"
                    name="status"
                    value="ACTIVE"
                    checked={selectedStatus === "ACTIVE"}
                    onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                    className="h-4 w-4 text-green-600 dark:text-green-500 focus:ring-green-500 dark:focus:ring-green-400"
                  />
                  <label htmlFor="active" className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="inactive"
                    name="status"
                    value="INACTIVE"
                    checked={selectedStatus === "INACTIVE"}
                    onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                    className="h-4 w-4 text-gray-600 dark:text-gray-500 focus:ring-gray-500 dark:focus:ring-gray-400"
                  />
                  <label htmlFor="inactive" className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                    Inactive
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id="suspended"
                    name="status"
                    value="SUSPENDED"
                    checked={selectedStatus === "SUSPENDED"}
                    onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                    className="h-4 w-4 text-red-600 dark:text-red-500 focus:ring-red-500 dark:focus:ring-red-400"
                  />
                  <label htmlFor="suspended" className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                    Suspended
                  </label>
                </div>
              </div>
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleStatusChange(selectedStatus)
                    setShowStatusModal(false)
                  }}
                  disabled={updating}
                  className="w-full sm:w-auto px-4 py-2 text-xs md:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}