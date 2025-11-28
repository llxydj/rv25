import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { generateEnhancedCSV } from '@/lib/enhanced-csv-export'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Generate comprehensive reports for incidents and volunteer activities
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await request.json()
    const { report_type, start_date, end_date, format = 'json', filters = {} } = body

    if (!report_type || !start_date || !end_date) {
      return NextResponse.json({ 
        success: false, 
        message: 'report_type, start_date, and end_date are required' 
      }, { status: 400 })
    }

    let reportData: any = null

    // Generate incident report
    if (report_type === 'incidents' || report_type === 'all') {
      const incidentParams = new URLSearchParams({
        start_date,
        end_date,
        ...(filters.incident_type && { incident_type: filters.incident_type }),
        ...(filters.status && { status: filters.status }),
        ...(filters.barangay && { barangay: filters.barangay }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.volunteer_id && { volunteer_id: filters.volunteer_id })
      })

      const incidentRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/analytics/incidents/complete?${incidentParams}`)
      const incidentJson = await incidentRes.json()
      
      if (incidentJson.success) {
        reportData = {
          ...reportData,
          incidents: incidentJson.data
        }
      }
    }

    // Generate volunteer activity report
    if (report_type === 'volunteer_activities' || report_type === 'all') {
      const activityParams = new URLSearchParams({
        start_date,
        end_date,
        ...(filters.volunteer_id && { volunteer_id: filters.volunteer_id }),
        ...(filters.activity_type && { activity_type: filters.activity_type })
      })

      const activityRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/analytics/volunteer-activities/complete?${activityParams}`)
      const activityJson = await activityRes.json()
      
      if (activityJson.success) {
        reportData = {
          ...reportData,
          volunteer_activities: activityJson.data
        }
      }
    }

    // Format response based on requested format
    if (format === 'csv') {
      return generateCSVReport(reportData, report_type, start_date, end_date)
    } else if (format === 'pdf') {
      // PDF generation would be handled by the PDF route
      return NextResponse.json({ 
        success: true, 
        message: 'Use /api/reports/pdf for PDF generation',
        data: reportData 
      })
    } else {
      // JSON format (default)
      return NextResponse.json({
        success: true,
        data: {
          report_type,
          period: { start_date, end_date },
          generated_at: new Date().toISOString(),
          ...reportData
        }
      })
    }
  } catch (e: any) {
    console.error('Report generation error:', e)
    return NextResponse.json({ 
      success: false, 
      message: e?.message || 'Failed to generate report' 
    }, { status: 500 })
  }
}

function generateCSVReport(data: any, reportType: string, startDate: string, endDate: string): NextResponse {
  // Use enhanced CSV utility for better formatting
  const csvRows: string[] = []
  
  // Build comprehensive data structure for enhanced CSV
  const csvData: any[] = []
  
  // Add incident data if available
  if (data.incidents) {
    // Add summary row
    csvData.push({
      'Section': 'INCIDENT ANALYTICS SUMMARY',
      'Total Incidents': data.incidents.summary?.total_incidents || 0,
      'Resolved': data.incidents.summary?.resolved || 0,
      'Pending': data.incidents.summary?.pending || 0,
      'Resolution Rate (%)': data.incidents.summary?.resolution_rate?.toFixed(2) || '0.00',
      'Avg Response Time (minutes)': data.incidents.summary?.response_time?.average || 'N/A'
    })
    
    // Add incidents by type
    if (data.incidents.by_type) {
      Object.entries(data.incidents.by_type).forEach(([type, stats]: [string, any]) => {
        csvData.push({
          'Section': 'Incidents by Type',
          'Type': type,
          'Count': stats.count || 0,
          'Resolved': stats.resolved || 0,
          'Pending': stats.pending || 0,
          'Avg Response Time (minutes)': stats.avg_response_time?.toFixed(1) || 'N/A'
        })
      })
    }
    
    // Add incidents by barangay
    if (data.incidents.by_barangay) {
      Object.entries(data.incidents.by_barangay).forEach(([barangay, stats]: [string, any]) => {
        csvData.push({
          'Section': 'Incidents by Barangay',
          'Barangay': barangay,
          'Count': stats.count || 0,
          'Resolved': stats.resolved || 0,
          'Pending': stats.pending || 0
        })
      })
    }
  }
  
  // Add volunteer activity data if available
  if (data.volunteer_activities) {
    // Add schedules summary
    if (data.volunteer_activities.schedules?.summary) {
      csvData.push({
        'Section': 'VOLUNTEER ACTIVITY - SCHEDULES',
        'Total Schedules': data.volunteer_activities.schedules.summary.total || 0,
        'Accepted': data.volunteer_activities.schedules.summary.accepted || 0,
        'Declined': data.volunteer_activities.schedules.summary.declined || 0,
        'Acceptance Rate (%)': data.volunteer_activities.schedules.summary.acceptance_rate?.toFixed(2) || '0.00',
        'Attendance Rate (%)': data.volunteer_activities.schedules.summary.attendance_rate?.toFixed(2) || '0.00'
      })
    }
    
    // Add trainings summary
    if (data.volunteer_activities.trainings?.summary) {
      csvData.push({
        'Section': 'VOLUNTEER ACTIVITY - TRAININGS',
        'Total Trainings': data.volunteer_activities.trainings.summary.total || 0,
        'Total Enrollments': data.volunteer_activities.trainings.summary.total_enrollments || 0,
        'Avg Performance Rating': data.volunteer_activities.trainings.summary.avg_performance_rating?.toFixed(2) || '0.00'
      })
    }
  }
  
  // Generate enhanced CSV
  const headers = csvData.length > 0 ? Object.keys(csvData[0]) : []
  const csvContent = generateEnhancedCSV(csvData, headers, {
    organizationName: 'RVOIS - Rescue Volunteers Operations Information System',
    reportTitle: `Comprehensive ${reportType} Report`,
    includeMetadata: true,
    includeSummary: true,
    metadata: {
      'Report Type': reportType,
      'Period': `${startDate} to ${endDate}`
    }
  })
  
  // Add BOM for Excel compatibility
  const BOM = '\uFEFF'
  const csvWithBOM = BOM + csvContent
  
  return new NextResponse(csvWithBOM, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rvois-report-${reportType}-${startDate}-${endDate}.csv"`
    }
  })
}
