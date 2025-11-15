"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerIncidents, subscribeToVolunteerIncidents } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, CheckCircle, Clock, Eye, Filter } from "lucide-react"

export default function VolunteerIncidentsPage() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<any[]>([])
  const [filteredIncidents, setFilteredIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  useEffect(() => {
    const fetchIncidents = async () => {
      if (!user) return

      try {
        setLoading(true)
        console.log("Fetching incidents for user:", user.id);
        
        const result = await getVolunteerIncidents(user.id)
        console.log("Incident fetch result:", result);

        if (result.success) {
          setIncidents(result.data || [])
          setFilteredIncidents(result.data || [])
        } else {
          setError(result.message || "Failed to fetch incidents")
        }
      } catch (err: any) {
        console.error("Error fetching incidents:", err);
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
    
    // Add a timeout to prevent infinite loading state
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false)
        setError("Loading timed out. Please refresh the page.")
      }
    }, 10000) // 10 seconds timeout

    // Subscribe to real-time updates
    let subscription: any = null;
    if (user?.id) {
      subscription = subscribeToVolunteerIncidents(user.id, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload

        if (eventType === "INSERT") {
          setIncidents((prev) => [newRecord, ...prev])
        } else if (eventType === "UPDATE") {
          setIncidents((prev) => prev.map((incident) => (incident.id === newRecord.id ? newRecord : incident)))
        } else if (eventType === "DELETE") {
          setIncidents((prev) => prev.filter((incident) => incident.id !== oldRecord.id))
        }
      })
    }

    return () => {
      clearTimeout(loadingTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    }
  }, [user])

  // Apply filters when incidents or statusFilter changes
  useEffect(() => {
    // Skip filtering if incidents aren't loaded yet
    if (!incidents.length) return;
    
    let filtered = [...incidents];
    
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((incident) => incident.status === statusFilter)
    }
    
    setFilteredIncidents(filtered)
  }, [incidents, statusFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ASSIGNED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Assigned
          </span>
        )
      case "RESPONDING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Responding
          </span>
        )
      case "RESOLVED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Resolved
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ASSIGNED":
        return <AlertTriangle className="h-5 w-5 text-blue-500" />
      case "RESPONDING":
        return <Clock className="h-5 w-5 text-orange-500" />
      case "RESOLVED":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Your Incidents</h1>
            <p className="text-gray-600 mt-1">View and manage incidents assigned to you</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm text-black"
              >
                <option value="ALL">All Statuses</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="RESPONDING">Responding</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
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
        ) : filteredIncidents.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-6 text-center">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-black">No incidents found</h3>
              <p className="mt-1 text-sm text-gray-700">
                {statusFilter === "ALL"
                  ? "You don't have any incidents assigned to you yet."
                  : `You don't have any incidents with status "${statusFilter}".`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
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
                      Location
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Reported
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
                      Reporter
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(incident.status)}
                          <div className="ml-3">
                            <div className="text-sm font-medium text-black">{incident.incident_type}</div>
                            <div className="text-xs text-gray-700">Priority: {incident.priority}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-black">{incident.barangay}</div>
                        <div className="text-xs text-gray-700">{incident.address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-black">{formatDate(incident.created_at)}</div>
                        {incident.assigned_at && (
                          <div className="text-xs text-gray-700">Assigned: {formatDate(incident.assigned_at)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(incident.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {incident.reporter && (incident.reporter.first_name || incident.reporter.last_name || incident.reporter.email) ? (
                          <div className="text-sm text-black">
                            {incident.reporter.first_name && incident.reporter.last_name
                              ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                              : incident.reporter.first_name || incident.reporter.last_name
                              ? (incident.reporter.first_name || incident.reporter.last_name)
                              : incident.reporter.email || "Anonymous Reporter"}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-700">Anonymous Reporter</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/volunteer/incident/${incident.id}`}
                          className="text-green-600 hover:text-green-900 inline-flex items-center"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </VolunteerLayout>
  )
}
