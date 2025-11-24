"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getAllVolunteers, updateVolunteerStatus } from "@/lib/volunteers"
import { getVolunteerIncidents } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import {
  AlertTriangle,
  CheckCircle,
  Plus,
  User,
  Search,
  X,
  Eye,
  UserCheck,
  UserX,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
} from "lucide-react"
import { UserWithVolunteerProfile, VolunteerStatus } from "@/types/volunteer"

// Pagination settings
const ITEMS_PER_PAGE = 10

export default function AdminVolunteersPage() {
  const { user } = useAuth()
  const [volunteers, setVolunteers] = useState<UserWithVolunteerProfile[]>([])
  const [filteredVolunteers, setFilteredVolunteers] = useState<UserWithVolunteerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("ALL")
  const [searchTerm, setSearchTerm] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailVolunteer, setDetailVolunteer] = useState<UserWithVolunteerProfile | null>(null)
  const [detailIncidents, setDetailIncidents] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  // Fetch volunteers on mount
  useEffect(() => {
    const fetchVolunteers = async () => {
      if (!user) return
      try {
        setLoading(true)
        const result = await getAllVolunteers()
        if (result.success && result.data) {
          setVolunteers(result.data)
          setFilteredVolunteers(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteers")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }
    fetchVolunteers()
  }, [user])

  // Filter volunteers based on status, availability and search term
  useEffect(() => {
    let filtered = [...volunteers]

    // Apply status filter
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(
        (v) => v.volunteer_profiles?.status === statusFilter
      )
    }

    // Apply availability filter
    if (availabilityFilter !== "ALL") {
      const isAvailable = availabilityFilter === "AVAILABLE"
      filtered = filtered.filter(
        (v) => (v.volunteer_profiles?.is_available ?? false) === isAvailable
      )
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (v) =>
          v.first_name?.toLowerCase().includes(search) ||
          v.last_name?.toLowerCase().includes(search) ||
          v.email?.toLowerCase().includes(search) ||
          v.barangay?.toLowerCase().includes(search)
      )
    }

    setFilteredVolunteers(filtered)
    setCurrentPage(1) // Reset to first page on filter change
  }, [volunteers, statusFilter, availabilityFilter, searchTerm])

  // Pagination calculations
  const totalPages = Math.ceil(filteredVolunteers.length / ITEMS_PER_PAGE)
  const paginatedVolunteers = filteredVolunteers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Handle status change
  const handleStatusChange = useCallback(
    async (volunteerId: string, newStatus: VolunteerStatus) => {
      if (!user || updatingStatus) return

      try {
        setUpdatingStatus(volunteerId)
        setError(null)

        const result = await updateVolunteerStatus(volunteerId, newStatus, user.id)

        if (result.success) {
          // Update local state
          setVolunteers((prev) =>
            prev.map((v) =>
              v.id === volunteerId
                ? {
                    ...v,
                    volunteer_profiles: v.volunteer_profiles
                      ? { ...v.volunteer_profiles, status: newStatus }
                      : {
                          volunteer_user_id: volunteerId,
                          admin_user_id: user.id,
                          status: newStatus,
                          skills: [],
                          availability: [],
                          assigned_barangays: [],
                          total_incidents_resolved: 0,
                          notes: null,
                          is_available: false,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                          last_status_change: new Date().toISOString(),
                          last_status_changed_by: user.id,
                        },
                  }
                : v
            )
          )
          setSuccess(`Volunteer status updated to ${newStatus}`)
        } else {
          setError(result.message || "Failed to update status")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setUpdatingStatus(null)
      }
    },
    [user, updatingStatus]
  )

  // Open volunteer details modal
  const openVolunteerDetails = async (volunteer: UserWithVolunteerProfile) => {
    setDetailVolunteer(volunteer)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailIncidents([])

    try {
      const history = await getVolunteerIncidents(volunteer.id)
      if (history.success) {
        setDetailIncidents(history.data || [])
      } else {
        setDetailError(history.message || "Failed to load history")
      }
    } catch (err: any) {
      setDetailError(err?.message || "Failed to load history")
    } finally {
      setDetailLoading(false)
    }
  }

  // Close detail modal
  const closeDetailModal = () => {
    setDetailOpen(false)
    setDetailVolunteer(null)
    setDetailIncidents([])
    setDetailError(null)
  }

  // Get status badge styling
  const getStatusBadgeClass = (status?: string | null) => {
    const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
    switch (status) {
      case "ACTIVE":
        return `${base} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300`
      case "INACTIVE":
        return `${base} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300`
      case "SUSPENDED":
        return `${base} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300`
      default:
        return `${base} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300`
    }
  }

  // Get availability badge
  const getAvailabilityBadgeClass = (isAvailable?: boolean) => {
    const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
    return isAvailable
      ? `${base} bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300`
      : `${base} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400`
  }

  return (
    <AdminLayout>
      <div className="space-y-4 md:space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
              Volunteers
            </h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage volunteer accounts and status
            </p>
          </div>
          <Link
            href="/admin/volunteers/new"
            className="inline-flex items-center justify-center px-3 md:px-4 py-2 border border-transparent text-xs md:text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-900 transition-colors active:scale-[0.98] whitespace-nowrap"
          >
            <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span>Add Volunteer</span>
          </Link>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-xs md:text-sm text-green-800 dark:text-green-300 flex-1 min-w-0">{success}</p>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 flex-shrink-0"
                aria-label="Dismiss success message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-xs md:text-sm text-red-800 dark:text-red-300 flex-1 min-w-0">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 flex-shrink-0"
                aria-label="Dismiss error message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Search */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="search" className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 md:h-4 md:w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-8 md:pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs md:text-sm"
                  placeholder="Name, email, barangay..."
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status" className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs md:text-sm"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            {/* Availability Filter */}
            <div>
              <label htmlFor="availability" className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Availability
              </label>
              <select
                id="availability"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs md:text-sm"
              >
                <option value="ALL">All</option>
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </div>

            {/* Results count */}
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium">{paginatedVolunteers.length}</span> of{" "}
                <span className="font-medium">{filteredVolunteers.length}</span> volunteers
              </p>
            </div>
          </div>
        </div>

        {/* Volunteers List */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-8 md:p-12 flex justify-center">
              <LoadingSpinner size="lg" text="Loading volunteers..." />
            </div>
          ) : filteredVolunteers.length === 0 ? (
            <div className="p-8 md:p-12 text-center">
              <User className="h-10 w-10 md:h-12 md:w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3 md:mb-4" />
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium">
                No volunteers found
              </p>
              <p className="text-xs md:text-sm text-gray-400 dark:text-gray-500 mt-1">
                Try adjusting your filters or add a new volunteer
              </p>
            </div>
          ) : (
            <>
              <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedVolunteers.map((volunteer) => (
                  <li key={volunteer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="px-3 py-3 md:px-4 md:py-4 lg:px-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
                        {/* Volunteer Info */}
                        <Link
                          href={`/admin/volunteers/${volunteer.id}`}
                          className="flex items-center min-w-0 flex-1 group"
                        >
                          <div className="flex-shrink-0">
                            <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center group-hover:bg-gray-300 dark:group-hover:bg-gray-500 transition-colors">
                              <User className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                            </div>
                          </div>
                          <div className="ml-3 md:ml-4 min-w-0 flex-1">
                            <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                              {volunteer.first_name} {volunteer.last_name}
                            </p>
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                              {volunteer.email}
                            </p>
                            {volunteer.barangay && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center">
                                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{volunteer.barangay}</span>
                              </p>
                            )}
                          </div>
                        </Link>

                        {/* Status & Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 sm:flex-nowrap">
                          {/* Availability Badge */}
                          <span className={getAvailabilityBadgeClass(volunteer.volunteer_profiles?.is_available)}>
                            {volunteer.volunteer_profiles?.is_available ? "Available" : "Unavailable"}
                          </span>

                          {/* Status Badge */}
                          <span className={getStatusBadgeClass(volunteer.volunteer_profiles?.status)}>
                            {volunteer.volunteer_profiles?.status || "No Profile"}
                          </span>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            {/* Quick View */}
                            <button
                              onClick={() => openVolunteerDetails(volunteer)}
                              className="p-1.5 md:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors active:scale-95"
                              title="Quick View"
                              aria-label={`View details for ${volunteer.first_name} ${volunteer.last_name}`}
                            >
                              <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </button>

                            {/* Status Actions */}
                            {volunteer.volunteer_profiles?.status === "INACTIVE" && (
                              <button
                                onClick={() => handleStatusChange(volunteer.id, "ACTIVE")}
                                disabled={updatingStatus === volunteer.id}
                                className="p-1.5 md:p-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                title="Activate"
                                aria-label={`Activate ${volunteer.first_name} ${volunteer.last_name}`}
                              >
                                {updatingStatus === volunteer.id ? (
                                  <LoadingSpinner size="sm" color="text-green-600 dark:text-green-400" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                )}
                              </button>
                            )}

                            {volunteer.volunteer_profiles?.status === "ACTIVE" && (
                              <button
                                onClick={() => handleStatusChange(volunteer.id, "SUSPENDED")}
                                disabled={updatingStatus === volunteer.id}
                                className="p-1.5 md:p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                title="Suspend"
                                aria-label={`Suspend ${volunteer.first_name} ${volunteer.last_name}`}
                              >
                                {updatingStatus === volunteer.id ? (
                                  <LoadingSpinner size="sm" color="text-red-600 dark:text-red-400" />
                                ) : (
                                  <UserMinus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                )}
                              </button>
                            )}

                            {volunteer.volunteer_profiles?.status === "SUSPENDED" && (
                              <button
                                onClick={() => handleStatusChange(volunteer.id, "ACTIVE")}
                                disabled={updatingStatus === volunteer.id}
                                className="p-1.5 md:p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                title="Reactivate"
                                aria-label={`Reactivate ${volunteer.first_name} ${volunteer.last_name}`}
                              >
                                {updatingStatus === volunteer.id ? (
                                  <LoadingSpinner size="sm" color="text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <UserX className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                )}
                              </button>
                            )}

                            {!volunteer.volunteer_profiles && (
                              <button
                                onClick={() => handleStatusChange(volunteer.id, "INACTIVE")}
                                disabled={updatingStatus === volunteer.id}
                                className="p-1.5 md:p-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                title="Create Profile"
                                aria-label={`Create profile for ${volunteer.first_name} ${volunteer.last_name}`}
                              >
                                {updatingStatus === volunteer.id ? (
                                  <LoadingSpinner size="sm" color="text-yellow-600 dark:text-yellow-400" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-3 py-3 md:px-4 md:py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 text-center sm:text-left">
                    Page <span className="font-medium">{currentPage}</span> of{" "}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                  <div className="flex gap-2 justify-center sm:justify-end">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick View Modal */}
        {detailOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 md:p-4"
            onClick={closeDetailModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 id="modal-title" className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {detailVolunteer
                      ? `${detailVolunteer.first_name} ${detailVolunteer.last_name}`
                      : "Volunteer Details"}
                  </h2>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                    {detailVolunteer?.email}
                  </p>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              {detailVolunteer && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                  {/* Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 md:p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                        Contact
                      </p>
                      <p className="text-xs md:text-sm text-gray-900 dark:text-white mt-1 truncate">
                        {detailVolunteer.email}
                      </p>
                      <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center mt-1">
                        <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{detailVolunteer.phone_number || "No phone"}</span>
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 md:p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                        Location
                      </p>
                      <p className="text-xs md:text-sm text-gray-900 dark:text-white mt-1 flex items-center">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{detailVolunteer.barangay || "Unassigned"}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 md:gap-2">
                        <span className={getAvailabilityBadgeClass(detailVolunteer.volunteer_profiles?.is_available)}>
                          {detailVolunteer.volunteer_profiles?.is_available ? "Available" : "Unavailable"}
                        </span>
                        <span className={getStatusBadgeClass(detailVolunteer.volunteer_profiles?.status)}>
                          {detailVolunteer.volunteer_profiles?.status || "No Profile"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 md:p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
                        Resolved Incidents
                      </p>
                      <p className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mt-1">
                        {detailVolunteer.volunteer_profiles?.total_incidents_resolved ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Skills */}
                  {detailVolunteer.volunteer_profiles?.skills && detailVolunteer.volunteer_profiles.skills.length > 0 && (
                    <div>
                      <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        {detailVolunteer.volunteer_profiles.skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Assignments */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white">
                        Recent Assignments
                      </p>
                      <Link
                        href={`/admin/volunteers/${detailVolunteer.id}`}
                        className="text-xs md:text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 font-medium whitespace-nowrap"
                      >
                        View full profile →
                      </Link>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {detailLoading ? (
                        <div className="py-8 flex justify-center">
                          <LoadingSpinner size="md" text="Loading incidents..." />
                        </div>
                      ) : detailError ? (
                        <div className="py-4 px-4 text-center text-xs md:text-sm text-red-600 dark:text-red-400">
                          {detailError}
                        </div>
                      ) : detailIncidents.length === 0 ? (
                        <div className="py-8 text-center text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          No incident history yet
                        </div>
                      ) : (
                        <div className="overflow-x-auto max-h-64">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs md:text-sm">
                            <caption className="sr-only">Volunteer incident history</caption>
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                              <tr>
                                <th className="px-3 md:px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                                  Incident
                                </th>
                                <th className="px-3 md:px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                                  Barangay
                                </th>
                                <th className="px-3 md:px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                                  Status
                                </th>
                                <th className="px-3 md:px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                                  Date
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                              {detailIncidents.slice(0, 10).map((incident: any) => (
                                <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  <td className="px-3 md:px-4 py-2 text-gray-900 dark:text-white">
                                    {incident.incident_type || "Unnamed"}
                                  </td>
                                  <td className="px-3 md:px-4 py-2 text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                                    {incident.barangay || "—"}
                                  </td>
                                  <td className="px-3 md:px-4 py-2">
                                    <span className={getStatusBadgeClass(incident.status)}>
                                      {incident.status || "Unknown"}
                                    </span>
                                  </td>
                                  <td className="px-3 md:px-4 py-2 text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                                    {incident.created_at
                                      ? new Date(incident.created_at).toLocaleDateString()
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-end gap-2 md:gap-3">
                <button
                  onClick={closeDetailModal}
                  className="px-4 py-2 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors active:scale-[0.98]"
                >
                  Close
                </button>
                {detailVolunteer && (
                  <Link
                    href={`/admin/volunteers/${detailVolunteer.id}`}
                    className="px-4 py-2 text-xs md:text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 rounded-md transition-colors text-center active:scale-[0.98]"
                  >
                    View Full Profile
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}