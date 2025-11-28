import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

interface AnalyticsPeriod {
  start_date: string
  end_date: string
  compare_period?: { start_date: string; end_date: string }
}

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
    const compareStartDate = searchParams.get('compare_start_date')
    const compareEndDate = searchParams.get('compare_end_date')
    const barangay = searchParams.get('barangay')
    const incidentType = searchParams.get('incident_type')
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'Start date and end date are required' }, { status: 400 })
    }

    // Get current period data
    const currentPeriod = await getPeriodData(startDate, endDate, barangay, incidentType, status, severity)
    
    // Get comparison period data if provided
    let comparisonPeriod = null
    if (compareStartDate && compareEndDate) {
      comparisonPeriod = await getPeriodData(compareStartDate, compareEndDate, barangay, incidentType, status, severity)
    }

    // Calculate trends
    const trends = calculateTrends(currentPeriod, comparisonPeriod)

    // Generate insights
    const insights = generateInsights(currentPeriod, comparisonPeriod, trends)

    // Calculate statistics
    const statistics = calculateStatistics(currentPeriod, comparisonPeriod)

    // Geographic analysis
    const geographic = await getGeographicAnalysis(startDate, endDate)

    // Time-based patterns
    const timePatterns = await getTimePatterns(startDate, endDate, barangay, incidentType, status, severity)

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        comparison_period: comparisonPeriod ? { start_date: compareStartDate, end_date: compareEndDate } : null,
        summary: currentPeriod.summary,
        trends,
        insights,
        statistics,
        geographic,
        time_patterns: timePatterns,
        comparisons: comparisonPeriod ? {
          incidents_change: calculatePercentageChange(
            comparisonPeriod.summary.total_incidents,
            currentPeriod.summary.total_incidents
          ),
          resolution_rate_change: calculatePercentageChange(
            comparisonPeriod.summary.resolution_rate,
            currentPeriod.summary.resolution_rate
          ),
          response_time_change: calculatePercentageChange(
            comparisonPeriod.summary.avg_response_time_minutes,
            currentPeriod.summary.avg_response_time_minutes,
            true // inverse - lower is better
          )
        } : null
      }
    })
  } catch (e: any) {
    console.error('Comprehensive analytics error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch comprehensive analytics' }, { status: 500 })
  }
}

