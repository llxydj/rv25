"use client"

import React, { useState } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronRight, MapPin, User, Clock, CheckCircle, AlertTriangle, FileText } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
}

interface IncidentsTableProps {
  incidents: Incident[]
  onRowClick?: (incident: Incident) => void
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "PENDING":
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
    case "ASSIGNED":
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Assigned</Badge>
    case "RESPONDING":
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-100">Responding</Badge>
    case "RESOLVED":
      return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>
    case "CANCELLED":
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-100">Cancelled</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const getPriorityBadge = (priority: number) => {
  switch (priority) {
    case 1:
      return <Badge variant="destructive">Critical</Badge>
    case 2:
      return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>
    case 3:
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Medium</Badge>
    case 4:
      return <Badge className="bg-green-500 hover:bg-green-600">Low</Badge>
    case 5:
      return <Badge variant="outline">Info</Badge>
    default:
      return <Badge variant="outline">{priority}</Badge>
  }
}

const getSeverityBadge = (severity: string | null) => {
  if (!severity) return null
  
  switch (severity) {
    case "CRITICAL":
      return <Badge variant="destructive" className="text-xs">Critical</Badge>
    case "SEVERE":
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs">Severe</Badge>
    case "MODERATE":
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs">Moderate</Badge>
    case "MINOR":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Minor</Badge>
    default:
      return <Badge variant="outline" className="text-xs">{severity}</Badge>
  }
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "—"
  return format(new Date(dateString), "MMM d, yyyy h:mm a")
}

