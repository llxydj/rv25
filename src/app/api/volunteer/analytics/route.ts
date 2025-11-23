export const dynamic = "force-dynamic";

// src/app/api/volunteer/analytics/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const volunteerId = searchParams.get('volunteer_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Build query for incidents
    let query = supabaseAdmin
      .from('incidents')
      .select(`
        id,
        incident_type,
        created_at,
        location_lat,
        location_lng,
        address,
        barangay,
        severity,
        status,
        assigned_at,
        resolved_at,
        assigned_to
      `)

    if (volunteerId && volunteerId !== 'all') {
      query = query.eq('assigned_to', volunteerId)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: incidents, error } = await query

    if (error) {
      console.error('Error fetching incidents:', error)
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      )
    }

    // Get volunteer info
    const volunteerIds = volunteerId && volunteerId !== 'all' 
      ? [volunteerId]
      : [...new Set((incidents || []).map(i => i.assigned_to).filter(Boolean))]

    if (volunteerIds.length === 0) {
      return NextResponse.json(
        { success: true, data: [] },
        { status: 200 }
      )
    }

    const { data: volunteers, error: volError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name')
      .in('id', volunteerIds)

    if (volError) {
      console.error('Error fetching volunteers:', volError)
      return NextResponse.json(
        { success: false, message: volError.message },
        { status: 400 }
      )
    }

    // Process analytics for each volunteer
    const analyticsData = volunteerIds.map(volId => {
      const volunteer = volunteers?.find(v => v.id === volId)
      const volunteerIncidents = (incidents || []).filter(i => i.assigned_to === volId)

      // Calculate statistics
      const totalIncidents = volunteerIncidents.length
      const totalResolved = volunteerIncidents.filter(i => i.status === 'RESOLVED').length

      // Calculate response times
      const responseTimes = volunteerIncidents
        .map(i => {
          if (i.assigned_at && i.resolved_at) {
            const assigned = new Date(i.assigned_at).getTime()
            const resolved = new Date(i.resolved_at).getTime()
            return Math.round((resolved - assigned) / (1000 * 60))
          }
          return null
        })
        .filter((t): t is number => t !== null)

      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null

      // Group by type
      const incidentsByType: Record<string, number> = {}
      volunteerIncidents.forEach(i => {
        const type = i.incident_type || 'Unknown'
        incidentsByType[type] = (incidentsByType[type] || 0) + 1
      })

      // Group by severity
      const incidentsBySeverity: Record<string, number> = {}
      volunteerIncidents.forEach(i => {
        const severity = i.severity || 'UNKNOWN'
        incidentsBySeverity[severity] = (incidentsBySeverity[severity] || 0) + 1
      })

      // Group by status
      const incidentsByStatus: Record<string, number> = {}
      volunteerIncidents.forEach(i => {
        const status = i.status || 'UNKNOWN'
        incidentsByStatus[status] = (incidentsByStatus[status] || 0) + 1
      })

      // Group by barangay
      const incidentsByBarangay: Record<string, number> = {}
      volunteerIncidents.forEach(i => {
        const barangay = i.barangay || 'Unknown'
        incidentsByBarangay[barangay] = (incidentsByBarangay[barangay] || 0) + 1
      })

      // Monthly trends
      const monthlyTrendsMap: Record<string, number> = {}
      volunteerIncidents.forEach(i => {
        const date = new Date(i.created_at)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        monthlyTrendsMap[monthKey] = (monthlyTrendsMap[monthKey] || 0) + 1
      })

      const monthlyTrends = Object.entries(monthlyTrendsMap)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))

      return {
        volunteer_id: volId,
        volunteer_name: volunteer ? `${volunteer.first_name} ${volunteer.last_name}` : 'Unknown',
        total_incidents: totalIncidents,
        total_resolved: totalResolved,
        average_response_time_minutes: avgResponseTime,
        incidents_by_type: incidentsByType,
        incidents_by_severity: incidentsBySeverity,
        incidents_by_status: incidentsByStatus,
        incidents_by_barangay: incidentsByBarangay,
        monthly_trends: monthlyTrends,
        recent_incidents: volunteerIncidents.slice(0, 10)
      }
    })

    // Return single object if specific volunteer, array if all
    const result = volunteerId && volunteerId !== 'all' 
      ? analyticsData[0] 
      : analyticsData

    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Unexpected error in analytics:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}