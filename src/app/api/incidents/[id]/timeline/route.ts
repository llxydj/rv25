// src/app/api/incidents/[id]/timeline/route.ts
// API endpoint to fetch incident timeline events

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { getIncidentTimeline } from '@/lib/incident-timeline'

export const runtime = 'nodejs'

/**
 * GET /api/incidents/[id]/timeline
 * Fetch timeline events for a specific incident
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getServerSupabase()
    
    // Validate incident ID
    if (!params.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Incident ID is required' 
      }, { status: 400 })
    }

    // Verify user is authenticated
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'Not authenticated' 
      }, { status: 401 })
    }

    // Verify incident exists and user has access
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('id, reporter_id, assigned_to, created_at')
      .eq('id', params.id)
      .single()

    if (incidentError || !incident) {
      return NextResponse.json({ 
        success: false, 
        message: 'Incident not found' 
      }, { status: 404 })
    }

    // Check user role and access
    const { data: user } = await supabase
      .from('users')
      .select('role, id')
      .eq('id', userRes.user.id)
      .single()

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        message: 'User not found' 
      }, { status: 404 })
    }

    // Access control: admins can see all, volunteers can see assigned, residents can see their own
    const hasAccess = 
      user.role === 'admin' ||
      (user.role === 'volunteer' && incident.assigned_to === user.id) ||
      (user.role === 'resident' && incident.reporter_id === user.id)

    if (!hasAccess) {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'You do not have access to this incident timeline' 
      }, { status: 403 })
    }

    // Fetch timeline events
    const timelineResult = await getIncidentTimeline(params.id)

    if (!timelineResult.success) {
      return NextResponse.json({ 
        success: false, 
        message: timelineResult.error || 'Failed to fetch timeline' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: timelineResult.events,
      incident: {
        id: incident.id,
        created_at: incident.created_at
      }
    })

  } catch (error: any) {
    console.error('Error fetching incident timeline:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to fetch incident timeline' 
    }, { status: 500 })
  }
}

