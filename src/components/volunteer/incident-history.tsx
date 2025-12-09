"use client"

import React, { useEffect, useState } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapPin, Clock, CheckCircle, AlertCircle, XCircle, Calendar } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface IncidentHistoryProps {
  volunteerId: string
  compact?: boolean
}

interface Incident {
  id: string
  incident_type: string
  description: string
  status: string
  priority: number
  severity: string
  location_lat: number
  location_lng: number
  address?: string
  barangay: string
  assigned_at?: string
  resolved_at?: string
  created_at: string
  updated_at: string
  photo_url?: string
  photo_urls?: string[]
}

export function IncidentHistory({ volunteerId, compact = false }: IncidentHistoryProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/volunteers/${volunteerId}/incidents`)
        const result = await response.json()

        if (result.success) {
          setIncidents(result.data || [])
        } else {
          setError(result.message || "Failed to load incident history")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (volunteerId) {
      fetchIncidents()
    }
  }, [volunteerId])

  const getStatusBadge = (status: string) => {
    const baseClass = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case "RESOLVED":
        return (
          <span className={`${baseClass} bg-green-100 text-green-800`}>
            <CheckCircle className="h-3 w-3 mr-1" />
            Resolved
          </span>
        )
      case "IN_PROGRESS":
        return (
          <span className={`${baseClass} bg-blue-100 text-blue-800`}>
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </span>
        )
      case "PENDING":
        return (
          <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </span>
        )
      default:
        return (
          <span className={`${baseClass} bg-gray-100 text-gray-800`}>
            {status}
          </span>
        )
    }
  }

  const getPriorityBadge = (priority: number) => {
    const colors = [
      "bg-red-100 text-red-800", // 1 - Critical
      "bg-orange-100 text-orange-800", // 2 - High
      "bg-yellow-100 text-yellow-800", // 3 - Medium
      "bg-blue-100 text-blue-800", // 4 - Low
      "bg-gray-100 text-gray-800", // 5 - Very Low
    ]
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[priority - 1] || colors[4]}`}>
        Priority {priority}
      </span>
    )
  }

  const calculateResponseTime = (incident: Incident): number | null => {
    if (!incident.assigned_at || !incident.resolved_at) return null
    const assigned = new Date(incident.assigned_at)
    const resolved = new Date(incident.resolved_at)
    // FIXED: Validate dates and ensure resolved >= assigned to prevent negative times
    if (!isNaN(assigned.getTime()) && !isNaN(resolved.getTime()) && resolved >= assigned) {
      const timeDiff = (resolved.getTime() - assigned.getTime()) / (1000 * 60) // minutes
      return timeDiff >= 0 ? Math.round(timeDiff) : null
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">No incident history found</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {incidents.slice(0, 5).map((incident) => (
          <Link
            key={incident.id}
            href={`/admin/incidents/${incident.id}`}
            className="block p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {incident.incident_type}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {format(new Date(incident.created_at), "MMM d, yyyy")}
                </p>
              </div>
              <div className="ml-4">
                {getStatusBadge(incident.status)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {incidents.map((incident) => {
        const responseTime = calculateResponseTime(incident)
        return (
          <div
            key={incident.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-base font-semibold text-gray-900">
                    {incident.incident_type}
                  </h4>
                  {getPriorityBadge(incident.priority)}
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {incident.description}
                </p>
              </div>
              <div className="ml-4">
                {getStatusBadge(incident.status)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{incident.barangay}</span>
                {incident.address && (
                  <span className="text-gray-400">• {incident.address}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(incident.created_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            </div>

            {incident.assigned_at && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Clock className="h-4 w-4" />
                <span>
                  Assigned: {format(new Date(incident.assigned_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            )}

            {incident.resolved_at && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  Resolved: {format(new Date(incident.resolved_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
                {responseTime !== null && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Response time: {responseTime} minutes)
                  </span>
                )}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-200">
              <Link
                href={`/admin/incidents/${incident.id}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Details →
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