async function getPeriodData(startDate: string, endDate: string, barangay?: string | null, incidentType?: string | null, status?: string | null, severity?: string | null) {
  let incidentsQuery = supabaseAdmin
    .from('incidents')
    .select('id, incident_type, status, created_at, resolved_at, assigned_at, barangay, severity, location_lat, location_lng, address')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (barangay) incidentsQuery = incidentsQuery.eq('barangay', barangay)
  if (incidentType) incidentsQuery = incidentsQuery.eq('incident_type', incidentType)
  if (status) incidentsQuery = incidentsQuery.eq('status', status)
  if (severity) incidentsQuery = incidentsQuery.eq('severity', severity)

  const { data: incidents } = await incidentsQuery

  // Get timeline events for incidents in this period
  const incidentIds = incidents?.map((i: any) => i.id) || []
  let timelineEvents: any[] = []
  if (incidentIds.length > 0) {
    const { data: updates } = await supabaseAdmin
      .from('incident_updates')
      .select('incident_id, created_at, new_status, previous_status, notes')
      .in('incident_id', incidentIds)
      .order('created_at', { ascending: false })
    
    timelineEvents = updates || []
  }

  // Get volunteers
  const { data: volunteers } = await supabaseAdmin
    .from('users')
    .select('id, first_name, last_name, role, barangay')
    .eq('role', 'volunteer')
    .eq('status', 'active')

  // Calculate metrics
  const totalIncidents = incidents?.length || 0
  const resolvedIncidents = incidents?.filter((i: any) => i.status === 'RESOLVED').length || 0
  const pendingIncidents = incidents?.filter((i: any) => i.status === 'PENDING').length || 0
  const inProgressIncidents = incidents?.filter((i: any) => i.status === 'IN_PROGRESS').length || 0

  // Response time calculation
  const resolvedWithTimes = incidents?.filter((i: any) => 
    i.status === 'RESOLVED' && i.assigned_at && i.resolved_at
  ) || []
  
  const avgResponseTime = resolvedWithTimes.length > 0
    ? resolvedWithTimes.reduce((sum: number, i: any) => {
        const assigned = new Date(i.assigned_at).getTime()
        const resolved = new Date(i.resolved_at).getTime()
        return sum + (resolved - assigned)
      }, 0) / resolvedWithTimes.length / (1000 * 60) // minutes
    : 0

  // Group by type
  const byType: Record<string, number> = {}
  incidents?.forEach((incident: any) => {
    const type = incident.incident_type || 'OTHER'
    byType[type] = (byType[type] || 0) + 1
  })

  // Group by barangay
  const byBarangay: Record<string, number> = {}
  incidents?.forEach((incident: any) => {
    const brgy = incident.barangay || 'Unknown'
    byBarangay[brgy] = (byBarangay[brgy] || 0) + 1
  })

  // Group by severity
  const bySeverity: Record<string, number> = {}
  incidents?.forEach((incident: any) => {
    const severity = incident.severity || 'MODERATE'
    bySeverity[severity] = (bySeverity[severity] || 0) + 1
  })

  // Calculate timeline metrics
  const timelineMetrics = {
    total_timeline_events: timelineEvents.length,
    avg_events_per_incident: totalIncidents > 0 ? (timelineEvents.length / totalIncidents) : 0,
    events_by_type: timelineEvents.reduce((acc: Record<string, number>, event: any) => {
      // Infer event type from status changes
      let eventType = 'STATUS_CHANGE'
      if (event.previous_status === 'SEVERITY_UPDATE' && event.new_status === 'SEVERITY_UPDATE') {
        eventType = 'SEVERITY_CHANGED'
      } else if (event.notes?.includes('Photo') || event.notes?.includes('photo')) {
        eventType = 'PHOTO_ADDED'
      } else if (event.notes?.includes('Location') || event.notes?.includes('location')) {
        eventType = 'LOCATION_UPDATED'
      } else if (event.notes?.includes('Resolution notes') || event.notes?.includes('resolution')) {
        eventType = 'RESOLUTION_NOTES'
      } else if (event.previous_status === 'PENDING' && event.new_status === 'ASSIGNED') {
        eventType = 'ASSIGNED'
      } else if (event.previous_status === 'ASSIGNED' && event.new_status === 'ASSIGNED') {
        eventType = 'REASSIGNED'
      }
      acc[eventType] = (acc[eventType] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    incidents_with_timeline: new Set(timelineEvents.map((e: any) => e.incident_id)).size,
    last_update_timestamp: timelineEvents.length > 0 
      ? timelineEvents[0].created_at 
      : null
  }

  return {
    summary: {
      total_incidents: totalIncidents,
      resolved: resolvedIncidents,
      pending: pendingIncidents,
      in_progress: inProgressIncidents,
      resolution_rate: totalIncidents > 0 ? (resolvedIncidents / totalIncidents) * 100 : 0,
      avg_response_time_minutes: Math.round(avgResponseTime),
      total_volunteers: volunteers?.length || 0,
      by_type: byType,
      by_barangay: byBarangay,
      by_severity: bySeverity,
      timeline: timelineMetrics
    },
    incidents: incidents || [],
    timeline_events: timelineEvents
  }
}

function calculateTrends(current: any, comparison: any) {
  if (!comparison) return null

  return {
    incidents_trend: current.summary.total_incidents > comparison.summary.total_incidents ? 'increasing' : 
                     current.summary.total_incidents < comparison.summary.total_incidents ? 'decreasing' : 'stable',
    resolution_trend: current.summary.resolution_rate > comparison.summary.resolution_rate ? 'improving' :
                      current.summary.resolution_rate < comparison.summary.resolution_rate ? 'declining' : 'stable',
    response_time_trend: current.summary.avg_response_time_minutes < comparison.summary.avg_response_time_minutes ? 'improving' :
                         current.summary.avg_response_time_minutes > comparison.summary.avg_response_time_minutes ? 'declining' : 'stable'
  }
}

function generateInsights(current: any, comparison: any, trends: any) {
  const insights: string[] = []
  const recommendations: string[] = []

  // Incident volume insights
  if (current.summary.total_incidents > 100) {
    insights.push(`High incident volume: ${current.summary.total_incidents} incidents in this period`)
    recommendations.push('Consider increasing volunteer capacity or implementing preventive measures')
  }

  // Resolution rate insights
  if (current.summary.resolution_rate < 70) {
    insights.push(`Low resolution rate: ${current.summary.resolution_rate.toFixed(1)}% - below target of 80%`)
    recommendations.push('Review resource allocation and volunteer response protocols')
  }

  // Response time insights
  if (current.summary.avg_response_time_minutes > 60) {
    insights.push(`Slow response time: ${current.summary.avg_response_time_minutes} minutes average`)
    recommendations.push('Optimize volunteer deployment and improve communication systems')
  }

  // Trend insights
  if (trends) {
    if (trends.incidents_trend === 'increasing') {
      insights.push('Incident volume is increasing compared to previous period')
      recommendations.push('Investigate root causes and implement preventive programs')
    }
    if (trends.resolution_trend === 'declining') {
      insights.push('Resolution rate is declining - immediate attention required')
      recommendations.push('Conduct performance review and provide additional training')
    }
  }

  // Geographic insights
  const topBarangay = Object.entries(current.by_barangay)
    .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)[0]
  if (topBarangay) {
    insights.push(`Highest incident area: ${topBarangay[0]} with ${topBarangay[1]} incidents`)
    recommendations.push(`Consider allocating additional resources to ${topBarangay[0]}`)
  }

  // Type insights
  const topType = Object.entries(current.by_type)
    .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)[0]
  if (topType) {
    insights.push(`Most common incident type: ${topType[0]} (${topType[1]} cases)`)
    recommendations.push(`Develop specialized response protocols for ${topType[0]} incidents`)
  }

  return { insights, recommendations }
}

function calculateStatistics(current: any, comparison: any) {
  const startDate = new Date(current.summary.total_incidents > 0 ? '2024-01-01' : '2024-01-01')
  const endDate = new Date('2024-12-31')
  const days = getDaysBetween(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
  
  const stats: any = {
    incident_frequency: current.summary.total_incidents > 0 && days > 0 ? 
      (current.summary.total_incidents / days).toFixed(2) : '0',
    volunteer_efficiency: current.summary.total_volunteers > 0 ?
      (current.summary.total_incidents / current.summary.total_volunteers).toFixed(1) : '0',
    resolution_efficiency: current.summary.total_incidents > 0 ?
      (current.summary.resolved / current.summary.total_incidents * 100).toFixed(1) : '0'
  }

  if (comparison) {
    stats.incidents_change_percent = calculatePercentageChange(
      comparison.summary.total_incidents,
      current.summary.total_incidents
    )
  }

  return stats
}

async function getGeographicAnalysis(startDate: string, endDate: string) {
  const { data: incidents } = await supabaseAdmin
    .from('incidents')
    .select('barangay, incident_type, status, location_lat, location_lng')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  const hotspots: Record<string, number> = {}
  incidents?.forEach((incident: any) => {
    const brgy = incident.barangay || 'Unknown'
    hotspots[brgy] = (hotspots[brgy] || 0) + 1
  })

  const sortedHotspots = Object.entries(hotspots)
    .sort(([, a]: [string, any], [, b]: [string, any]) => b - a)
    .slice(0, 10)
    .map(([barangay, count]: [string, any]) => ({ barangay, count, risk_level: count > 20 ? 'HIGH' : count > 10 ? 'MEDIUM' : 'LOW' }))

  return { hotspots: sortedHotspots }
}

async function getTimePatterns(startDate: string, endDate: string, barangay?: string | null, incidentType?: string | null, status?: string | null, severity?: string | null) {
  let query = supabaseAdmin
    .from('incidents')
    .select('created_at, incident_type, status')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (barangay) query = query.eq('barangay', barangay)
  if (incidentType) query = query.eq('incident_type', incidentType)
  if (status) query = query.eq('status', status)
  if (severity) query = query.eq('severity', severity)

  const { data: incidents } = await query

  // Group by hour
  const byHour: Record<number, number> = {}
  incidents?.forEach((incident: any) => {
    const hour = new Date(incident.created_at).getHours()
    byHour[hour] = (byHour[hour] || 0) + 1
  })

  // Group by day of week
  const byDayOfWeek: Record<number, number> = {}
  incidents?.forEach((incident: any) => {
    const day = new Date(incident.created_at).getDay()
    byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1
  })

  // Group by month
  const byMonth: Record<string, number> = {}
  incidents?.forEach((incident: any) => {
    const date = new Date(incident.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1
  })

  return { by_hour: byHour, by_day_of_week: byDayOfWeek, by_month: byMonth }
}

function calculatePercentageChange(oldValue: number, newValue: number, inverse: boolean = false): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0
  const change = ((newValue - oldValue) / oldValue) * 100
  return inverse ? -change : change
}

function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

