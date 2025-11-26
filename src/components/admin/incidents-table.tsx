"use client"

import React, { useState, useMemo, useCallback } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronRight, MapPin, User, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IncidentReferenceId } from "@/components/ui/incident-reference-id"

interface Incident {
  id: string
  incident_type: string
  description: string
  barangay: string
  address: string | null
  city: string
  province: string
  status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED'
  priority: number
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL' | null
  created_at: string
  created_at_local?: string
  assigned_at: string | null
  responding_at: string | null
  resolved_at: string | null
  reporter?: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone_number: string | null
  } | null
  assignee?: {
    first_name: string | null
    last_name: string | null
  } | null
  _offline?: boolean
  is_overdue?: boolean
  photoGallery?: string[]
  isLegacyData?: boolean
  dataFormatVersion?: 'legacy' | 'current'
  displayDate?: string
}

interface IncidentsTableProps {
  incidents: Incident[]
  onRowClick?: (incident: Incident) => void
}

// ✅ DARK MODE COMPATIBLE BADGES
const getStatusBadge = (status: string) => {
  switch (status) {
    case "PENDING":
      return (
        <Badge 
          variant="secondary" 
          className="bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
        >
          Pending
        </Badge>
      )
    case "ASSIGNED":
      return (
        <Badge 
          variant="secondary" 
          className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-950 border-blue-200 dark:border-blue-800"
        >
          Assigned
        </Badge>
      )
    case "RESPONDING":
      return (
        <Badge 
          variant="secondary" 
          className="bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-950 border-orange-200 dark:border-orange-800"
        >
          Responding
        </Badge>
      )
    case "RESOLVED":
      return (
        <Badge 
          variant="secondary" 
          className="bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-950 border-green-200 dark:border-green-800"
        >
          Resolved
        </Badge>
      )
    case "CANCELLED":
      return (
        <Badge 
          variant="secondary" 
          className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
        >
          Cancelled
        </Badge>
      )
    default:
      return <Badge variant="secondary" className="dark:bg-gray-800 dark:text-gray-200">{status}</Badge>
  }
}

const getPriorityBadge = (priority: number) => {
  switch (priority) {
    case 1:
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800">
          Critical
        </Badge>
      )
    case 2:
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white dark:bg-orange-600 dark:hover:bg-orange-700">
          High
        </Badge>
      )
    case 3:
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:text-white">
          Medium
        </Badge>
      )
    case 4:
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700">
          Low
        </Badge>
      )
    case 5:
      return (
        <Badge 
          variant="outline" 
          className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        >
          Info
        </Badge>
      )
    default:
      return <Badge variant="outline" className="dark:border-gray-700 dark:text-gray-300">{priority}</Badge>
  }
}

const getSeverityBadge = (severity: string | null) => {
  if (!severity) return null
  
  switch (severity) {
    case "CRITICAL":
      return (
        <Badge className="text-xs bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800">
          Critical
        </Badge>
      )
    case "SEVERE":
      return (
        <Badge className="text-xs bg-orange-500 hover:bg-orange-600 text-white dark:bg-orange-600 dark:hover:bg-orange-700">
          Severe
        </Badge>
      )
    case "MODERATE":
      return (
        <Badge className="text-xs bg-yellow-500 hover:bg-yellow-600 text-black dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:text-white">
          Moderate
        </Badge>
      )
    case "MINOR":
      return (
        <Badge className="text-xs bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700">
          Minor
        </Badge>
      )
    default:
      return (
        <Badge 
          variant="outline" 
          className="text-xs border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        >
          {severity}
        </Badge>
      )
  }
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "MMM d, yyyy h:mm a")
  } catch {
    return "Invalid date"
  }
}

