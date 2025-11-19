import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { getVolunteerAnalytics, getAllVolunteersAnalytics } from '@/lib/volunteer-analytics'
import { analyticsCache } from './cache'

/**
 * Log admin API request for audit trail
 */
async function logAdminRequest(
  supabase: any,
  userId: string,
  endpoint: string,
  method: string,
  params?: Record<string, any>
) {
  try {
    await supabase
      .from('system_logs')
      .insert({
        action: 'admin_api_request',
        user_id: userId,
        details: {
          endpoint,
          method,
          params: params || {}
        },
        created_at: new Date().toISOString()
      } as any)
  } catch (error) {
    console.error('Failed to log admin request:', error)
    // Don't fail the request if audit logging fails
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    // Check if user is admin
    const { data: me } = await supabase.from('users').select('role').eq('id', userRes.user.id).maybeSingle()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Log admin API request for audit trail
    const { searchParams } = new URL(request.url)
    const requestParams = Object.fromEntries(searchParams.entries())
    await logAdminRequest(supabase, userRes.user.id, '/api/volunteers/analytics', 'GET', requestParams)

    const volunteerId = requestParams.volunteer_id || null
    const startDate = requestParams.start_date || undefined
    const endDate = requestParams.end_date || undefined
    const exportFormat = requestParams.export || null // 'csv' or 'pdf'
    const limit = requestParams.limit ? parseInt(requestParams.limit) : undefined

    if (volunteerId) {
      // Check cache first (skip cache for exports)
      if (exportFormat !== 'csv') {
        const cached = analyticsCache.get(volunteerId, startDate, endDate)
        if (cached) {
          return NextResponse.json({ success: true, data: cached, cached: true })
        }
      }

      // Get analytics for specific volunteer
      // Limit to 50000 incidents max for performance (can be adjusted via query param)
      const result = await getVolunteerAnalytics(volunteerId, startDate, endDate, limit || 50000)
      
      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 500 })
      }

      // Cache the result (5 minutes TTL)
      if (exportFormat !== 'csv' && result.data) {
        analyticsCache.set(volunteerId, result.data, 5 * 60 * 1000, startDate, endDate)
      }

      if (exportFormat === 'csv') {
        const csv = exportVolunteerAnalyticsToCSV(result.data!)
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="volunteer-analytics-${volunteerId}-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      }

      return NextResponse.json({ success: true, data: result.data })
    } else {
      // Get analytics for all volunteers
      // Note: This can be expensive for many volunteers - consider pagination in future
      const result = await getAllVolunteersAnalytics(startDate, endDate)
      
      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: result.data })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch volunteer analytics'
    }, { status: 500 })
  }
}

function escapeCSVField(field: string): string {
  if (field === null || field === undefined) return ''
  const str = String(field)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function exportVolunteerAnalyticsToCSV(analytics: any): string {
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

