"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FileText, MapPin } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { getResidentIncidents } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { PushNotificationToggle } from "@/components/push-notification-toggle"

export default function ResidentDashboard() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchIncidents = async () => {
      if (!user) return

      try {
        setLoading(true)
        const result = await getResidentIncidents(user.id)

        if (!result.success) {
          setError(result.message || "Failed to fetch incidents")
          return
        }

        setIncidents(result.data || [])
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
  }, [user])

  // Format incidents for map markers
  const mapMarkers = incidents.map((incident) => ({
    id: incident.id,
    position: [incident.location_lat, incident.location_lng] as [number, number],
    status: incident.status,
    title: incident.incident_type,
    description: incident.description,
  }))

  // Get status counts
  const pendingCount = incidents.filter((i) => i.status === "PENDING").length
  const assignedCount = incidents.filter((i) => i.status === "ASSIGNED").length
  const respondingCount = incidents.filter((i) => i.status === "RESPONDING").length
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">Resident Dashboard</h1>
          <Link
            href="/resident/report"
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <AlertTriangle className="mr-2 h-5 w-5" />
            Report Incident
          </Link>
        </div>

        {/* Push Notification Settings */}
        <div className="max-w-2xl">
          <PushNotificationToggle />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading activities..." />
            </div>
          ) : error ? (
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
              <p className="text-gray-500">You haven't reported any incidents yet.</p>
              <Link
                href="/resident/report"
                className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
                <svg
                        className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">{incident.incident_type}</h3>
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
                      {incident.barangay} • {new Date(incident.created_at).toLocaleDateString()}
                    </p>
                    {incident.assigned_to && (
                      <p className="mt-1 text-sm text-gray-500">
                        Assigned to: {incident.assigned_to.first_name} {incident.assigned_to.last_name}
                      </p>
                    )}
                    <div className="mt-2">
                      <Link
                        href={`/resident/incident/${incident.id}`}
                        className="text-sm font-medium text-red-600 hover:text-red-500"
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
                    href="/resident/history"
                    className="text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    View all {incidents.length} reports →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Your Incident Reports</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading incidents..." />
            </div>
          ) : error ? (
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
              <p className="text-gray-500">You haven't reported any incidents yet.</p>
              <Link
                href="/resident/report"
                className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Report an Incident
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Location
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Assigned To
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {incidents.slice(0, 5).map((incident) => (
                    <tr key={incident.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{incident.incident_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(incident.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{incident.barangay}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            incident.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : incident.status === "ASSIGNED"
                                ? "bg-blue-100 text-blue-800"
                                : incident.status === "RESPONDING"
                                  ? "bg-orange-100 text-orange-800"
                                  : incident.status === "RESOLVED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {incident.assigned_to
                          ? `${incident.assigned_to.first_name} ${incident.assigned_to.last_name}`
                          : "Unassigned"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/resident/incident/${incident.id}`} className="text-red-600 hover:text-red-900">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {incidents.length > 5 && (
                <div className="mt-4 text-center">
                  <Link href="/resident/history" className="text-sm font-medium text-red-600 hover:text-red-500">
                    View all {incidents.length} incidents
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Incident Map</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading map..." />
            </div>
          ) : (
            <div id="map-container" className="h-[400px] w-full rounded-lg overflow-hidden">
              {typeof window !== 'undefined' && 
                <MapComponent markers={mapMarkers} height="400px" />
              }
            </div>
          )}
        </div>
      </div>
    </ResidentLayout>
  )
}
