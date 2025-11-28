// src/app/api/admin/activities/reports/route.ts

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Get activity/schedule summary reports
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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const groupBy = searchParams.get('group_by') || 'day' // day, week, month

    // Get all schedules in date range
    let schedulesQuery = supabaseAdmin
      .from('schedules')
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email
        )
      `)
      .order('start_time', { ascending: false })

    if (startDate) schedulesQuery = schedulesQuery.gte('start_time', startDate)
    if (endDate) schedulesQuery = schedulesQuery.lte('start_time', endDate)

    const { data: schedules } = await schedulesQuery

    // Get all trainings in date range
    let trainingsQuery = supabaseAdmin
      .from('trainings')
      .select('*')
      .order('start_at', { ascending: false })

    if (startDate) trainingsQuery = trainingsQuery.gte('start_at', startDate)
    if (endDate) trainingsQuery = trainingsQuery.lte('start_at', endDate)

    const { data: trainings } = await trainingsQuery

    // Calculate summary statistics
    const totalSchedules = schedules?.length || 0
    const acceptedSchedules = schedules?.filter((s: any) => s.is_accepted === true).length || 0
    const declinedSchedules = schedules?.filter((s: any) => s.is_accepted === false).length || 0
    const pendingResponse = schedules?.filter((s: any) => s.is_accepted === null).length || 0
    const attendanceMarked = schedules?.filter((s: any) => s.attendance_marked === true).length || 0
    const presentCount = schedules?.filter((s: any) => 
      s.attendance_marked && s.attendance_notes?.startsWith('PRESENT')
    ).length || 0

    const totalTrainings = trainings?.length || 0
    const completedTrainings = trainings?.filter((t: any) => t.status === 'COMPLETED').length || 0

    // Group by date for trends
    const scheduleByDate: Record<string, { total: number; accepted: number; present: number }> = {}
    schedules?.forEach((s: any) => {
      const date = new Date(s.start_time).toISOString().split('T')[0]
      if (!scheduleByDate[date]) {
        scheduleByDate[date] = { total: 0, accepted: 0, present: 0 }
      }
      scheduleByDate[date].total++
      if (s.is_accepted) scheduleByDate[date].accepted++
      if (s.attendance_marked && s.attendance_notes?.startsWith('PRESENT')) {
        scheduleByDate[date].present++
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        schedules: {
          total: totalSchedules,
          accepted: acceptedSchedules,
          declined: declinedSchedules,
          pending_response: pendingResponse,
          attendance_marked: attendanceMarked,
          present: presentCount,
          absent: attendanceMarked - presentCount,
          acceptance_rate: totalSchedules > 0 ? (acceptedSchedules / totalSchedules) * 100 : 0,
          attendance_rate: acceptedSchedules > 0 ? (presentCount / acceptedSchedules) * 100 : 0,
          by_date: scheduleByDate
        },
        trainings: {
          total: totalTrainings,
          completed: completedTrainings,
          scheduled: trainings?.filter((t: any) => t.status === 'SCHEDULED').length || 0,
          ongoing: trainings?.filter((t: any) => t.status === 'ONGOING').length || 0,
          cancelled: trainings?.filter((t: any) => t.status === 'CANCELLED').length || 0
        },
        summary: {
          total_activities: totalSchedules + totalTrainings,
          total_participants: new Set(schedules?.map((s: any) => s.volunteer_id).filter(Boolean)).size,
          avg_acceptance_rate: totalSchedules > 0 ? (acceptedSchedules / totalSchedules) * 100 : 0,
          avg_attendance_rate: acceptedSchedules > 0 ? (presentCount / acceptedSchedules) * 100 : 0
        }
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to generate report' }, { status: 500 })
  }
}

