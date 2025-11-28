// src/app/api/admin/analytics/system/route.ts

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Get system-wide analytics
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
    const period = searchParams.get('period') || 'monthly' // daily, weekly, monthly
    const barangay = searchParams.get('barangay')

    // Build date filter
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) dateFilter.lte = endDate

    // Get incidents
    let incidentsQuery = supabaseAdmin
      .from('incidents')
      .select('id, incident_type, status, created_at, resolved_at, barangay, reference_id')
      .order('created_at', { ascending: false })

    if (startDate) incidentsQuery = incidentsQuery.gte('created_at', startDate)
    if (endDate) incidentsQuery = incidentsQuery.lte('created_at', endDate)
    if (barangay) incidentsQuery = incidentsQuery.eq('barangay', barangay)

    const { data: incidents } = await incidentsQuery

    // Get volunteers
    const { data: volunteers } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, role')
      .eq('role', 'volunteer')
      .eq('status', 'active')

    // Get schedules
    let schedulesQuery = supabaseAdmin
      .from('schedules')
      .select('id, status, start_time, attendance_marked')
      .order('start_time', { ascending: false })

    if (startDate) schedulesQuery = schedulesQuery.gte('start_time', startDate)
    if (endDate) schedulesQuery = schedulesQuery.lte('start_time', endDate)

    const { data: schedules } = await schedulesQuery

    // Calculate statistics
    const totalIncidents = incidents?.length || 0
    const resolvedIncidents = incidents?.filter((i: any) => i.status === 'RESOLVED').length || 0
    const pendingIncidents = incidents?.filter((i: any) => i.status === 'PENDING').length || 0
    const inProgressIncidents = incidents?.filter((i: any) => i.status === 'IN_PROGRESS').length || 0

    // Group by incident type
    const incidentsByType: Record<string, number> = {}
    incidents?.forEach((incident: any) => {
      const type = incident.incident_type || 'OTHER'
      incidentsByType[type] = (incidentsByType[type] || 0) + 1
    })

    // Group by barangay
    const incidentsByBarangay: Record<string, number> = {}
    incidents?.forEach((incident: any) => {
      const brgy = incident.barangay || 'Unknown'
      incidentsByBarangay[brgy] = (incidentsByBarangay[brgy] || 0) + 1
    })

    // Group by period (daily/weekly/monthly)
    const incidentsByPeriod: Record<string, { count: number; resolved: number }> = {}
    incidents?.forEach((incident: any) => {
      const date = new Date(incident.created_at)
      let key = ''
      
      if (period === 'daily') {
        key = date.toISOString().split('T')[0]
      } else if (period === 'weekly') {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }

      if (!incidentsByPeriod[key]) {
        incidentsByPeriod[key] = { count: 0, resolved: 0 }
      }
      incidentsByPeriod[key].count++
      if (incident.status === 'RESOLVED') {
        incidentsByPeriod[key].resolved++
      }
    })

    // Calculate average response time
    const resolvedWithTimes = incidents?.filter((i: any) => 
      i.status === 'RESOLVED' && i.created_at && i.resolved_at
    ) || []
    
    const avgResponseTime = resolvedWithTimes.length > 0
      ? resolvedWithTimes.reduce((sum: number, i: any) => {
          const created = new Date(i.created_at).getTime()
          const resolved = new Date(i.resolved_at).getTime()
          return sum + (resolved - created)
        }, 0) / resolvedWithTimes.length / (1000 * 60) // Convert to minutes
      : 0

    // Schedule statistics
    const totalSchedules = schedules?.length || 0
    const attendanceRate = totalSchedules > 0
      ? ((schedules?.filter((s: any) => s.attendance_marked).length || 0) / totalSchedules) * 100
      : 0

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate, period },
        summary: {
          total_incidents: totalIncidents,
          resolved: resolvedIncidents,
          pending: pendingIncidents,
          in_progress: inProgressIncidents,
          resolution_rate: totalIncidents > 0 ? (resolvedIncidents / totalIncidents) * 100 : 0,
          avg_response_time_minutes: Math.round(avgResponseTime),
          total_volunteers: volunteers?.length || 0,
          total_schedules: totalSchedules,
          attendance_rate: Math.round(attendanceRate)
        },
        by_type: incidentsByType,
        by_barangay: incidentsByBarangay,
        by_period: incidentsByPeriod,
        trends: {
          daily: period === 'daily' ? incidentsByPeriod : {},
          weekly: period === 'weekly' ? incidentsByPeriod : {},
          monthly: period === 'monthly' ? incidentsByPeriod : {}
        }
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch system analytics' }, { status: 500 })
  }
}

