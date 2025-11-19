"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getAllIncidents } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { IncidentReferenceId } from "@/components/ui/incident-reference-id"
import { supabase } from "@/lib/supabase"
import { AlertTriangle, Filter, Plus } from "lucide-react"
import { IncidentsTable } from "@/components/admin/incidents-table"
import { IncidentsFilter } from "@/components/admin/incidents-filter"

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface Filters {
  searchTerm: string
  barangay: string
  status: string
  incidentType: string
  priority: string
  dateRange: DateRange
}

const INCIDENT_TYPES = [
  "FIRE",
  "FLOOD",
  "EARTHQUAKE",
  "MEDICAL EMERGENCY",
  "CRIME",
  "TRAFFIC ACCIDENT",
  "FALLEN TREE",
  "POWER OUTAGE",
  "WATER OUTAGE",
  "LANDSLIDE",
  "OTHER",
]

export default function AdminIncidentsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get("status")
  
  const [incidents, setIncidents] = useState<any[]>([])
  const [filteredIncidents, setFilteredIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>(statusParam || "ALL")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [offlineOnly, setOfflineOnly] = useState(false)
  const [barangays, setBarangays] = useState<string[]>([])
  const [filters, setFilters] = useState<Filters>({
    searchTerm: "",
    barangay: "",
    status: "ALL",
    incidentType: "",
    priority: "",
    dateRange: { from: undefined, to: undefined }
  })

  useEffect(() => {
    // Fetch barangays
    const fetchBarangays = async () => {
      try {
        const { data } = await fetch("/api/barangays").then((res) => res.json())
        if (data) {
          const barangayNames = data.map((b: any) => b.name)
          setBarangays(barangayNames)
        }
      } catch (err) {
        console.error("Error fetching barangays:", err)
        // Fallback to hardcoded list if API fails
        const fallbackBarangays = [
          "ZONE 1", "ZONE 2", "ZONE 3", "ZONE 4", "ZONE 5",
          "ZONE 6", "ZONE 7", "ZONE 8", "ZONE 9", "ZONE 10",
          "ZONE 11", "ZONE 12", "ZONE 13", "ZONE 14", "ZONE 15",
          "ZONE 16", "ZONE 17", "ZONE 18", "ZONE 19", "ZONE 20",
          "CONCEPCION", "CABATANGAN", "MATAB-ANG", "BUBOG",
          "DOS HERMANAS", "EFIGENIO LIZARES", "KATILINGBAN",
        ]
        setBarangays(fallbackBarangays)
      }
    }

    fetchBarangays()
  }, [])

  useEffect(() => {
    const fetchIncidents = async () => {
      if (!user) return

      try {
        setLoading(true)
        const result = await getAllIncidents()

        if (result.success) {
          // getAllIncidents() now includes _offline flag from centralized API
          const base = (result.data || [])
          setIncidents(base)
          setFilteredIncidents(base)
        } else {
          setError(result.message || "Failed to fetch incidents")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
  }, [user])

  // Apply filters when incidents or filter criteria changes
  useEffect(() => {
    let filtered = [...incidents]

    // Apply status filter
    if (filters.status !== "ALL") {
      if (filters.status === "ACTIVE") {
        // Active means either ASSIGNED or RESPONDING
        filtered = filtered.filter(
          (incident) => incident.status === "ASSIGNED" || incident.status === "RESPONDING"
        )
      } else {
        filtered = filtered.filter((incident) => incident.status === filters.status)
      }
    }

    // Apply search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(
        (incident) =>
          incident.incident_type.toLowerCase().includes(term) ||
          incident.description.toLowerCase().includes(term) ||
          incident.barangay.toLowerCase().includes(term) ||
          (incident.reporter?.first_name && incident.reporter.first_name.toLowerCase().includes(term)) ||
          (incident.reporter?.last_name && incident.reporter.last_name.toLowerCase().includes(term))
      )
    }

    // Apply barangay filter
    if (filters.barangay) {
      filtered = filtered.filter(
        (incident) => incident.barangay === filters.barangay
      )
    }

    // Apply incident type filter
    if (filters.incidentType) {
      filtered = filtered.filter(
        (incident) => incident.incident_type === filters.incidentType
      )
    }

    // Apply priority filter
    if (filters.priority) {
      filtered = filtered.filter(
        (incident) => incident.priority.toString() === filters.priority
      )
    }

    // Apply date range filter
    if (filters.dateRange.from || filters.dateRange.to) {
      filtered = filtered.filter((incident) => {
        const incidentDate = new Date(incident.created_at)
        const fromValid = !filters.dateRange.from || (incidentDate >= filters.dateRange.from)
        const toValid = !filters.dateRange.to || (incidentDate <= filters.dateRange.to)
        return fromValid && toValid
      })
    }

    // Offline-only filter
    if (offlineOnly) {
      filtered = filtered.filter((incident) => incident._offline)
    }

    setFilteredIncidents(filtered)
    setPage(1)
  }, [incidents, filters, offlineOnly])

  // Set status filter when statusParam changes
  useEffect(() => {
    if (statusParam) {
      setFilters(prev => ({ ...prev, status: statusParam }))
    }
  }, [statusParam])

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters)
  }

  // Pagination derived values
  const pageSize = 25
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const visibleIncidents = filteredIncidents.slice(startIndex, startIndex + pageSize)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        )
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
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Cancelled
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Incident Management</h1>
            <p className="text-gray-600 mt-1">View and manage all reported incidents</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link
              href="/admin/incidents/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Incident
            </Link>
          </div>
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

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <IncidentsFilter 
            onFilterChange={handleFilterChange}
            barangays={barangays}
            incidentTypes={INCIDENT_TYPES}
          />
          
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input 
                  type="checkbox" 
                  checked={offlineOnly} 
                  onChange={(e)=> setOfflineOnly(e.target.checked)} 
                />
                Offline only
              </label>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text="Loading incidents..." />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="p-6 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No incidents found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== "ALL" ? "Try adjusting your filters." : "Start by creating a new incident."}
              </p>
            </div>
          ) : (
            <>
              <IncidentsTable 
                incidents={visibleIncidents} 
                onRowClick={(incident) => router.push(`/admin/incidents/${incident.id}`)}
              />
              {/* Pagination controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-200">
                <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                  Showing {filteredIncidents.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + pageSize, filteredIncidents.length)} of {filteredIncidents.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                  >
                    Previous
                  </button>
                  <span className="text-xs sm:text-sm text-gray-700 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}