import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { z } from 'zod'
import { analyticsCache } from '@/app/api/volunteers/analytics/cache'

const StatusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'ASSIGNED', 'RESPONDING', 'ARRIVED', 'RESOLVED', 'CANCELLED']),
  updated_by: z.string().optional(),
  notes: z.string().optional()
})

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await getServerSupabase()
    
    // Validate incident ID
    if (!params.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Incident ID is required' 
      }, { status: 400 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const parsed = StatusUpdateSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid request body',
        errors: parsed.error.flatten()
      }, { status: 400 })
    }
    
    const { status, updated_by, notes } = parsed.data
    
    // Get current incident status
    const { data: currentIncident, error: fetchError } = await supabase
      .from('incidents')
      .select('status, assigned_to')
      .eq('id', params.id)
      .single()
    
    if (fetchError) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to fetch incident' 
      }, { status: 500 })
    }
    
    if (!currentIncident) {
      return NextResponse.json({ 
        success: false, 
        message: 'Incident not found' 
      }, { status: 404 })
    }
    
    // Update incident status
    const { data: updatedIncident, error: updateError } = await supabase
      .from('incidents')
      .update({ 
        status,
        // Set resolved_at timestamp if status is RESOLVED
        resolved_at: status === 'RESOLVED' ? new Date().toISOString() : undefined
      })
      .eq('id', params.id)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to update incident status' 
      }, { status: 500 })
    }
    
    // Record status change in incident_updates table
    const { error: logError } = await supabase
      .from('incident_updates')
      .insert({
        incident_id: params.id,
        updated_by: updated_by || null,
        previous_status: currentIncident.status,
        new_status: status,
        notes: notes || null,
        // Add timestamp for response time tracking
        created_at: new Date().toISOString()
      })
    
    if (logError) {
      console.error('Failed to log incident update:', logError)
      // Don't fail the request if logging fails, but log the error
    }
    
    // If status is RESOLVED, update volunteer response time
    if (status === 'RESOLVED' && currentIncident.assigned_to) {
      try {
        // Calculate response time (from assignment to resolution)
        const { data: assignmentUpdate } = await supabase
          .from('incident_updates')
          .select('created_at')
          .eq('incident_id', params.id)
          .eq('new_status', 'ASSIGNED')
          .order('created_at', { ascending: true })
          .limit(1)
          .single()
        
        if (assignmentUpdate) {
          const responseTimeMinutes = Math.floor(
            (new Date().getTime() - new Date(assignmentUpdate.created_at).getTime()) / 60000
          )
          
          // Store response time in volunteer activity log
          await supabase
            .from('volunteer_activity_logs')
            .insert({
              volunteer_id: currentIncident.assigned_to,
              incident_id: params.id,
              action: 'incident_resolved',
              details: {
                response_time_minutes: responseTimeMinutes
              }
            })
        }
      } catch (err) {
        console.error('Failed to calculate response time:', err)
      }
    }

    // Invalidate cache for the assigned volunteer when status changes
    // This ensures analytics reflect the latest incident data
    if (currentIncident.assigned_to) {
      analyticsCache.invalidateForVolunteer(currentIncident.assigned_to)
    }

    // Send push notification to resident (reporter) when status changes
    // NOTE: Database trigger creates notification record, but push needs to be sent manually
    if (updatedIncident && updatedIncident.reporter_id) {
      try {
        const { sendPushToUser } = await import('@/lib/push-notification-helper')
        
        const statusMessages: Record<string, string> = {
          ASSIGNED: 'Your incident has been assigned to a volunteer',
          RESPONDING: 'A volunteer is responding to your incident',
          ARRIVED: 'A volunteer has arrived at the incident location',
          RESOLVED: 'Your incident has been resolved',
          CANCELLED: 'Your incident has been cancelled'
        }
        
        const message = statusMessages[status] || `Your incident status has been updated to ${status}`
        
        await sendPushToUser(updatedIncident.reporter_id, {
          title: '📋 Incident Status Update',
          body: message,
          icon: '/favicon/android-chrome-192x192.png',
          badge: '/favicon/android-chrome-192x192.png',
          tag: 'status_update',
          data: {
            incident_id: params.id,
            url: `/resident/history?incident=${params.id}`,
            status: status,
            type: 'status_update',
            timestamp: Date.now()
          },
          requireInteraction: status === 'RESOLVED',
          vibrate: [200, 100, 200],
          actions: [
            { action: 'open', title: 'View Incident' },
            { action: 'close', title: 'Dismiss' }
          ],
          renotify: false,
          silent: false
        })
        console.log('✅ Push notification sent to resident for status update')
      } catch (pushErr) {
        console.error('❌ Failed to send push notification to resident:', pushErr)
        // Don't fail status update if push fails
      }
    }

    // Log admin action for audit trail
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', updated_by || '')
      .maybeSingle()

    if (userData?.role === 'admin') {
      try {
        await supabase
          .from('system_logs')
          .insert({
            action: 'incident_status_updated',
            user_id: updated_by || null,
            details: {
              incident_id: params.id,
              previous_status: currentIncident.status,
              new_status: status,
              assigned_to: currentIncident.assigned_to
            },
            created_at: new Date().toISOString()
          } as any)
      } catch (auditError) {
        console.error('Failed to log admin action:', auditError)
        // Don't fail the request if audit logging fails
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: updatedIncident,
      message: `Incident status updated to ${status}`
    })
    
  } catch (error: any) {
    console.error('Error updating incident status:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to update incident status' 
    }, { status: 500 })
  }
}