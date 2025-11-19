"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronRight, Filter } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { getResidentIncidents } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function ResidentHistoryPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [incidents, setIncidents] = useState<any[]>([])
  const [filteredIncidents, setFilteredIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    const fetchIncidents = async () => {
      if (!user) return

      try {
        setLoading(true)
        const result = await getResidentIncidents(user.id)
        if (result.success) {
          setIncidents(result.data || [])
          setFilteredIncidents(result.data || [])
        } else {
          setError(result.message || "Failed to fetch incident history")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
  }, [user])

  useEffect(() => {
    if (filter === "all") {
      setFilteredIncidents(incidents)
    } else {
      setFilteredIncidents(incidents.filter((incident) => incident.status === filter))
    }
  }, [filter, incidents])

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800"
      case "RESPONDING":
        return "bg-orange-100 text-orange-800"
      case "RESOLVED":
        return "bg-green-100 text-green-800"
      case "CANCELLED":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Report History</h1>
          <p className="text-gray-600 mt-1">View and track all your reported incidents</p>
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

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Your Reports</h2>
            <div className="relative w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <select
                className="w-full sm:w-auto pl-9 pr-10 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm sm:text-base bg-white min-h-[2.5rem] touch-manipulation appearance-none"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Reports</option>
                <option value="PENDING">Pending</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="RESPONDING">Responding</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text="Loading your reports..." />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === "all"
                  ? "You haven't reported any incidents yet."
                  : `You don't have any ${filter.toLowerCase()} reports.`}
              </p>
              <div className="mt-6">
                <Link
                  href="/resident/report"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
                >
                  Report New Incident
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 hover:bg-gray-50 transition-colors touch-manipulation"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{incident.incident_type}</h3>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${getStatusBadgeClass(
                          incident.status,
                        )}`}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex items-start">
                        <span className="text-gray-500 w-20 flex-shrink-0">Date:</span>
                        <div className="text-gray-900">{formatDate(incident.created_at)}</div>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-500 w-20 flex-shrink-0">Location:</span>
                        <div className="text-gray-900">{incident.barangay}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Link
                        href={`/resident/incident/${incident.id}`}
                        className="text-sm font-medium text-red-600 hover:text-red-500 inline-flex items-center touch-manipulation"
                      >
                        View Details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Type
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Date
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Location
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">View</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredIncidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {incident.incident_type}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatDate(incident.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{incident.barangay}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                              incident.status,
                            )}`}
                          >
                            {incident.status}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link
                            href={`/resident/incident/${incident.id}`}
                            className="text-red-600 hover:text-red-900 flex items-center justify-end touch-manipulation"
                          >
                            View
                            <ChevronRight className="ml-1 h-4 w-4" />
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
    </ResidentLayout>
  )
}
