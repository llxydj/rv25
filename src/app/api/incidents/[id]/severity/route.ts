import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { z } from 'zod'
import { analyticsCache } from '@/app/api/volunteers/analytics/cache'

const SeverityUpdateSchema = z.object({
  severity: z.enum(['MINOR', 'MODERATE', 'SEVERE', 'CRITICAL']),
  updated_by: z.string().optional(),
  notes: z.string().optional()
})

/**
 * PATCH /api/incidents/[id]/severity
 * Update incident severity - ONLY allowed when volunteer has ARRIVED at the scene
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes } = await supabase.auth.getUser()
    
    if (!userRes?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'Not authenticated' 
      }, { status: 401 })
    }

    const userId = userRes.user.id

    // Validate incident ID
    if (!params.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Incident ID is required' 
      }, { status: 400 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const parsed = SeverityUpdateSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid request body',
        errors: parsed.error.flatten()
      }, { status: 400 })
    }
    
    const { severity, updated_by, notes } = parsed.data
    
    // Get current incident
    const { data: currentIncident, error: fetchError } = await supabase
      .from('incidents')
      .select('status, assigned_to, severity')
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

    // Check user role
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        message: 'User not found' 
      }, { status: 404 })
    }

    // CRITICAL: Only allow severity update if:
    // 1. User is admin (can always update), OR
    // 2. User is volunteer AND incident is assigned to them AND status is ARRIVED
    if (user.role === 'volunteer') {
      if (currentIncident.assigned_to !== userId) {
        return NextResponse.json({ 
          success: false, 
          code: 'FORBIDDEN',
          message: 'You can only update severity for incidents assigned to you' 
        }, { status: 403 })
      }

      if (currentIncident.status !== 'ARRIVED') {
        return NextResponse.json({ 
          success: false, 
          code: 'INVALID_STATUS',
          message: 'Severity can only be updated when you have arrived at the scene (status must be ARRIVED)' 
        }, { status: 400 })
      }
    }

    // Use a transaction-like approach with row-level locking to prevent race conditions
    // Re-fetch with FOR UPDATE equivalent (Supabase doesn't support SELECT FOR UPDATE directly,
    // but we can use a conditional update that checks status hasn't changed)
    const { data: verifyIncident, error: verifyError } = await supabase
      .from('incidents')
      .select('status, assigned_to')
      .eq('id', params.id)
      .single()

    if (verifyError || !verifyIncident) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to verify incident state' 
      }, { status: 500 })
    }

    // Double-check status hasn't changed (race condition prevention)
    if (user.role === 'volunteer' && verifyIncident.status !== 'ARRIVED') {
      return NextResponse.json({ 
        success: false, 
        code: 'STATUS_CHANGED',
        message: 'Incident status has changed. Please refresh and try again.' 
      }, { status: 409 })
    }

    // Update incident severity with conditional check to prevent concurrent updates
    const { data: updatedIncident, error: updateError } = await supabase
      .from('incidents')
      .update({ 
        severity,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      // For volunteers, ensure status is still ARRIVED (additional safety check)
      .eq(user.role === 'volunteer' ? 'status' : 'id', user.role === 'volunteer' ? 'ARRIVED' : params.id)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to update incident severity' 
      }, { status: 500 })
    }
    
    // Record severity change in incident_updates table
    const { error: logError } = await supabase
      .from('incident_updates')
      .insert({
        incident_id: params.id,
        updated_by: updated_by || userId,
        previous_status: currentIncident.status,
        new_status: currentIncident.status, // Status doesn't change, only severity
        notes: notes || `Severity updated to ${severity}${currentIncident.severity ? ` (was ${currentIncident.severity})` : ''}`,
        created_at: new Date().toISOString()
      })
    
    if (logError) {
      console.error('Failed to log severity update:', logError)
      // Don't fail the request if logging fails
    }

    // Invalidate cache for the assigned volunteer if applicable
    if (currentIncident.assigned_to) {
      analyticsCache.invalidateForVolunteer(currentIncident.assigned_to)
    }

    // Log admin action for audit trail
    if (user.role === 'admin') {
      try {
        await supabase
          .from('system_logs')
          .insert({
            action: 'incident_severity_updated',
            user_id: userId,
            details: {
              incident_id: params.id,
              previous_severity: currentIncident.severity,
              new_severity: severity,
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
      message: `Incident severity updated to ${severity}`
    })
    
  } catch (error: any) {
    console.error('Error updating incident severity:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to update incident severity' 
    }, { status: 500 })
  }
}

