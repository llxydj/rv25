import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Complete incident analytics with ALL details
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
    const incidentType = searchParams.get('incident_type')
    const status = searchParams.get('status')
    const barangay = searchParams.get('barangay')
    const severity = searchParams.get('severity')
    const volunteerId = searchParams.get('volunteer_id')

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'Start date and end date are required' }, { status: 400 })
    }

    // Get ALL incident details with related data
    let incidentsQuery = supabaseAdmin
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id, first_name, last_name, email, phone_number, barangay
        ),
        volunteer:users!incidents_assigned_to_fkey (
          id, first_name, last_name, email, phone_number
        ),
        incident_updates (
          id, updated_by, previous_status, new_status, notes, created_at
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (incidentType) incidentsQuery = incidentsQuery.eq('incident_type', incidentType)
    if (status) incidentsQuery = incidentsQuery.eq('status', status)
    if (barangay) incidentsQuery = incidentsQuery.eq('barangay', barangay)
    if (severity) incidentsQuery = incidentsQuery.eq('severity', severity)
    if (volunteerId) incidentsQuery = incidentsQuery.eq('assigned_to', volunteerId)

    const { data: incidents, error } = await incidentsQuery

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    // Calculate comprehensive statistics
    const totalIncidents = incidents?.length || 0
    const resolvedIncidents = incidents?.filter((i: any) => i.status === 'RESOLVED').length || 0
    const pendingIncidents = incidents?.filter((i: any) => i.status === 'PENDING').length || 0
    const inProgressIncidents = incidents?.filter((i: any) => i.status === 'IN_PROGRESS').length || 0
    const assignedIncidents = incidents?.filter((i: any) => i.status === 'ASSIGNED').length || 0
    const arrivedIncidents = incidents?.filter((i: any) => i.status === 'ARRIVED').length || 0
    const cancelledIncidents = incidents?.filter((i: any) => i.status === 'CANCELLED').length || 0

    // Response time analysis
    const resolvedWithTimes = incidents?.filter((i: any) => 
      i.status === 'RESOLVED' && i.assigned_at && i.resolved_at
    ) || []
    
    const responseTimes = resolvedWithTimes.map((i: any) => {
      const assigned = new Date(i.assigned_at).getTime()
      const resolved = new Date(i.resolved_at).getTime()
      return (resolved - assigned) / (1000 * 60) // minutes
    })

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0

    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0
    const medianResponseTime = responseTimes.length > 0
      ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length / 2)]
      : 0

    // Group by type
    const byType: Record<string, any> = {}
    incidents?.forEach((incident: any) => {
      const type = incident.incident_type || 'OTHER'
      if (!byType[type]) {
        byType[type] = { count: 0, resolved: 0, pending: 0, avg_response_time: 0, incidents: [] }
      }
      byType[type].count++
      if (incident.status === 'RESOLVED') byType[type].resolved++
      if (incident.status === 'PENDING') byType[type].pending++
      byType[type].incidents.push(incident.id)
    })

    // Calculate avg response time per type
    Object.keys(byType).forEach(type => {
      const typeIncidents = incidents?.filter((i: any) => i.incident_type === type && i.status === 'RESOLVED' && i.assigned_at && i.resolved_at) || []
      if (typeIncidents.length > 0) {
        const times = typeIncidents.map((i: any) => {
          const assigned = new Date(i.assigned_at).getTime()
          const resolved = new Date(i.resolved_at).getTime()
          return (resolved - assigned) / (1000 * 60)
        })
        byType[type].avg_response_time = times.reduce((sum, time) => sum + time, 0) / times.length
      }
    })

    // Group by barangay
    const byBarangay: Record<string, any> = {}
    incidents?.forEach((incident: any) => {
      const brgy = incident.barangay || 'Unknown'
      if (!byBarangay[brgy]) {
        byBarangay[brgy] = { count: 0, resolved: 0, pending: 0, incidents: [] }
      }
      byBarangay[brgy].count++
      if (incident.status === 'RESOLVED') byBarangay[brgy].resolved++
      if (incident.status === 'PENDING') byBarangay[brgy].pending++
      byBarangay[brgy].incidents.push(incident.id)
    })

    // Group by severity
    const bySeverity: Record<string, any> = {}
    incidents?.forEach((incident: any) => {
      const sev = incident.severity || 'MODERATE'
      if (!bySeverity[sev]) {
        bySeverity[sev] = { count: 0, resolved: 0, pending: 0, avg_response_time: 0 }
      }
      bySeverity[sev].count++
      if (incident.status === 'RESOLVED') bySeverity[sev].resolved++
      if (incident.status === 'PENDING') bySeverity[sev].pending++
    })

    // Group by volunteer
    const byVolunteer: Record<string, any> = {}
    incidents?.forEach((incident: any) => {
      if (incident.assigned_to && incident.volunteer) {
        const volId = incident.assigned_to
        if (!byVolunteer[volId]) {
          byVolunteer[volId] = {
            volunteer_id: volId,
            volunteer_name: `${incident.volunteer.first_name} ${incident.volunteer.last_name}`,
            count: 0,
            resolved: 0,
            pending: 0,
            avg_response_time: 0,
            incidents: []
          }
        }
        byVolunteer[volId].count++
        if (incident.status === 'RESOLVED') byVolunteer[volId].resolved++
        if (incident.status === 'PENDING') byVolunteer[volId].pending++
        byVolunteer[volId].incidents.push(incident.id)
      }
    })

    // Calculate avg response time per volunteer
    Object.keys(byVolunteer).forEach(volId => {
      const volIncidents = incidents?.filter((i: any) => 
        i.assigned_to === volId && i.status === 'RESOLVED' && i.assigned_at && i.resolved_at
      ) || []
      if (volIncidents.length > 0) {
        const times = volIncidents.map((i: any) => {
          const assigned = new Date(i.assigned_at).getTime()
          const resolved = new Date(i.resolved_at).getTime()
          return (resolved - assigned) / (1000 * 60)
        })
        byVolunteer[volId].avg_response_time = times.reduce((sum, time) => sum + time, 0) / times.length
      }
    })

    // Time-based patterns
    const byHour: Record<number, number> = {}
    const byDayOfWeek: Record<number, number> = {}
    const byMonth: Record<string, number> = {}
    const byDate: Record<string, number> = {}

    incidents?.forEach((incident: any) => {
      const date = new Date(incident.created_at)
      const hour = date.getHours()
      const dayOfWeek = date.getDay()
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const dateKey = date.toISOString().split('T')[0]

      byHour[hour] = (byHour[hour] || 0) + 1
      byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + 1
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1
      byDate[dateKey] = (byDate[dateKey] || 0) + 1
    })

    // Status transitions
    const statusTransitions: Record<string, number> = {}
    incidents?.forEach((incident: any) => {
      if (incident.incident_updates && incident.incident_updates.length > 0) {
        incident.incident_updates.forEach((update: any) => {
          const transition = `${update.previous_status} → ${update.new_status}`
          statusTransitions[transition] = (statusTransitions[transition] || 0) + 1
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        filters: { incident_type: incidentType, status, barangay, severity, volunteer_id: volunteerId },
        summary: {
          total_incidents: totalIncidents,
          resolved: resolvedIncidents,
          pending: pendingIncidents,
          in_progress: inProgressIncidents,
          assigned: assignedIncidents,
          arrived: arrivedIncidents,
          cancelled: cancelledIncidents,
          resolution_rate: totalIncidents > 0 ? (resolvedIncidents / totalIncidents) * 100 : 0,
          response_time: {
            average: Math.round(avgResponseTime),
            minimum: Math.round(minResponseTime),
            maximum: Math.round(maxResponseTime),
            median: Math.round(medianResponseTime)
          }
        },
        by_type: byType,
        by_barangay: byBarangay,
        by_severity: bySeverity,
        by_volunteer: byVolunteer,
        time_patterns: {
          by_hour: byHour,
          by_day_of_week: byDayOfWeek,
          by_month: byMonth,
          by_date: byDate
        },
        status_transitions: statusTransitions,
        incidents: incidents || []
      }
    })
  } catch (e: any) {
    console.error('Complete incident analytics error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch complete incident analytics' }, { status: 500 })
  }
}


