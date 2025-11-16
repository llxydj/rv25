import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

interface ReportFilters {
  startDate: string
  endDate: string
  status?: string[]
  incidentType?: string[]
  barangay?: string[]
  severity?: number[]
}

interface IncidentReportData {
  id: string
  incident_type: string
  description: string
  status: string
  severity: number
  barangay: string
  location_lat: number
  location_lng: number
  created_at: string
  assigned_to?: string
  resolved_at?: string
  reporter_id: string
  users?: {
    first_name: string
    last_name: string
    phone_number: string
  }
  volunteer_profiles?: {
    first_name: string
    last_name: string
    phone_number: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filters, reportType = 'incidents' }: { filters: ReportFilters, reportType?: string } = body

    if (!filters.startDate || !filters.endDate) {
      return NextResponse.json(
        { success: false, message: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    let reportData: any

    switch (reportType) {
      case 'incidents':
        reportData = await getIncidentReportData(filters)
        break
      case 'volunteers':
        reportData = await getVolunteerPerformanceReportData(filters)
        break
      case 'analytics':
        reportData = await getAnalyticsReportData(filters)
        break
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid report type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: reportData,
      reportType
    })
  } catch (error: any) {
    console.error('Report data fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch report data', error: error.message },
      { status: 500 }
    )
  }
}

async function getIncidentReportData(filters: ReportFilters) {
  // Create Supabase admin client for full access
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Build query
  let query = supabaseAdmin
    .from('incidents')
    .select(`
      *,
      users:reporter_id (
        first_name,
        last_name,
        phone_number
      ),
      volunteer_profiles:assigned_to (
        first_name,
        last_name,
        phone_number
      )
    `)
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate)

  // Apply filters
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }
  if (filters.incidentType && filters.incidentType.length > 0) {
    query = query.in('incident_type', filters.incidentType)
  }
  if (filters.barangay && filters.barangay.length > 0) {
    query = query.in('barangay', filters.barangay)
  }
  if (filters.severity && filters.severity.length > 0) {
    query = query.in('severity', filters.severity)
  }

  const { data: incidents, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  // Calculate summary statistics
  if (incidents && incidents.length > 0) {
    const statusCounts = incidents.reduce((acc: any, incident: any) => {
      acc[incident.status] = (acc[incident.status] || 0) + 1
      return acc
    }, {})

    const severityCounts = incidents.reduce((acc: any, incident: any) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1
      return acc
    }, {})

    return {
      incidents,
      summary: {
        total: incidents.length,
        statusCounts,
        severityCounts,
        period: {
          start: filters.startDate,
          end: filters.endDate
        }
      }
    }
  }

  return {
    incidents: [],
    summary: {
      total: 0,
      statusCounts: {},
      severityCounts: {},
      period: {
        start: filters.startDate,
        end: filters.endDate
      }
    }
  }
}

async function getVolunteerPerformanceReportData(filters: ReportFilters) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Get volunteer performance data
  const { data: volunteers, error } = await supabaseAdmin
    .from('volunteer_profiles')
    .select(`
      *,
      users (
        first_name,
        last_name,
        phone_number,
        email
      )
    `)
    .eq('status', 'ACTIVE')

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  // Get incident statistics for each volunteer
  const volunteerStats = await Promise.all(
    volunteers?.map(async (volunteer: any) => {
      const { count: totalIncidents } = await supabaseAdmin
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', volunteer.volunteer_user_id)
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate)

      const { count: resolvedIncidents } = await supabaseAdmin
        .from('incidents')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', volunteer.volunteer_user_id)
        .eq('status', 'RESOLVED')
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate)

      return {
        ...volunteer,
        totalIncidents: totalIncidents || 0,
        resolvedIncidents: resolvedIncidents || 0,
        resolutionRate: totalIncidents ? ((resolvedIncidents || 0) / totalIncidents * 100).toFixed(1) : '0'
      }
    }) || []
  )

  // Calculate overall performance metrics
  const totalIncidents = volunteerStats.reduce((sum, v) => sum + v.totalIncidents, 0)
  const totalResolved = volunteerStats.reduce((sum, v) => sum + v.resolvedIncidents, 0)
  const avgResolutionRate = totalIncidents ? (totalResolved / totalIncidents * 100).toFixed(1) : '0'

  return {
    volunteers: volunteerStats,
    summary: {
      totalVolunteers: volunteerStats.length,
      totalIncidents,
      totalResolved,
      avgResolutionRate,
      period: {
        start: filters.startDate,
        end: filters.endDate
      }
    }
  }
}

async function getAnalyticsReportData(filters: ReportFilters) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Get comprehensive analytics data
  const { data: incidents, error } = await supabaseAdmin
    .from('incidents')
    .select('*')
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate)

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  // Calculate analytics
  const totalIncidents = incidents?.length || 0
  const statusDistribution = incidents?.reduce((acc: any, incident: any) => {
    acc[incident.status] = (acc[incident.status] || 0) + 1
    return acc
  }, {}) || {}

  const typeDistribution = incidents?.reduce((acc: any, incident: any) => {
    acc[incident.incident_type] = (acc[incident.incident_type] || 0) + 1
    return acc
  }, {}) || {}

  const barangayDistribution = incidents?.reduce((acc: any, incident: any) => {
    acc[incident.barangay] = (acc[incident.barangay] || 0) + 1
    return acc
  }, {}) || {}

  const severityDistribution = incidents?.reduce((acc: any, incident: any) => {
    acc[incident.severity] = (acc[incident.severity] || 0) + 1
    return acc
  }, {}) || {}

  // Calculate response times
  const resolvedIncidents = incidents?.filter((i: any) => i.resolved_at && i.assigned_at) || []
  const avgResponseTime = resolvedIncidents.length > 0 
    ? resolvedIncidents.reduce((sum: number, incident: any) => {
        const responseTime = new Date(incident.resolved_at).getTime() - new Date(incident.assigned_at).getTime()
        return sum + responseTime
      }, 0) / resolvedIncidents.length / (1000 * 60 * 60) // Convert to hours
    : 0

  return {
    incidents,
    analytics: {
      totalIncidents,
      statusDistribution,
      typeDistribution,
      barangayDistribution,
      severityDistribution,
      avgResponseTime,
      resolutionRate: totalIncidents ? ((statusDistribution.RESOLVED || 0) / totalIncidents * 100).toFixed(1) : '0',
      period: {
        start: filters.startDate,
        end: filters.endDate
      }
    }
  }
}