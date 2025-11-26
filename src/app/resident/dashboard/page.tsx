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

  const mapMarkers = incidents.map((incident) => ({
    id: incident.id,
    position: [incident.location_lat, incident.location_lng] as [number, number],
    status: incident.status,
    title: incident.incident_type,
    description: incident.description,
  }))

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      ASSIGNED: "bg-blue-100 text-blue-800",
      RESPONDING: "bg-orange-100 text-orange-800",
      RESOLVED: "bg-green-100 text-green-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "PENDING": return <AlertTriangle className="h-5 w-5" />
      case "ASSIGNED": return <FileText className="h-5 w-5" />
      case "RESPONDING": return <MapPin className="h-5 w-5" />
      case "RESOLVED":
        return (
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      default: return null
    }
  }

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">Resident Dashboard</h1>
        </div>

        {/* Emergency / Non-Emergency Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/resident/report?type=emergency"
            className="flex flex-col items-center justify-center p-8 bg-red-600 text-white rounded-lg shadow-lg cursor-pointer hover:bg-red-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 active:scale-[0.98]"
            title="Click to report an emergency"
          >
            <AlertTriangle className="h-12 w-12 mb-3" />
            <h2 className="text-xl font-bold mb-2">EMERGENCY</h2>
            <p className="text-sm text-red-100 text-center">Life-threatening situation requiring immediate response</p>
          </Link>

          <Link
            href="/resident/report?type=non-emergency"
            className="flex flex-col items-center justify-center p-8 bg-green-600 text-white rounded-lg shadow-lg cursor-pointer hover:bg-green-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 active:scale-[0.98]"
            title="Click to report a non-emergency"
          >
            <FileText className="h-12 w-12 mb-3" />
            <h2 className="text-xl font-bold mb-2">NON-EMERGENCY</h2>
            <p className="text-sm text-green-100 text-center">General incident report for non-urgent situations</p>
          </Link>
        </div>

        {/* Push Notification */}
        <div className="max-w-2xl">
          <PushNotificationToggle />
        </div>

        {/* Incident List (Merged Recent Activity & Reports) */}
        <div className="bg-white p-6 rounded-lg shadow-md transition-all duration-200 hover:shadow-lg">
          <h2 className="text-lg font-semibold mb-4">Your Incident Reports</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading incidents..." />
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
                <div className="ml-3"><p className="text-sm text-red-700">{error}</p></div>
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
            <>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {incidents.slice(0, 5).map((incident) => (
                  <div key={incident.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{incident.incident_type}</h3>
                      </div>
                      <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full flex-shrink-0 ml-2 ${statusBadge(incident.status)}`}>
                        {incident.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Date: {new Date(incident.created_at).toLocaleDateString()}</div>
                      <div>Location: {incident.barangay}</div>
                      {incident.assigned_to && <div>Assigned to: {incident.assigned_to.first_name} {incident.assigned_to.last_name}</div>}
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Link href={`/resident/incident/${incident.id}`} className="text-sm font-medium text-red-600 hover:text-red-500">View Details →</Link>
                    </div>
                  </div>
                ))}
                {incidents.length > 5 && (
                  <div className="text-center pt-2">
                    <Link href="/resident/history" className="text-sm font-medium text-red-600 hover:text-red-500">
                      View all {incidents.length} incidents →
                    </Link>
                  </div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Type","Date","Location","Status","Assigned To","View"].map((header) => (
                        <th key={header} className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incidents.slice(0, 5).map((incident) => (
                      <tr key={incident.id} className="hover:bg-gray-50">
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{incident.incident_type}</td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(incident.created_at).toLocaleDateString()}</td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{incident.barangay}</td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge(incident.status)}`}>
                            {incident.status}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {incident.assigned_to ? `${incident.assigned_to.first_name} ${incident.assigned_to.last_name}` : "Unassigned"}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link href={`/resident/incident/${incident.id}`} className="text-red-600 hover:text-red-900">View</Link>
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
            </>
          )}
        </div>

        {/* Incident Map */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Incident Map</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading map..." />
            </div>
          ) : (
            <div id="map-container" className="h-[400px] w-full rounded-lg overflow-hidden">
              {typeof window !== 'undefined' && <MapComponent markers={mapMarkers} height="400px" />}
            </div>
          )}
        </div>
      </div>
    </ResidentLayout>
  )
}
