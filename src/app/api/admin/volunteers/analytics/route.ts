// src/app/api/admin/volunteers/analytics/route.ts

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Get volunteer analytics including incidents, schedules, attendance, training performance
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const volunteerId = searchParams.get('volunteer_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!volunteerId) {
      return NextResponse.json({ success: false, message: 'volunteer_id is required' }, { status: 400 })
    }

    // Build date filter
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) dateFilter.lte = endDate

    // Get volunteer incidents
    let incidentsQuery = supabaseAdmin
      .from('incidents')
      .select('id, incident_type, status, created_at, resolved_at, reference_id')
      .eq('assigned_volunteer_id', volunteerId)
      .order('created_at', { ascending: false })

    if (startDate) incidentsQuery = incidentsQuery.gte('created_at', startDate)
    if (endDate) incidentsQuery = incidentsQuery.lte('created_at', endDate)

    const { data: incidents } = await incidentsQuery

    // Get schedules and attendance
    let schedulesQuery = supabaseAdmin
      .from('schedules')
      .select('id, title, start_time, end_time, is_accepted, attendance_marked, attendance_notes, status')
      .eq('volunteer_id', volunteerId)
      .order('start_time', { ascending: false })

    if (startDate) schedulesQuery = schedulesQuery.gte('start_time', startDate)
    if (endDate) schedulesQuery = schedulesQuery.lte('start_time', endDate)

    const { data: schedules } = await schedulesQuery

    // Get training enrollments and evaluations
    const { data: enrollments } = await supabaseAdmin
      .from('training_enrollments')
      .select(`
        *,
        training:trainings (
          id, title, start_at, end_at, status
        )
      `)
      .eq('user_id', volunteerId)

    const { data: evaluations } = await supabaseAdmin
      .from('training_evaluations_admin')
      .select(`
        *,
        training:trainings (
          id, title
        )
      `)
      .eq('user_id', volunteerId)

    // Calculate statistics
    const totalIncidents = incidents?.length || 0
    const resolvedIncidents = incidents?.filter((i: any) => i.status === 'RESOLVED').length || 0
    const totalSchedules = schedules?.length || 0
    const acceptedSchedules = schedules?.filter((s: any) => s.is_accepted === true).length || 0
    const attendanceMarked = schedules?.filter((s: any) => s.attendance_marked === true).length || 0
    const presentCount = schedules?.filter((s: any) => 
      s.attendance_marked && s.attendance_notes?.startsWith('PRESENT')
    ).length || 0
    const totalTrainings = enrollments?.length || 0
    const avgPerformanceRating = evaluations && evaluations.length > 0
      ? evaluations.reduce((sum: number, e: any) => sum + (e.performance_rating || 0), 0) / evaluations.length
      : 0

    return NextResponse.json({
      success: true,
      data: {
        volunteer_id: volunteerId,
        period: { start_date: startDate, end_date: endDate },
        incidents: {
          total: totalIncidents,
          resolved: resolvedIncidents,
          pending: totalIncidents - resolvedIncidents,
          list: incidents || []
        },
        schedules: {
          total: totalSchedules,
          accepted: acceptedSchedules,
          declined: totalSchedules - acceptedSchedules,
          attendance_marked: attendanceMarked,
          present: presentCount,
          absent: attendanceMarked - presentCount,
          list: schedules || []
        },
        trainings: {
          total: totalTrainings,
          evaluations: evaluations?.length || 0,
          avg_performance_rating: avgPerformanceRating,
          enrollments: enrollments || [],
          evaluations: evaluations || []
        }
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch analytics' }, { status: 500 })
  }
}

