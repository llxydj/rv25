"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FileText, MapPin, CheckCircle, Clock } from "lucide-react"
import { BarangayLayout } from "@/components/layout/barangay-layout"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { supabase } from "@/lib/supabase"
import { PushNotificationToggle } from "@/components/push-notification-toggle"

interface IncidentStats {
  total: number
  pending: number
  resolved: number
}

interface Incident {
  id: string
  type: string
  status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
  location: string
  created_at: string
  description: string
  reporter_id: string
  latitude: number
  longitude: number
  assigned_to?: {
    first_name: string
    last_name: string
  }
  reporter?: {
    first_name: string
    last_name: string
    role: string
  }
}

export default function BarangayDashboard() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<IncidentStats>({ total: 0, pending: 0, resolved: 0 })
  const [showVolunteers, setShowVolunteers] = useState(false)

  useEffect(() => {
    const fetchBarangayIncidents = async () => {
      if (!user?.barangay) return

      try {
        setLoading(true)
        setError(null)

        // Fetch via API with server-side filtering and RLS enforcement
        const res = await fetch(`/api/incidents?role=BARANGAY&barangay=${encodeURIComponent(user.barangay)}&limit=100`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json?.data) {
          throw new Error(json?.message || 'Failed to load incidents')
        }

        // Map API fields to local Incident interface
        const list = (json.data as any[]).map((it) => ({
          id: it.id,
          type: it.incident_type,
          status: it.status,
          location: it.address,
          created_at: it.created_at,
          description: it.description,
          reporter_id: it.reporter_id,
          latitude: it.location_lat,
          longitude: it.location_lng,
          assigned_to: it.assigned_to ? { first_name: it.assigned_to.first_name, last_name: it.assigned_to.last_name } : undefined,
          reporter: it.reporter ? { first_name: it.reporter.first_name, last_name: it.reporter.last_name, role: it.reporter.role } : undefined,
        }))

        setIncidents(list)

        // Calculate stats
        const stats = {
          total: list.length || 0,
          pending: list.filter(i => i.status === "PENDING").length || 0,
          resolved: list.filter(i => i.status === "RESOLVED").length || 0,
        }
        setStats(stats)

      } catch (err: any) {
        console.error("Error fetching barangay incidents:", err)
        setError(err.message || "Failed to fetch incidents")
      } finally {
        setLoading(false)
      }
    }

    fetchBarangayIncidents()
  }, [user?.barangay])

  // Format incidents for map markers
  const mapMarkers = incidents.map((incident) => ({
    id: incident.id,
    position: [incident.latitude, incident.longitude] as [number, number],
    status: incident.status,
    title: incident.type,
    description: incident.description,
  }))

  if (loading) {
    return (
      <BarangayLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </BarangayLayout>
    )
  }

  return (
    <BarangayLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">Barangay Dashboard</h1>
          <Link
            href="/barangay/report"
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <AlertTriangle className="mr-2 h-5 w-5" />
            Report Incident
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg">
          <h2 className="text-lg font-semibold mb-4">Welcome back, {user?.firstName}!</h2>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening in {user?.barangay}
          </p>
        </div>

        {/* Push Notification Settings */}
        <div className="max-w-2xl">
          <PushNotificationToggle />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg transition-all duration-200 hover:shadow-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Incidents</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg transition-all duration-200 hover:shadow-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-orange-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{stats.pending}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg transition-all duration-200 hover:shadow-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Resolved</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{stats.resolved}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {error ? (
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
          ) : incidents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No incidents reported in your barangay yet.</p>
              <Link
                href="/barangay/report"
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Report an Incident
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.slice(0, 3).map((incident) => (
                <div key={incident.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-full ${
                    incident.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-600"
                      : incident.status === "ASSIGNED"
                        ? "bg-blue-100 text-blue-600"
                        : incident.status === "RESPONDING"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-green-100 text-green-600"
                  }`}>
                    {incident.status === "PENDING" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : incident.status === "ASSIGNED" ? (
                      <FileText className="h-5 w-5" />
                    ) : incident.status === "RESPONDING" ? (
                      <MapPin className="h-5 w-5" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">{incident.type}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        incident.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : incident.status === "ASSIGNED"
                            ? "bg-blue-100 text-blue-800"
                            : incident.status === "RESPONDING"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-green-100 text-green-800"
                      }`}>
                        {incident.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {incident.location} • {new Date(incident.created_at).toLocaleDateString()}
                    </p>
                    {incident.assigned_to && (
                      <p className="mt-1 text-sm text-gray-500">
                        Assigned to: {incident.assigned_to.first_name} {incident.assigned_to.last_name}
                      </p>
                    )}
                    {incident.reporter && (
                      <p className="mt-1 text-sm text-gray-500">
                        Reported by: {incident.reporter.first_name} {incident.reporter.last_name}
                      </p>
                    )}
                    <div className="mt-2">
                      <Link
                        href={`/barangay/incident/${incident.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {incidents.length > 3 && (
                <div className="text-center pt-4">
                  <Link
                    href={`/barangay/incidents`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View all {incidents.length} reports →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* All Incidents Table */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">All Incidents in {user?.barangay}</h2>
          {error ? (
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
          ) : incidents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No incidents reported in your barangay yet.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors touch-manipulation"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{incident.type}</h3>
                      </div>
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full flex-shrink-0 ml-2 ${
                          incident.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : incident.status === "ASSIGNED"
                              ? "bg-blue-100 text-blue-800"
                              : incident.status === "RESPONDING"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-green-100 text-green-800"
                        }`}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Date: {new Date(incident.created_at).toLocaleDateString()}</div>
                      <div>Location: {incident.location}</div>
                      {incident.reporter && (incident.reporter.first_name || incident.reporter.last_name) && (
                        <div>
                          Reporter: {incident.reporter.first_name && incident.reporter.last_name
                            ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                            : incident.reporter.first_name || incident.reporter.last_name}
                          {incident.reporter.role && ` (${incident.reporter.role})`}
                        </div>
                      )}
                      {incident.assigned_to && (
                        <div>
                          Assigned to: {incident.assigned_to.first_name} {incident.assigned_to.last_name}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Link
                        href={`/barangay/incident/${incident.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500 touch-manipulation inline-block"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reporter
                      </th>
                      <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned To
                      </th>
                      <th scope="col" className="relative px-4 lg:px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-gray-50">
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{incident.type}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(incident.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{incident.location}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            incident.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : incident.status === "ASSIGNED"
                                ? "bg-blue-100 text-blue-800"
                                : incident.status === "RESPONDING"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-green-100 text-green-800"
                          }`}>
                            {incident.status}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          {incident.reporter && (incident.reporter.first_name || incident.reporter.last_name) ? (
                            <div className="text-sm text-gray-500">
                              {incident.reporter.first_name && incident.reporter.last_name
                                ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                                : incident.reporter.first_name || incident.reporter.last_name
                                ? (incident.reporter.first_name || incident.reporter.last_name)
                                : "Anonymous Reporter"}
                              <br />
                              <span className="text-xs text-gray-400">
                                ({incident.reporter.role || 'Resident'})
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">Anonymous Reporter</div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {incident.assigned_to
                            ? `${incident.assigned_to.first_name} ${incident.assigned_to.last_name}`
                            : "Unassigned"}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/barangay/incident/${incident.id}`}
                            className="text-blue-600 hover:text-blue-900 touch-manipulation"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Incident Map */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Incident Map</h2>
          <div className="flex items-center gap-2 mb-3">
            <input id="toggle-volunteers" type="checkbox" checked={showVolunteers} onChange={(e)=> setShowVolunteers(e.target.checked)} />
            <label htmlFor="toggle-volunteers" className="text-sm text-gray-700">Show volunteer locations</label>
          </div>
          <div className="h-[400px] w-full rounded-lg overflow-hidden">
            {typeof window !== 'undefined' && 
              <MapComponent markers={mapMarkers} height="400px" showVolunteerLocations={showVolunteers} />
            }
          </div>
        </div>
      </div>
    </BarangayLayout>
  )
}