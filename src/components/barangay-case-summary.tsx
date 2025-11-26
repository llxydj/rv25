"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FileText, MapPin, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'

interface Incident {
  id: string
  incident_type: string
  status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
  address: string
  created_at: string
  description: string
  location_lat: number
  location_lng: number
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

interface IncidentStats {
  total: number
  pending: number
  resolved: number
  assigned: number
  responding: number
  cancelled: number
}

export function BarangayCaseSummary({ barangay }: { barangay: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<IncidentStats>({ 
    total: 0, 
    pending: 0, 
    resolved: 0, 
    assigned: 0, 
    responding: 0, 
    cancelled: 0 
  })

  useEffect(() => {
    if (barangay) {
      fetchBarangayIncidents()
    }
  }, [barangay])

  const fetchBarangayIncidents = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch incidents for this barangay
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          id,
          incident_type,
          status,
          address,
          created_at,
          description,
          location_lat,
          location_lng,
          assigned_to:users!incidents_assigned_to_fkey (
            first_name,
            last_name
          ),
          reporter:users!incidents_reporter_id_fkey (
            first_name,
            last_name,
            role
          )
        `)
        .eq('barangay', barangay)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Map data to Incident interface
      const incidentList: Incident[] = (data || []).map((item: any) => ({
        id: item.id,
        incident_type: item.incident_type,
        status: item.status,
        address: item.address,
        created_at: item.created_at,
        description: item.description,
        location_lat: item.location_lat,
        location_lng: item.location_lng,
        assigned_to: item.assigned_to ? {
          first_name: item.assigned_to.first_name,
          last_name: item.assigned_to.last_name
        } : undefined,
        reporter: item.reporter ? {
          first_name: item.reporter.first_name,
          last_name: item.reporter.last_name,
          role: item.reporter.role
        } : undefined
      }))

      setIncidents(incidentList)

      // Calculate stats
      const stats = {
        total: incidentList.length,
        pending: incidentList.filter(i => i.status === "PENDING").length,
        resolved: incidentList.filter(i => i.status === "RESOLVED").length,
        assigned: incidentList.filter(i => i.status === "ASSIGNED").length,
        responding: incidentList.filter(i => i.status === "RESPONDING").length,
        cancelled: incidentList.filter(i => i.status === "CANCELLED").length
      }
      setStats(stats)

    } catch (err: any) {
      console.error("Error fetching barangay incidents:", err)
      setError(err.message || "Failed to fetch incidents")
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "ASSIGNED":
        return <FileText className="h-5 w-5 text-blue-500" />
      case "RESPONDING":
        return <MapPin className="h-5 w-5 text-orange-500" />
      case "RESOLVED":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "CANCELLED":
        return <Clock className="h-5 w-5 text-gray-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />
    }
  }

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
        <span>Loading case summary...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <Button 
                onClick={fetchBarangayIncidents} 
                className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-xl font-semibold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-6 w-6 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Assigned</p>
              <p className="text-xl font-semibold text-gray-900">{stats.assigned}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <MapPin className="h-6 w-6 text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Responding</p>
              <p className="text-xl font-semibold text-gray-900">{stats.responding}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Resolved</p>
              <p className="text-xl font-semibold text-gray-900">{stats.resolved}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-6 w-6 text-gray-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Cancelled</p>
              <p className="text-xl font-semibold text-gray-900">{stats.cancelled}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Incidents Table */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Incidents in {barangay}</h2>
          <Link 
            href="/barangay/incidents" 
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View All
          </Link>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No incidents reported in {barangay} yet.</p>
            <Link
              href="/barangay/report"
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reporter
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
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
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(incident.status)}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {incident.reporter 
                        ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                        : "Anonymous"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/barangay/incident/${incident.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}