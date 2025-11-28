// src/lib/incident-timeline.ts
// Centralized incident timeline logging helper

import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface TimelineEvent {
  incidentId: string
  eventType: 'CREATED' | 'STATUS_CHANGE' | 'ASSIGNED' | 'REASSIGNED' | 'PHOTO_ADDED' | 'LOCATION_UPDATED' | 'SEVERITY_CHANGED' | 'PRIORITY_CHANGED' | 'NOTES_ADDED' | 'RESOLUTION_NOTES'
  previousStatus?: string | null
  newStatus?: string | null
  updatedBy?: string | null
  notes?: string | null
  metadata?: Record<string, any>
}

/**
 * Log incident timeline event - ALWAYS logs, never fails silently
 * This is the single source of truth for all incident timeline entries
 */
export async function logIncidentTimelineEvent(event: TimelineEvent): Promise<{ success: boolean; error?: string }> {
  try {
    // Determine what to log based on event type
    let previousStatus: string | null = event.previousStatus ?? null
    let newStatus: string | null = event.newStatus ?? null
    let notes: string | null = event.notes ?? null

    // Format notes based on event type
    if (!notes) {
      switch (event.eventType) {
        case 'CREATED':
          notes = 'Incident reported'
          previousStatus = null
          newStatus = 'PENDING'
          break
        case 'STATUS_CHANGE':
          notes = `Status changed from ${previousStatus || 'N/A'} to ${newStatus || 'N/A'}`
          break
        case 'ASSIGNED':
          notes = 'Incident assigned to volunteer'
          break
        case 'REASSIGNED':
          notes = 'Incident reassigned to different volunteer'
          break
        case 'PHOTO_ADDED':
          notes = 'Photo added to incident'
          break
        case 'LOCATION_UPDATED':
          notes = 'Incident location updated'
          break
        case 'SEVERITY_CHANGED':
          notes = `Severity changed to ${event.metadata?.severity || 'N/A'}`
          break
        case 'PRIORITY_CHANGED':
          notes = `Priority changed to ${event.metadata?.priority || 'N/A'}`
          break
        case 'NOTES_ADDED':
          notes = 'Notes added to incident'
          break
        case 'RESOLUTION_NOTES':
          notes = 'Resolution notes added'
          break
      }
    }

    // Add metadata to notes if available
    if (event.metadata && Object.keys(event.metadata).length > 0) {
      const metadataStr = Object.entries(event.metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      notes = notes ? `${notes} (${metadataStr})` : metadataStr
    }

    const { error } = await supabaseAdmin
      .from('incident_updates')
      .insert({
        incident_id: event.incidentId,
        updated_by: event.updatedBy || null,
        previous_status: previousStatus,
        new_status: newStatus,
        notes: notes,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Failed to log incident timeline event:', error)
      // Still return success=false but don't throw - caller can decide
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('❌ Error logging incident timeline event:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Log incident creation - CRITICAL: This was missing!
 */
export async function logIncidentCreation(
  incidentId: string,
  reporterId: string,
  incidentData: {
    type: string
    barangay: string
    isOffline?: boolean
    offlineTimestamp?: string
  }
): Promise<void> {
  const notes = incidentData.isOffline
    ? (incidentData.offlineTimestamp
        ? `Incident reported offline at ${new Date(incidentData.offlineTimestamp).toLocaleString()} and synced when back online`
        : 'Incident reported offline and synced when back online')
    : `Incident reported: ${incidentData.type} in ${incidentData.barangay}`

  await logIncidentTimelineEvent({
    incidentId,
    eventType: 'CREATED',
    previousStatus: null,
    newStatus: 'PENDING',
    updatedBy: reporterId,
    notes
  })
}

/**
 * Log status change - Use this for ALL status changes
 */
export async function logStatusChange(
  incidentId: string,
  previousStatus: string,
  newStatus: string,
  updatedBy: string | null,
  notes?: string
): Promise<void> {
  await logIncidentTimelineEvent({
    incidentId,
    eventType: 'STATUS_CHANGE',
    previousStatus,
    newStatus,
    updatedBy: updatedBy || null,
    notes: notes || undefined
  })
}

/**
 * Log assignment - Use this for ALL assignments
 */
export async function logAssignment(
  incidentId: string,
  volunteerId: string | null,
  isReassignment: boolean = false,
  previousVolunteerId?: string | null
): Promise<void> {
  await logIncidentTimelineEvent({
    incidentId,
    eventType: isReassignment ? 'REASSIGNED' : 'ASSIGNED',
    previousStatus: 'PENDING',
    newStatus: 'ASSIGNED',
    updatedBy: volunteerId,
    notes: isReassignment
      ? `Reassigned${previousVolunteerId ? ` from previous volunteer` : ''}`
      : 'Assigned to volunteer',
    metadata: {
      volunteer_id: volunteerId,
      previous_volunteer_id: previousVolunteerId || null
    }
  })
}

/**
 * Log photo addition
 */
export async function logPhotoAdded(
  incidentId: string,
  updatedBy: string | null,
  photoCount: number
): Promise<void> {
  await logIncidentTimelineEvent({
    incidentId,
    eventType: 'PHOTO_ADDED',
    updatedBy,
    notes: `${photoCount} photo(s) added`,
    metadata: { photo_count: photoCount }
  })
}

/**
 * Log location update
 */
export async function logLocationUpdate(
  incidentId: string,
  updatedBy: string | null,
  newLocation: { lat: number; lng: number; address?: string }
): Promise<void> {
  await logIncidentTimelineEvent({
    incidentId,
    eventType: 'LOCATION_UPDATED',
    updatedBy,
    notes: `Location updated${newLocation.address ? `: ${newLocation.address}` : ''}`,
    metadata: {
      lat: newLocation.lat,
      lng: newLocation.lng,
      address: newLocation.address || null
    }
  })
}

/**
 * Log severity change
 */
export async function logSeverityChange(
  incidentId: string,
  previousSeverity: string,
  newSeverity: string,
  updatedBy: string | null
): Promise<void> {
  await logIncidentTimelineEvent({
    incidentId,
    eventType: 'SEVERITY_CHANGED',
    updatedBy,
    notes: `Severity changed from ${previousSeverity} to ${newSeverity}`,
    metadata: {
      previous_severity: previousSeverity,
      new_severity: newSeverity
    }
  })
}

/**
 * Log priority change
 */
export async function logPriorityChange(
  incidentId: string,
  previousPriority: string,
  newPriority: string,
  updatedBy: string | null
): Promise<void> {
  await logIncidentTimelineEvent({
    incidentId,
    eventType: 'PRIORITY_CHANGED',
    updatedBy,
    notes: `Priority changed from ${previousPriority} to ${newPriority}`,
    metadata: {
      previous_priority: previousPriority,
      new_priority: newPriority
    }
  })
}

/**
 * Log resolution notes
 */
export async function logResolutionNotes(
  incidentId: string,
  updatedBy: string | null,
  notes: string
): Promise<void> {
  await logIncidentTimelineEvent({
    incidentId,
    eventType: 'RESOLUTION_NOTES',
    updatedBy,
    notes: `Resolution notes: ${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}`
  })
}

/**
 * Fetch timeline events for an incident
 */
export async function getIncidentTimeline(incidentId: string): Promise<{
  success: boolean
  events?: any[]
  error?: string
}> {
  try {
    const { data: updates, error } = await supabaseAdmin
      .from('incident_updates')
      .select(`
        id,
        previous_status,
        new_status,
        notes,
        created_at,
        updated_by,
        users:updated_by (
          id,
          first_name,
          last_name,
          role
        )
      `)
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Failed to fetch timeline events:', error)
      return { success: false, error: error.message }
    }

    // Transform to match TimelineEvent interface
    // Infer event type from status changes and notes
    const events = (updates || []).map((update: any) => {
      let eventType: string = 'STATUS_CHANGE'
      let metadata: Record<string, any> = {}

      // Detect event type from status changes and notes
      if (update.previous_status === 'SEVERITY_UPDATE' && update.new_status === 'SEVERITY_UPDATE') {
        eventType = 'SEVERITY_CHANGED'
        // Try to extract severity from notes
        const severityMatch = update.notes?.match(/Severity changed (?:from \w+ )?to (\w+)/i)
        if (severityMatch) {
          metadata.new_severity = severityMatch[1]
        }
      } else if (update.notes?.includes('Photo') || update.notes?.includes('photo')) {
        eventType = 'PHOTO_ADDED'
        const photoCountMatch = update.notes?.match(/(\d+)\s*photo/i)
        if (photoCountMatch) {
          metadata.photo_count = parseInt(photoCountMatch[1])
        }
      } else if (update.notes?.includes('Location') || update.notes?.includes('location')) {
        eventType = 'LOCATION_UPDATED'
      } else if (update.notes?.includes('Resolution notes') || update.notes?.includes('resolution')) {
        eventType = 'RESOLUTION_NOTES'
      } else if (update.notes?.includes('Priority changed')) {
        eventType = 'PRIORITY_CHANGED'
        const priorityMatch = update.notes?.match(/Priority changed (?:from \w+ )?to (\w+)/i)
        if (priorityMatch) {
          metadata.new_priority = priorityMatch[1]
        }
      } else if (update.previous_status === 'PENDING' && update.new_status === 'ASSIGNED') {
        eventType = 'ASSIGNED'
      } else if (update.previous_status === 'ASSIGNED' && update.new_status === 'ASSIGNED') {
        eventType = 'REASSIGNED'
      }

      return {
        id: update.id,
        eventType: eventType as any,
        previousStatus: update.previous_status,
        newStatus: update.new_status,
        notes: update.notes,
        created_at: update.created_at,
        updated_by: update.users ? {
          first_name: update.users.first_name,
          last_name: update.users.last_name,
          role: update.users.role
        } : null,
        metadata
      }
    })

    return { success: true, events }
  } catch (error: any) {
    console.error('❌ Error fetching timeline:', error)
    return { success: false, error: error.message }
  }
}

