"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getAllVolunteers, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, CheckCircle, Filter, Plus, User } from "lucide-react"
import { UserWithVolunteerProfile, VolunteerStatus } from "@/types/volunteer"
import { getVolunteerIncidents } from "@/lib/incidents"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function AdminVolunteersPage() {
  const { user } = useAuth()
  const [volunteers, setVolunteers] = useState<UserWithVolunteerProfile[]>([])
  const [filteredVolunteers, setFilteredVolunteers] = useState<UserWithVolunteerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("ALL")
  const [searchTerm, setSearchTerm] = useState("")
  const [creatingProfile, setCreatingProfile] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailVolunteer, setDetailVolunteer] = useState<UserWithVolunteerProfile | null>(null)
  const [detailIncidents, setDetailIncidents] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVolunteers = async () => {
      if (!user) return

      try {
        setLoading(true)
        const result = await getAllVolunteers()

        if (result.success) {
          setVolunteers(result.data || [])
          setFilteredVolunteers(result.data || [])
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
        volunteer => volunteer.volunteer_profiles?.status === statusFilter
      )
    }

    // Apply availability filter
    if (availabilityFilter !== "ALL") {
      filtered = filtered.filter(
        volunteer => volunteer.volunteer_profiles?.is_available === (availabilityFilter === "AVAILABLE")
      )
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(
        volunteer =>
          volunteer.first_name?.toLowerCase().includes(search) ||
          volunteer.last_name?.toLowerCase().includes(search) ||
          volunteer.email?.toLowerCase().includes(search)
      )
    }

    setFilteredVolunteers(filtered)
  }, [volunteers, statusFilter, availabilityFilter, searchTerm])

  const handleStatusChange = async (volunteerId: string, newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user) return

    try {
      setUpdatingStatus(volunteerId)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteerId, newStatus, user.id)

      if (result.success) {
        // Update the local state with proper type handling
        setVolunteers(
          volunteers.map((volunteer) => {
            if (volunteer.id === volunteerId) {
              return {
                ...volunteer,
                volunteer_profiles: {
                  ...volunteer.volunteer_profiles,
                  status: newStatus,
                  volunteer_user_id: volunteer.volunteer_profiles?.volunteer_user_id || volunteerId,
                },
              } as UserWithVolunteerProfile
            }
            return volunteer
          }),
        )

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleCreateProfile = async (volunteerId: string) => {
    if (!user) return

    try {
      setCreatingProfile(volunteerId)
      setError(null)
      setSuccess(null)

      // Create a default profile for the volunteer
      const result = await updateVolunteerStatus(volunteerId, "INACTIVE", user.id)

      if (result.success) {
        // Update the local state
        setVolunteers(
          volunteers.map((volunteer) => {
            if (volunteer.id === volunteerId) {
              const now = new Date().toISOString()
              return {
                ...volunteer,
                volunteer_profiles: {
                  volunteer_user_id: volunteerId,
                  admin_user_id: user.id,
                  status: "INACTIVE",
                  skills: [],
                  availability: [],
                  assigned_barangays: [],
                  total_incidents_resolved: 0,
                  notes: "",
                  is_available: false,
                  created_at: now,
                  updated_at: now,
                  last_status_change: now,
                  last_status_changed_by: user.id
                },
              } as UserWithVolunteerProfile
            }
            return volunteer
          }),
        )

        setSuccess("Volunteer profile created successfully")
      } else {
        setError(result.message || "Failed to create volunteer profile")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setCreatingProfile(null)
    }
  }

  const handleActivateVolunteer = async (volunteerId: string) => {
    if (!user) return;
    
    try {
      setUpdatingStatus(volunteerId);
      setError(null);
      setSuccess(null);
      
      const result = await updateVolunteerStatus(volunteerId, "ACTIVE", user.id);
      
      if (result.success) {
        // Update local state
        setVolunteers(
          volunteers.map((volunteer) => {
            if (volunteer.id === volunteerId) {
              return {
                ...volunteer,
                volunteer_profiles: {
                  ...volunteer.volunteer_profiles,
                  status: "ACTIVE",
                  volunteer_user_id: volunteer.volunteer_profiles?.volunteer_user_id || volunteerId,
                },
              } as UserWithVolunteerProfile;
            }
            return volunteer;
          })
        );
        
        setSuccess("Volunteer activated successfully");
      } else {
        setError(result.message || "Failed to activate volunteer");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openVolunteerDetails = async (volunteer: UserWithVolunteerProfile) => {
    setDetailVolunteer(volunteer)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const history = await getVolunteerIncidents(volunteer.id)
      if (!history.success) {
        setDetailError(history.message || "Failed to load volunteer history")
        setDetailIncidents([])
      } else {
        setDetailIncidents(history.data || [])
      }
    } catch (err: any) {
      setDetailError(err?.message || "Failed to load volunteer history")
      setDetailIncidents([])
    } finally {
      setDetailLoading(false)
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Volunteers</h1>
            <Link
              href="/admin/volunteers/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
            <Plus className="h-5 w-5 mr-2" />
            Add Volunteer
            </Link>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 text-black">
              Search
            </label>
              <input
                type="text"
              id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm text-black"
              placeholder="Search by name or email"
            />
              </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 text-black">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm text-black"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <div>
            <label htmlFor="availability" className="block text-sm font-medium text-gray-700 text-black">
              Availability
            </label>
            <select
              id="availability"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm text-black"
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </div>
          </div>

        {/* Volunteers List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-4 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border-l-4 border-red-400">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <p className="ml-3 text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : filteredVolunteers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No volunteers found</div>
          ) : (
            <ul role="list" className="divide-y divide-gray-200">
                  {filteredVolunteers.map((volunteer) => (
                <li key={volunteer.id}>
                  <Link href={`/admin/volunteers/${volunteer.id}`}>
                    <div className="block hover:bg-gray-50">
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <User className="h-8 w-8 rounded-full bg-gray-200 p-1" />
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-900">
                            {volunteer.first_name} {volunteer.last_name}
                              </p>
                              <p className="text-sm text-gray-500">{volunteer.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* Availability Badge */}
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                volunteer.volunteer_profiles?.is_available
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {volunteer.volunteer_profiles?.is_available ? "Available" : "Unavailable"}
                            </span>
                            {/* Status Badge */}
                            {volunteer.volunteer_profiles === null && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Needs Profile
                              </span>
                            )}
                            {volunteer.volunteer_profiles?.status === "INACTIVE" && (
                              <>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Needs Activation
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleActivateVolunteer(volunteer.id);
                                  }}
                                  className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200"
                                  disabled={updatingStatus === volunteer.id}
                                >
                                  {updatingStatus === volunteer.id ? "..." : "Activate"}
                                </button>
                              </>
                            )}
                            {volunteer.volunteer_profiles?.status === "ACTIVE" && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                            {volunteer.volunteer_profiles?.status === "SUSPENDED" && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Suspended
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                openVolunteerDetails(volunteer)
                              }}
                            >
                              Quick View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Dialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open)
            if (!open) {
              setDetailVolunteer(null)
              setDetailIncidents([])
              setDetailError(null)
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {detailVolunteer ? `${detailVolunteer.first_name} ${detailVolunteer.last_name}` : "Volunteer Details"}
              </DialogTitle>
              <DialogDescription>
                {detailVolunteer?.email} · {detailVolunteer?.volunteer_profiles?.status || "No profile"}
              </DialogDescription>
            </DialogHeader>

            {detailVolunteer && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500">Contact</p>
                    <p className="text-sm text-gray-900">{detailVolunteer.email}</p>
                    <p className="text-sm text-gray-900">{detailVolunteer.phone_number || "No number"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500">Barangay</p>
                    <p className="text-sm text-gray-900">{detailVolunteer.barangay || "Unassigned"}</p>
                    <p className="text-xs text-gray-500 mt-2">Availability</p>
                    <Badge variant={detailVolunteer.volunteer_profiles?.is_available ? "secondary" : "outline"}>
                      {detailVolunteer.volunteer_profiles?.is_available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500">Resolved Incidents</p>
                    <p className="text-3xl font-semibold text-gray-900">
                      {detailVolunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-900">Recent Assignments</p>
                  <Link href={`/admin/volunteers/${detailVolunteer.id}`}>
                    <Button variant="outline" size="sm">
                      View full profile
                    </Button>
                  </Link>
                </div>

                <div className="border rounded-lg">
                  {detailLoading ? (
                    <div className="py-10 flex justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : detailError ? (
                    <div className="py-4 text-center text-sm text-red-600">{detailError}</div>
                  ) : detailIncidents.length === 0 ? (
                    <div className="py-4 text-center text-sm text-gray-500">No incident history yet</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Incident</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Barangay</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {detailIncidents.slice(0, 10).map((incident) => (
                            <tr key={incident.id}>
                              <td className="px-4 py-2">{incident.incident_type || "Unnamed"}</td>
                              <td className="px-4 py-2">{incident.barangay || "—"}</td>
                              <td className="px-4 py-2">
                                <Badge variant="outline">{incident.status}</Badge>
                              </td>
                              <td className="px-4 py-2">
                                {new Date(incident.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