export function IncidentsTable({ incidents, onRowClick }: IncidentsTableProps) {
  const [openIncidents, setOpenIncidents] = useState<Record<string, boolean>>({})

  const toggleIncident = (incidentId: string) => {
    setOpenIncidents(prev => ({
      ...prev,
      [incidentId]: !prev[incidentId]
    }))
  }

  if (!incidents || incidents.length === 0) {
    return (
      <div className="text-center py-8" role="alert" aria-live="polite">
        <p className="text-gray-500">No incidents found</p>
      </div>
    )
  }

  // Mobile card view component
  const IncidentCard = ({ incident }: { incident: Incident }) => (
    <div 
      className={`border rounded-lg p-4 mb-3 bg-white hover:bg-gray-50 transition-colors ${incident.is_overdue ? 'border-l-4 border-l-red-500 bg-red-50' : ''}`}
      onClick={() => onRowClick?.(incident)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick?.(incident);
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{incident.incident_type}</h3>
            {incident.severity && getSeverityBadge(incident.severity)}
            {incident._offline && <Badge variant="outline" className="text-xs">Offline</Badge>}
            {incident.is_overdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
          </div>
          <p className="text-xs text-gray-600 line-clamp-2 mb-2">{incident.description}</p>
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
          className="p-1 h-6 w-6 flex-shrink-0 touch-manipulation"
          onClick={(e) => {
            e.stopPropagation()
            toggleIncident(incident.id)
          }}
          aria-label={openIncidents[incident.id] ? `Collapse details` : `Expand details`}
          aria-expanded={openIncidents[incident.id]}
        >
          {openIncidents[incident.id] ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-gray-900 font-medium">{incident.barangay}</div>
            <div className="text-gray-500 truncate">{incident.address || "—"}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Reporter:</span>
          <span className="text-gray-900">
            {incident.reporter 
              ? (incident.reporter.first_name && incident.reporter.last_name
                  ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                  : incident.reporter.first_name || incident.reporter.last_name || "Unknown")
              : "Anonymous"}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Status:</span>
            {getStatusBadge(incident.status)}
          </div>
          <div className="text-gray-500 text-right">
            {formatDate(incident.created_at)}
          </div>
        </div>
        
        {incident.assignee && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Assigned to:</span>
            <span className="text-gray-900">
              {incident.assignee.first_name && incident.assignee.last_name
                ? `${incident.assignee.first_name} ${incident.assignee.last_name}`
                : incident.assignee.first_name || incident.assignee.last_name || "Unknown"}
            </span>
          </div>
        )}
      </div>
      
      <Collapsible open={openIncidents[incident.id]} onOpenChange={() => {}}>
        <CollapsibleContent className="mt-3 pt-3 border-t">
          <div className="space-y-3 text-xs">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                    <AlertTriangle className="h-2.5 w-2.5 text-blue-600" />
                  </div>
                  <div className="ml-2">
                    <p className="font-medium text-gray-900">Reported</p>
                    <p className="text-gray-500">{formatDate(incident.created_at)}</p>
                  </div>
                </div>
                {incident.assigned_at && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-100 flex items-center justify-center">
                      <User className="h-2.5 w-2.5 text-yellow-600" />
                    </div>
                    <div className="ml-2">
                      <p className="font-medium text-gray-900">Assigned</p>
                      <p className="text-gray-500">{formatDate(incident.assigned_at)}</p>
                    </div>
                  </div>
                )}
                {incident.responding_at && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                      <Clock className="h-2.5 w-2.5 text-orange-600" />
                    </div>
                    <div className="ml-2">
                      <p className="font-medium text-gray-900">Responding</p>
                      <p className="text-gray-500">{formatDate(incident.responding_at)}</p>
                    </div>
                  </div>
                )}
                {incident.resolved_at && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-2.5 w-2.5 text-green-600" />
                    </div>
                    <div className="ml-2">
                      <p className="font-medium text-gray-900">Resolved</p>
                      <p className="text-gray-500">{formatDate(incident.resolved_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Location</h4>
              <p className="text-gray-700">{incident.barangay}</p>
              <p className="text-gray-500">{incident.address || "No address"}</p>
              <p className="text-gray-500">{incident.city}, {incident.province}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Description</h4>
              <p className="text-gray-700">{incident.description}</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Mobile Card View */}
      <div className="md:hidden p-3">
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12" aria-label="Expand details">
                <span className="sr-only">Expand details</span>
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Incident
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reporter
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th scope="col" className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reported
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {incidents.map((incident) => (
              <React.Fragment key={incident.id}>
                <tr 
                  className={`hover:bg-gray-50 ${incident.is_overdue ? 'bg-red-50 border-l-4 border-red-500' : ''}`}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(incident);
                    }
                  } : undefined}
                >
                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-6 w-6 touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleIncident(incident.id)
                      }}
                      aria-label={openIncidents[incident.id] ? `Collapse details for ${incident.incident_type}` : `Expand details for ${incident.incident_type}`}
                      aria-expanded={openIncidents[incident.id]}
                    >
                      {openIncidents[incident.id] ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">{incident.incident_type}</div>
                        {incident.severity && getSeverityBadge(incident.severity)}
                        {incident._offline && (
                          <Badge variant="outline" className="text-xs">Offline</Badge>
                        )}
                        {incident.is_overdue && (
                          <Badge variant="destructive" className="text-xs">Overdue</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 line-clamp-1">{incident.description}</div>
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
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-1 flex-shrink-0" aria-hidden="true" />
                      <div>
                        <div className="text-sm text-gray-900">{incident.barangay}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">{incident.address || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    {incident.reporter ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {incident.reporter.first_name && incident.reporter.last_name
                            ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                            : incident.reporter.first_name || incident.reporter.last_name || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {incident.reporter.phone_number || incident.reporter.email || "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Anonymous</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(incident.status)}
                      <div className="text-xs text-gray-500">
                        {incident.status === "ASSIGNED" && incident.assigned_at && formatDate(incident.assigned_at)}
                        {incident.status === "RESOLVED" && incident.resolved_at && formatDate(incident.resolved_at)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    {incident.assignee ? (
                      <div className="text-sm">
                        {incident.assignee.first_name && incident.assignee.last_name
                          ? `${incident.assignee.first_name} ${incident.assignee.last_name}`
                          : incident.assignee.first_name || incident.assignee.last_name || "Unknown"}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-4 text-sm text-gray-500 cursor-pointer" onClick={() => onRowClick?.(incident)}>
                    {formatDate(incident.created_at)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={7} className="p-0">
                    <Collapsible open={openIncidents[incident.id]} onOpenChange={() => {}}>
                      <CollapsibleContent className="border-t bg-gray-50">
                        <div className="p-4 pl-8 lg:pl-16">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Timeline</h4>
                              <div className="space-y-2">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                    <AlertTriangle className="h-3 w-3 text-blue-600" aria-hidden="true" />
                                  </div>
                                  <div className="ml-2">
                                    <p className="text-xs font-medium text-gray-900">Reported</p>
                                    <p className="text-xs text-gray-500">{formatDate(incident.created_at)}</p>
                                  </div>
                                </div>
                                {incident.assigned_at && (
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                                      <User className="h-3 w-3 text-yellow-600" aria-hidden="true" />
                                    </div>
                                    <div className="ml-2">
                                      <p className="text-xs font-medium text-gray-900">Assigned</p>
                                      <p className="text-xs text-gray-500">{formatDate(incident.assigned_at)}</p>
                                    </div>
                                  </div>
                                )}
                                {incident.responding_at && (
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                                      <Clock className="h-3 w-3 text-orange-600" aria-hidden="true" />
                                    </div>
                                    <div className="ml-2">
                                      <p className="text-xs font-medium text-gray-900">Responding (OTW)</p>
                                      <p className="text-xs text-gray-500">{formatDate(incident.responding_at)}</p>
                                    </div>
                                  </div>
                                )}
                                {incident.resolved_at && (
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                      <CheckCircle className="h-3 w-3 text-green-600" aria-hidden="true" />
                                    </div>
                                    <div className="ml-2">
                                      <p className="text-xs font-medium text-gray-900">Resolved</p>
                                      <p className="text-xs text-gray-500">{formatDate(incident.resolved_at)}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Priority & Severity</h4>
                              <div className="flex flex-wrap gap-2">
                                {getPriorityBadge(incident.priority)}
                                {incident.severity && getSeverityBadge(incident.severity)}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Location Details</h4>
                              <div className="text-sm">
                                <p className="text-gray-900 font-medium">{incident.barangay}</p>
                                <p className="text-gray-500">{incident.address || "No address provided"}</p>
                                <p className="text-gray-500">{incident.city}, {incident.province}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                              <p className="text-sm text-gray-700">{incident.description}</p>
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