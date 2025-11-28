// src/components/incident-timeline.tsx
// Professional Timeline Component for Incident Status Tracking

"use client"

import { useEffect, useState } from "react"
import { 
  AlertTriangle, 
  CheckCircle, 
  User, 
  Clock, 
  MapPin, 
  Camera, 
  FileText,
  ArrowRight,
  Circle
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

export interface TimelineEvent {
  id: string
  eventType: 'CREATED' | 'STATUS_CHANGE' | 'ASSIGNED' | 'REASSIGNED' | 'PHOTO_ADDED' | 'LOCATION_UPDATED' | 'SEVERITY_CHANGED' | 'PRIORITY_CHANGED' | 'NOTES_ADDED' | 'RESOLUTION_NOTES'
  previousStatus?: string | null
  newStatus?: string | null
  notes?: string | null
  created_at: string
  updated_by?: {
    first_name?: string
    last_name?: string
    role?: string
  } | null
  metadata?: Record<string, any>
}

interface IncidentTimelineProps {
  incidentId: string
  incidentCreatedAt: string
  updates: TimelineEvent[]
  className?: string
}

export function IncidentTimeline({ 
  incidentId, 
  incidentCreatedAt, 
  updates, 
  className = "" 
}: IncidentTimelineProps) {
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([])

  useEffect(() => {
    // Combine creation event with updates
    const creationEvent: TimelineEvent = {
      id: 'creation',
      eventType: 'CREATED',
      previousStatus: null,
      newStatus: 'PENDING',
      notes: 'Incident reported',
      created_at: incidentCreatedAt,
      updated_by: null
    }

    // Sort all events by timestamp
    const sortedEvents = [creationEvent, ...updates].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    setAllEvents(sortedEvents)
  }, [incidentCreatedAt, updates])

  const getEventIcon = (event: TimelineEvent) => {
    switch (event.eventType) {
      case 'CREATED':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'STATUS_CHANGE':
        if (event.newStatus === 'ASSIGNED') return <User className="h-5 w-5 text-blue-600" />
        if (event.newStatus === 'RESPONDING') return <Clock className="h-5 w-5 text-orange-600" />
        if (event.newStatus === 'ARRIVED') return <MapPin className="h-5 w-5 text-purple-600" />
        if (event.newStatus === 'RESOLVED') return <CheckCircle className="h-5 w-5 text-green-600" />
        return <Circle className="h-5 w-5 text-gray-600" />
      case 'ASSIGNED':
      case 'REASSIGNED':
        return <User className="h-5 w-5 text-blue-600" />
      case 'PHOTO_ADDED':
        return <Camera className="h-5 w-5 text-indigo-600" />
      case 'LOCATION_UPDATED':
        return <MapPin className="h-5 w-5 text-purple-600" />
      case 'SEVERITY_CHANGED':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      case 'PRIORITY_CHANGED':
        return <ArrowRight className="h-5 w-5 text-orange-600" />
      case 'NOTES_ADDED':
      case 'RESOLUTION_NOTES':
        return <FileText className="h-5 w-5 text-gray-600" />
      default:
        return <Circle className="h-5 w-5 text-gray-400" />
    }
  }

  const getEventTitle = (event: TimelineEvent) => {
    switch (event.eventType) {
      case 'CREATED':
        return 'Incident Reported'
      case 'STATUS_CHANGE':
        if (event.newStatus === 'PENDING') return 'Incident Pending'
        if (event.newStatus === 'ASSIGNED') return 'Assigned to Volunteer'
        if (event.newStatus === 'RESPONDING') return 'Volunteer Responding'
        if (event.newStatus === 'ARRIVED') return 'Volunteer Arrived'
        if (event.newStatus === 'RESOLVED') return 'Incident Resolved'
        if (event.newStatus === 'CANCELLED') return 'Incident Cancelled'
        return `Status: ${event.newStatus}`
      case 'ASSIGNED':
        return 'Assigned to Volunteer'
      case 'REASSIGNED':
        return 'Reassigned to Different Volunteer'
      case 'PHOTO_ADDED':
        return 'Photo Added'
      case 'LOCATION_UPDATED':
        return 'Location Updated'
      case 'SEVERITY_CHANGED':
        return `Severity Changed${event.metadata?.new_severity ? ` to ${event.metadata.new_severity}` : ''}`
      case 'PRIORITY_CHANGED':
        return `Priority Changed${event.metadata?.new_priority ? ` to ${event.metadata.new_priority}` : ''}`
      case 'NOTES_ADDED':
        return 'Notes Added'
      case 'RESOLUTION_NOTES':
        return 'Resolution Notes Added'
      default:
        return 'Incident Update'
    }
  }

  const getEventColor = (event: TimelineEvent) => {
    switch (event.eventType) {
      case 'CREATED':
        return 'bg-yellow-100 border-yellow-300'
      case 'STATUS_CHANGE':
        if (event.newStatus === 'ASSIGNED') return 'bg-blue-100 border-blue-300'
        if (event.newStatus === 'RESPONDING') return 'bg-orange-100 border-orange-300'
        if (event.newStatus === 'ARRIVED') return 'bg-purple-100 border-purple-300'
        if (event.newStatus === 'RESOLVED') return 'bg-green-100 border-green-300'
        return 'bg-gray-100 border-gray-300'
      case 'ASSIGNED':
      case 'REASSIGNED':
        return 'bg-blue-100 border-blue-300'
      case 'PHOTO_ADDED':
        return 'bg-indigo-100 border-indigo-300'
      case 'LOCATION_UPDATED':
        return 'bg-purple-100 border-purple-300'
      case 'SEVERITY_CHANGED':
        return 'bg-red-100 border-red-300'
      case 'PRIORITY_CHANGED':
        return 'bg-orange-100 border-orange-300'
      case 'NOTES_ADDED':
      case 'RESOLUTION_NOTES':
        return 'bg-gray-100 border-gray-300'
      default:
        return 'bg-gray-100 border-gray-300'
    }
  }

  const formatEventTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)
      
      if (diffMinutes < 1) return 'Just now'
      if (diffMinutes < 60) return `${diffMinutes}m ago`
      if (diffMinutes < 1440) return formatDistanceToNow(date, { addSuffix: true })
      return format(date, 'MMM d, yyyy h:mm a')
    } catch {
      return timestamp
    }
  }

  const calculateTimeBetween = (event1: TimelineEvent, event2: TimelineEvent) => {
    try {
      const time1 = new Date(event1.created_at).getTime()
      const time2 = new Date(event2.created_at).getTime()
      const diffMinutes = Math.floor((time2 - time1) / 60000)
      
      if (diffMinutes < 1) return null
      if (diffMinutes < 60) return `${diffMinutes} min`
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`
      return `${Math.floor(diffMinutes / 1440)}d`
    } catch {
      return null
    }
  }

  if (allEvents.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Timeline</h3>
        <p className="text-sm text-gray-500">No timeline events available</p>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Timeline</h3>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        
        <div className="space-y-6">
          {allEvents.map((event, index) => {
            const timeBetween = index > 0 ? calculateTimeBetween(allEvents[index - 1], event) : null
            
            return (
              <div key={event.id || index} className="relative flex items-start">
                {/* Icon */}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${getEventColor(event)}`}>
                  {getEventIcon(event)}
                </div>
                
                {/* Content */}
                <div className="ml-4 flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {getEventTitle(event)}
                      </p>
                      
                      {event.notes && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {event.notes}
                        </p>
                      )}
                      
                      {event.updated_by && (event.updated_by.first_name || event.updated_by.role) && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                          By: {event.updated_by.first_name 
                            ? `${event.updated_by.first_name} ${event.updated_by.last_name || ''}`.trim()
                            : 'System'}
                          {event.updated_by.role && ` (${event.updated_by.role})`}
                        </p>
                      )}
                    </div>
                    
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatEventTime(event.created_at)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                        {format(new Date(event.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Time gap indicator */}
                  {timeBetween && index > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-400 dark:text-gray-600 italic">
                        {timeBetween} later
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

