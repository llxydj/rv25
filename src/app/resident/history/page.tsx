"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ChevronRight, Filter, Search, X } from "lucide-react"
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
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")

  useEffect(() => {
    const fetchIncidents = async () => {
      if (!user) return
      try {
        setLoading(true)
        const result = await getResidentIncidents(user.id)
        if (result.success) {
          setIncidents(result.data || [])
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

  // Apply all filters
  useEffect(() => {
    let result = [...incidents]

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((incident) => incident.status === statusFilter)
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date()
      const incidentDate = new Date()
      
      switch (dateFilter) {
        case "today":
          incidentDate.setHours(0, 0, 0, 0)
          now.setHours(0, 0, 0, 0)
          result = result.filter((incident) => {
            const date = new Date(incident.created_at)
            date.setHours(0, 0, 0, 0)
            return date.getTime() === now.getTime()
          })
          break
        case "week":
          const sevenDaysAgo = new Date(now)
          sevenDaysAgo.setDate(now.getDate() - 7)
          result = result.filter((incident) => new Date(incident.created_at) >= sevenDaysAgo)
          break
        case "month":
          const thirtyDaysAgo = new Date(now)
          thirtyDaysAgo.setDate(now.getDate() - 30)
          result = result.filter((incident) => new Date(incident.created_at) >= thirtyDaysAgo)
          break
        case "year":
          const oneYearAgo = new Date(now)
          oneYearAgo.setFullYear(now.getFullYear() - 1)
          result = result.filter((incident) => new Date(incident.created_at) >= oneYearAgo)
          break
      }
    }

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      result = result.filter((incident) =>
        incident.incident_type?.toLowerCase().includes(search) ||
        incident.barangay?.toLowerCase().includes(search) ||
        incident.description?.toLowerCase().includes(search) ||
        incident.id?.toLowerCase().includes(search)
      )
    }

    setFilteredIncidents(result)
  }, [statusFilter, dateFilter, searchTerm, incidents])

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
      case "ASSIGNED":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
      case "RESPONDING":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
      case "RESOLVED":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
      case "CANCELLED":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const clearFilters = () => {
    setStatusFilter("all")
    setDateFilter("all")
    setSearchTerm("")
  }

  const hasActiveFilters = statusFilter !== "all" || dateFilter !== "all" || searchTerm.trim() !== ""

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">View and track all your reported incidents</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by incident type, location, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            {/* Status Filter */}
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-40 pl-9 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none [&_option]:bg-white [&_option]:dark:bg-gray-700 [&_option]:text-gray-900 [&_option]:dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="RESPONDING">Responding</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Date Filter */}
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range
              </label>
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full sm:w-40 pl-3 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none [&_option]:bg-white [&_option]:dark:bg-gray-700 [&_option]:text-gray-900 [&_option]:dark:text-white"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="year">Last Year</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full sm:w-auto px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Header with Results Count */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Reports</h2>
            <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
              {filteredIncidents.length} of {incidents.length}
            </span>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text="Loading your reports..." />
            </div>
          ) : filteredIncidents.length === 0 ? (
            /* Empty State */
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No reports found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {hasActiveFilters
                  ? "No reports match your filters. Try adjusting them."
                  : "You haven't reported any incidents yet."}
              </p>
              {!hasActiveFilters && (
                <div className="mt-6">
                  <Link
                    href="/resident/report"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 dark:hover:bg-red-600"
                  >
                    Report New Incident
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors touch-manipulation"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {incident.incident_type}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${getStatusBadgeClass(
                          incident.status,
                        )}`}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-start">
                        <span className="text-gray-500 dark:text-gray-500 w-20 flex-shrink-0">Date:</span>
                        <div className="text-gray-900 dark:text-gray-200">{formatDate(incident.created_at)}</div>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-500 dark:text-gray-500 w-20 flex-shrink-0">Location:</span>
                        <div className="text-gray-900 dark:text-gray-200">{incident.barangay}</div>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-500 dark:text-gray-500 w-20 flex-shrink-0">ID:</span>
                        <div className="text-gray-900 dark:text-gray-200 truncate">{incident.id}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <Link
                        href={`/resident/incident/${incident.id}`}
                        className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 inline-flex items-center touch-manipulation"
                      >
                        View Details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg dark:ring-gray-700">
                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                        Type
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Date
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Location
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Status
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">View</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {filteredIncidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                          {incident.incident_type}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(incident.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {incident.barangay}
                        </td>
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
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 flex items-center justify-end touch-manipulation"
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