export function IncidentsTable({ incidents, onRowClick }: IncidentsTableProps) {
  const [openIncidents, setOpenIncidents] = useState<Record<string, boolean>>({})

  const toggleIncident = useCallback((incidentId: string) => {
    setOpenIncidents(prev => ({
      ...prev,
      [incidentId]: !prev[incidentId]
    }))
  }, [])

  // ✅ MEMOIZED EMPTY STATE
  const emptyState = useMemo(() => (
    <div className="text-center py-12" role="alert" aria-live="polite">
      <p className="text-gray-500 dark:text-gray-400">No incidents found</p>
    </div>
  ), [])

  if (!incidents || incidents.length === 0) {
    return emptyState
  }

  // ✅ MEMOIZED MOBILE CARD (DARK MODE COMPATIBLE)
  const IncidentCard = React.memo(({ incident }: { incident: Incident }) => (
    <div 
      className={`
        border rounded-lg p-4 mb-4 
        bg-white dark:bg-gray-900 
        border-gray-200 dark:border-gray-800
        hover:bg-gray-50 dark:hover:bg-gray-800 
        active:bg-gray-100 dark:active:bg-gray-700
        transition-colors cursor-pointer
        ${incident.is_overdue ? 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20' : ''}
      `}
      onClick={() => onRowClick?.(incident)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRowClick?.(incident)
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {incident.incident_type}
            </h3>
            {incident.severity && getSeverityBadge(incident.severity)}
            {incident._offline && (
              <Badge 
                variant="outline" 
                className="text-xs border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              >
                Offline
              </Badge>
            )}
            {incident.isLegacyData && (
              <Badge 
                variant="outline" 
                className="text-xs border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              >
                Legacy Data
              </Badge>
            )}
            {incident.is_overdue && (
              <Badge className="text-xs bg-red-600 text-white dark:bg-red-700">
                Overdue
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {incident.description}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {getPriorityBadge(incident.priority)}
            <IncidentReferenceId 
              incidentId={incident.id} 
              size="sm" 
              variant="badge"
              showLabel={false}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 h-8 w-8 flex-shrink-0 touch-manipulation hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={(e) => {
            e.stopPropagation()
            toggleIncident(incident.id)
          }}
          aria-label={openIncidents[incident.id] ? 'Collapse details' : 'Expand details'}
          aria-expanded={openIncidents[incident.id]}
        >
          {openIncidents[incident.id] ? (
            <ChevronDown className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          )}
        </Button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-gray-900 dark:text-gray-100 font-medium">{incident.barangay}</div>
            <div className="text-gray-500 dark:text-gray-400 truncate">{incident.address || "—"}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">Reporter:</span>
          <span className="text-gray-900 dark:text-gray-100">
            {incident.reporter 
              ? (incident.reporter.first_name && incident.reporter.last_name
                  ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                  : incident.reporter.first_name || incident.reporter.last_name || "Unknown")
              : "Anonymous"}
          </span>
        </div>
        
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">Status:</span>
            {getStatusBadge(incident.status)}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-right">
            {formatDate(incident.displayDate || incident.created_at)}
          </div>
        </div>
        
        {incident.assignee && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">Assigned to:</span>
            <span className="text-gray-900 dark:text-gray-100">
              {incident.assignee.first_name && incident.assignee.last_name
                ? `${incident.assignee.first_name} ${incident.assignee.last_name}`
                : incident.assignee.first_name || incident.assignee.last_name || "Unknown"}
            </span>
          </div>
        )}
      </div>
      
      <Collapsible open={openIncidents[incident.id]} onOpenChange={() => {}}>
        <CollapsibleContent className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-3 text-xs">
            {/* Timeline */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Timeline</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                    <AlertTriangle className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Reported</p>
                    <p className="text-gray-500 dark:text-gray-400">{formatDate(incident.displayDate || incident.created_at)}</p>
                  </div>
                </div>
                {incident.assigned_at && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center">
                      <User className="h-2.5 w-2.5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="ml-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Assigned</p>
                      <p className="text-gray-500 dark:text-gray-400">{formatDate(incident.assigned_at)}</p>
                    </div>
                  </div>
                )}
                {incident.responding_at && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                      <Clock className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="ml-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Responding</p>
                      <p className="text-gray-500 dark:text-gray-400">{formatDate(incident.responding_at)}</p>
                    </div>
                  </div>
                )}
                {incident.resolved_at && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                      <CheckCircle className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="ml-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Resolved</p>
                      <p className="text-gray-500 dark:text-gray-400">{formatDate(incident.resolved_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Location */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Location</h4>
              <p className="text-gray-700 dark:text-gray-300">{incident.barangay}</p>
              <p className="text-gray-500 dark:text-gray-400">{incident.address || "No address"}</p>
              <p className="text-gray-500 dark:text-gray-400">{incident.city}, {incident.province}</p>
            </div>
            
            {/* Description */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Description</h4>
              <p className="text-gray-700 dark:text-gray-300">{incident.description}</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  ))

  IncidentCard.displayName = 'IncidentCard'

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* ✅ MOBILE CARD VIEW (DARK MODE) */}
      <div className="md:hidden p-3 bg-gray-50 dark:bg-gray-950">
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>
      
      {/* ✅ DESKTOP TABLE VIEW (DARK MODE) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12" aria-label="Expand details">
                <span className="sr-only">Expand details</span>
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Incident
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Location
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Reporter
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Assigned To
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Reported
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {incidents.map((incident) => (
              <React.Fragment key={incident.id}>
                <tr 
                  className={`
                    hover:bg-gray-50 dark:hover:bg-gray-800 
                    ${incident.is_overdue ? 'bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500' : ''}
                  `}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRowClick(incident)
                    }
                  } : undefined}
                >
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-6 w-6 touch-manipulation hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleIncident(incident.id)
                      }}
                      aria-label={openIncidents[incident.id] ? `Collapse details for ${incident.incident_type}` : `Expand details for ${incident.incident_type}`}
                      aria-expanded={openIncidents[incident.id]}
                    >
                      {openIncidents[incident.id] ? (
                        <ChevronDown className="h-4 w-4 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                      )}
                    </Button>
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {incident.incident_type}
                        </div>
                        {incident.severity && getSeverityBadge(incident.severity)}
                        {incident._offline && (
                          <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                            Offline
                          </Badge>
                        )}
                        {incident.isLegacyData && (
                          <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                            Legacy Data
                          </Badge>
                        )}
                        {incident.is_overdue && (
                          <Badge className="text-xs bg-red-600 text-white dark:bg-red-700">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {incident.description}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {getPriorityBadge(incident.priority)}
                        <IncidentReferenceId 
                          incidentId={incident.id} 
                          size="sm" 
                          variant="badge"
                          showLabel={false}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 mr-1 flex-shrink-0" aria-hidden="true" />
                      <div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{incident.barangay}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {incident.address || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    {incident.reporter ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {incident.reporter.first_name && incident.reporter.last_name
                            ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                            : incident.reporter.first_name || incident.reporter.last_name || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {incident.reporter.phone_number || incident.reporter.email || "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">Anonymous</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(incident.status)}
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {incident.status === "ASSIGNED" && incident.assigned_at && formatDate(incident.assigned_at)}
                        {incident.status === "RESOLVED" && incident.resolved_at && formatDate(incident.resolved_at)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    {incident.assignee ? (
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {incident.assignee.first_name && incident.assignee.last_name
                          ? `${incident.assignee.first_name} ${incident.assignee.last_name}`
                          : incident.assignee.first_name || incident.assignee.last_name || "Unknown"}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-sm text-gray-500 dark:text-gray-400 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    {formatDate(incident.displayDate || incident.created_at)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={7} className="p-0">
                    <Collapsible open={openIncidents[incident.id]} onOpenChange={() => {}}>
                      <CollapsibleContent className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                        <div className="p-4 pl-8 lg:pl-16">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Timeline */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Timeline</h4>
                              <div className="space-y-2">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                                    <AlertTriangle className="h-3 w-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                  </div>
                                  <div className="ml-2">
                                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100">Reported</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(incident.displayDate || incident.created_at)}</p>
                                  </div>
                                </div>
                                {incident.assigned_at && (
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center">
                                      <User className="h-3 w-3 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-2">
                                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">Assigned</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(incident.assigned_at)}</p>
                                    </div>
                                  </div>
                                )}
                                {incident.responding_at && (
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                                      <Clock className="h-3 w-3 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-2">
                                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">Responding (OTW)</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(incident.responding_at)}</p>
                                    </div>
                                  </div>
                                )}
                                {incident.resolved_at && (
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                                      <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-2">
                                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">Resolved</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(incident.resolved_at)}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Severity level (expert assessment) */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Severity Level (expert assessment)</h4>
                              <div className="flex flex-wrap gap-2">
                                {getPriorityBadge(incident.priority)}
                                {incident.severity && getSeverityBadge(incident.severity)}
                              </div>
                            </div>
                            
                            {/* Location Details */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Location Details</h4>
                              <div className="text-sm">
                                <p className="text-gray-900 dark:text-gray-100 font-medium">{incident.barangay}</p>
                                <p className="text-gray-500 dark:text-gray-400">{incident.address || "No address provided"}</p>
                                <p className="text-gray-500 dark:text-gray-400">{incident.city}, {incident.province}</p>
                              </div>
                            </div>
                            
                            {/* Description */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Description</h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{incident.description}</p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}