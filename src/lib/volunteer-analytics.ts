import { supabase } from "./supabase"

export interface VolunteerIncidentLog {
  id: string
  incident_type: string
  created_at: string
  location_lat: number | null
  location_lng: number | null
  address: string | null
  barangay: string | null
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL' | null
  status: string
  assigned_at: string | null
  resolved_at: string | null
  response_time_minutes: number | null
}

export interface VolunteerAnalytics {
  volunteer_id: string
  volunteer_name: string
  total_incidents: number
  total_resolved: number
  average_response_time_minutes: number | null
  incidents_by_type: Record<string, number>
  incidents_by_severity: Record<string, number>
  incidents_by_status: Record<string, number>
  incidents_by_barangay: Record<string, number>
  daily_trends: Array<{ date: string; count: number }>
  weekly_trends: Array<{ week: string; count: number }>
  monthly_trends: Array<{ month: string; count: number }>
  recent_incidents: VolunteerIncidentLog[]
}

/**
 * Extract all historical incident logs for a specific volunteer
 * Optimized for large datasets with pagination support
 */
export async function getVolunteerIncidentLogs(
  volunteerId: string,
  startDate?: string,
  endDate?: string,
  limit?: number,
  offset?: number
): Promise<{ success: boolean; data?: VolunteerIncidentLog[]; total?: number; message?: string }> {
  try {
    // Build count query first for total
    let countQuery = supabase
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', volunteerId)

    if (startDate) {
      countQuery = countQuery.gte('created_at', startDate)
    }
    if (endDate) {
      countQuery = countQuery.lte('created_at', endDate)
    }

    const { count, error: countError } = await countQuery
    if (countError) throw countError

    // Build data query with pagination
    let query = supabase
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
        resolved_at
      `)
      .eq('assigned_to', volunteerId)
      .order('created_at', { ascending: false })

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Apply pagination if provided, otherwise limit to 10000 for safety
    const maxLimit = limit || 10000
    const pageOffset = offset || 0
    query = query.range(pageOffset, pageOffset + maxLimit - 1)

    const { data, error } = await query

    if (error) throw error

    // Calculate response time for each incident
    const logs: VolunteerIncidentLog[] = (data || []).map((incident: any) => {
      let responseTimeMinutes: number | null = null
      if (incident.assigned_at && incident.resolved_at) {
        const assigned = new Date(incident.assigned_at)
        const resolved = new Date(incident.resolved_at)
        responseTimeMinutes = Math.round((resolved.getTime() - assigned.getTime()) / (1000 * 60))
      }

      return {
        id: incident.id,
        incident_type: incident.incident_type || 'Unknown',
        created_at: incident.created_at,
        location_lat: incident.location_lat,
        location_lng: incident.location_lng,
        address: incident.address,
        barangay: incident.barangay,
        severity: incident.severity,
        status: incident.status,
        assigned_at: incident.assigned_at,
        resolved_at: incident.resolved_at,
        response_time_minutes: responseTimeMinutes
      }
    })

    return { success: true, data: logs, total: count || logs.length }
  } catch (error: any) {
    console.error('Error fetching volunteer incident logs:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Generate comprehensive analytics for a volunteer
 * Optimized for large datasets - uses aggregation where possible
 */
export async function getVolunteerAnalytics(
  volunteerId: string,
  startDate?: string,
  endDate?: string,
  limit?: number
): Promise<{ success: boolean; data?: VolunteerAnalytics; message?: string }> {
  try {
    // Get volunteer info
    const { data: volunteerData, error: volunteerError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('id', volunteerId)
      .single()

    if (volunteerError) throw volunteerError

    const volunteerName = `${volunteerData.first_name} ${volunteerData.last_name}`

    // Get incident logs with limit for analytics (we don't need all for stats)
    // For large datasets, we'll sample or use aggregation
    const logsResult = await getVolunteerIncidentLogs(volunteerId, startDate, endDate, limit || 50000)
    if (!logsResult.success || !logsResult.data) {
      return { success: false, message: logsResult.message || 'Failed to fetch incident logs' }
    }

    const logs = logsResult.data
    const totalIncidents = logsResult.total || logs.length

    // Calculate statistics
    // Note: If we have a limit and total is higher, we're working with a sample
    // For resolved count, we use the actual logs we fetched (may be a sample)
    const totalResolved = logs.filter(log => log.status === 'RESOLVED').length

    // Calculate average response time
    const responseTimes = logs
      .map(log => log.response_time_minutes)
      .filter((time): time is number => time !== null)
    const averageResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
      : null

    // Group by type
    const incidentsByType: Record<string, number> = {}
    logs.forEach(log => {
      const type = log.incident_type || 'Unknown'
      incidentsByType[type] = (incidentsByType[type] || 0) + 1
    })

    // Group by severity
    const incidentsBySeverity: Record<string, number> = {}
    logs.forEach(log => {
      const severity = log.severity || 'UNKNOWN'
      incidentsBySeverity[severity] = (incidentsBySeverity[severity] || 0) + 1
    })

    // Group by status
    const incidentsByStatus: Record<string, number> = {}
    logs.forEach(log => {
      const status = log.status || 'UNKNOWN'
      incidentsByStatus[status] = (incidentsByStatus[status] || 0) + 1
    })

    // Group by barangay
    const incidentsByBarangay: Record<string, number> = {}
    logs.forEach(log => {
      const barangay = log.barangay || 'Unknown'
      incidentsByBarangay[barangay] = (incidentsByBarangay[barangay] || 0) + 1
    })

    // Calculate daily trends
    const dailyTrendsMap: Record<string, number> = {}
    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0]
      dailyTrendsMap[date] = (dailyTrendsMap[date] || 0) + 1
    })
    const dailyTrends = Object.entries(dailyTrendsMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate weekly trends
    const weeklyTrendsMap: Record<string, number> = {}
    logs.forEach(log => {
      const date = new Date(log.created_at)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      weeklyTrendsMap[weekKey] = (weeklyTrendsMap[weekKey] || 0) + 1
    })
    const weeklyTrends = Object.entries(weeklyTrendsMap)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week))

    // Calculate monthly trends
    const monthlyTrendsMap: Record<string, number> = {}
    logs.forEach(log => {
      const date = new Date(log.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyTrendsMap[monthKey] = (monthlyTrendsMap[monthKey] || 0) + 1
    })
    const monthlyTrends = Object.entries(monthlyTrendsMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Get recent incidents (last 10)
    const recentIncidents = logs.slice(0, 10)

    const analytics: VolunteerAnalytics = {
      volunteer_id: volunteerId,
      volunteer_name: volunteerName,
      total_incidents: totalIncidents, // Use total from count query
      total_resolved: totalResolved,
      average_response_time_minutes: averageResponseTime,
      incidents_by_type: incidentsByType,
      incidents_by_severity: incidentsBySeverity,
      incidents_by_status: incidentsByStatus,
      incidents_by_barangay: incidentsByBarangay,
      daily_trends: dailyTrends,
      weekly_trends: weeklyTrends,
      monthly_trends: monthlyTrends,
      recent_incidents: recentIncidents
    }

    return { success: true, data: analytics }
  } catch (error: any) {
    console.error('Error generating volunteer analytics:', error)
    return { success: false, message: error.message }
  }
}

/**
 * Get analytics for all volunteers
 */
export async function getAllVolunteersAnalytics(
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; data?: VolunteerAnalytics[]; message?: string }> {
  try {
    // Get all volunteers - check both users table and volunteer_profiles
    const { data: volunteers, error: volunteersError } = await supabase
      .from('volunteer_profiles')
      .select('volunteer_user_id')
      .eq('status', 'ACTIVE')

    if (volunteersError) {
      console.error('Error fetching volunteers from volunteer_profiles:', volunteersError)
      // Fallback to users table
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'volunteer')

      if (usersError) throw usersError

      const volunteerIds = (usersData || []).map(u => u.id)
      
      if (volunteerIds.length === 0) {
        console.log('No volunteers found in database')
        return { success: true, data: [] }
      }

      // Get analytics for each volunteer
      const analyticsPromises = volunteerIds.map(volunteerId =>
        getVolunteerAnalytics(volunteerId, startDate, endDate)
      )

      const results = await Promise.all(analyticsPromises)
      const successfulResults = results
        .filter(result => result.success && result.data)
        .map(result => result.data!)

      return { success: true, data: successfulResults }
    }

    const volunteerIds = (volunteers || []).map(v => v.volunteer_user_id).filter(Boolean)
    
    if (volunteerIds.length === 0) {
      console.log('No active volunteers found in volunteer_profiles')
      return { success: true, data: [] }
    }

    // Get analytics for each volunteer
    const analyticsPromises = volunteerIds.map(volunteerId =>
      getVolunteerAnalytics(volunteerId, startDate, endDate)
    )

    const results = await Promise.all(analyticsPromises)
    const successfulResults = results
      .filter(result => result.success && result.data)
      .map(result => result.data!)

    return { success: true, data: successfulResults }
  } catch (error: any) {
    console.error('Error fetching all volunteers analytics:', error)
    return { success: false, message: error.message || 'Failed to fetch volunteers analytics' }
  }
}

/**
 * Escape CSV field - handles commas, quotes, and newlines
 */
function escapeCSVField(field: string): string {
  if (field === null || field === undefined) return ''
  const str = String(field)
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Export volunteer analytics to CSV with proper formatting
 */
export function exportVolunteerAnalyticsToCSV(analytics: VolunteerAnalytics): string {
  const headers = [
    'Volunteer ID',
    'Volunteer Name',
    'Total Incidents',
    'Total Resolved',
    'Average Response Time (minutes)',
    'Incidents by Type',
    'Incidents by Severity',
    'Incidents by Status',
    'Incidents by Barangay'
  ]

  const rows = [
    [
      escapeCSVField(analytics.volunteer_id),
      escapeCSVField(analytics.volunteer_name),
      escapeCSVField(analytics.total_incidents.toString()),
      escapeCSVField(analytics.total_resolved.toString()),
      escapeCSVField(analytics.average_response_time_minutes?.toString() || 'N/A'),
      escapeCSVField(JSON.stringify(analytics.incidents_by_type)),
      escapeCSVField(JSON.stringify(analytics.incidents_by_severity)),
      escapeCSVField(JSON.stringify(analytics.incidents_by_status)),
      escapeCSVField(JSON.stringify(analytics.incidents_by_barangay))
    ]
  ]

  return [headers.map(escapeCSVField).join(','), ...rows.map(row => row.join(','))].join('\n')
}

