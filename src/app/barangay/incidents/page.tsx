"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, FileText, MapPin, CheckCircle } from "lucide-react"
import { BarangayLayout } from "@/components/layout/barangay-layout"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface Incident {
  id: string
  incident_type: string
  status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
  address: string
  created_at: string
  description: string
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

export default function BarangayIncidentsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchIncidents = async () => {
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

        setIncidents(json.data || [])
      } catch (err: any) {
        console.error("Error fetching barangay incidents:", err)
        setError(err.message || "Failed to fetch incidents")
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
  }, [user?.barangay])

  if (loading) {
    return (
      <BarangayLayout>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size="lg" text="Loading incidents..." />
        </div>
      </BarangayLayout>
    )
  }

  return (
    <BarangayLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">Incident History</h1>
          <Link
            href="/barangay/report"
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <AlertTriangle className="mr-2 h-5 w-5" />
            Report Incident
          </Link>
        </div>

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
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 hover:bg-gray-50 transition-colors touch-manipulation"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{incident.incident_type}</h3>
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
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex items-start">
                        <span className="text-gray-500 w-20 flex-shrink-0">Date:</span>
                        <div className="text-gray-900">{new Date(incident.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-500 w-20 flex-shrink-0">Location:</span>
                        <div className="text-gray-900 truncate">{incident.address}</div>
                      </div>
                      {incident.reporter && (incident.reporter.first_name || incident.reporter.last_name) && (
                        <div className="flex items-start">
                          <span className="text-gray-500 w-20 flex-shrink-0">Reporter:</span>
                          <div className="text-gray-900 truncate">
                            {incident.reporter.first_name && incident.reporter.last_name
                              ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                              : incident.reporter.first_name || incident.reporter.last_name}
                            {incident.reporter.role && ` (${incident.reporter.role})`}
                          </div>
                        </div>
                      )}
                      {incident.assigned_to && (
                        <div className="flex items-start">
                          <span className="text-gray-500 w-20 flex-shrink-0">Assigned:</span>
                          <div className="text-gray-900">
                            {incident.assigned_to.first_name} {incident.assigned_to.last_name}
                          </div>
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
                          <div className="text-sm font-medium text-gray-900">{incident.incident_type}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(incident.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{incident.address}</div>
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
      </div>
    </BarangayLayout>
  )
}