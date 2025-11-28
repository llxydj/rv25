import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

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
  const csvRows: string[] = []
  
  csvRows.push('RVOIS Comprehensive Report')
  csvRows.push(`Report Type: ${reportType}`)
  csvRows.push(`Period: ${startDate} to ${endDate}`)
  csvRows.push(`Generated: ${new Date().toISOString()}`)
  csvRows.push('')

  // Incident report section
  if (data.incidents) {
    csvRows.push('=== INCIDENT ANALYTICS ===')
    csvRows.push('')
    csvRows.push('Summary')
    csvRows.push(`Total Incidents,${data.incidents.summary.total_incidents}`)
    csvRows.push(`Resolved,${data.incidents.summary.resolved}`)
    csvRows.push(`Pending,${data.incidents.summary.pending}`)
    csvRows.push(`Resolution Rate,${data.incidents.summary.resolution_rate.toFixed(2)}%`)
    csvRows.push(`Avg Response Time (minutes),${data.incidents.summary.response_time.average}`)
    csvRows.push('')
    csvRows.push('Incidents by Type')
    csvRows.push('Type,Count,Resolved,Pending,Avg Response Time')
    Object.entries(data.incidents.by_type).forEach(([type, stats]: [string, any]) => {
      csvRows.push(`${type},${stats.count},${stats.resolved},${stats.pending},${stats.avg_response_time.toFixed(1)}`)
    })
    csvRows.push('')
    csvRows.push('Incidents by Barangay')
    csvRows.push('Barangay,Count,Resolved,Pending')
    Object.entries(data.incidents.by_barangay).forEach(([barangay, stats]: [string, any]) => {
      csvRows.push(`${barangay},${stats.count},${stats.resolved},${stats.pending}`)
    })
    csvRows.push('')
  }

  // Volunteer activity report section
  if (data.volunteer_activities) {
    csvRows.push('=== VOLUNTEER ACTIVITY ANALYTICS ===')
    csvRows.push('')
    csvRows.push('Schedules Summary')
    csvRows.push(`Total Schedules,${data.volunteer_activities.schedules.summary.total}`)
    csvRows.push(`Accepted,${data.volunteer_activities.schedules.summary.accepted}`)
    csvRows.push(`Declined,${data.volunteer_activities.schedules.summary.declined}`)
    csvRows.push(`Acceptance Rate,${data.volunteer_activities.schedules.summary.acceptance_rate.toFixed(2)}%`)
    csvRows.push(`Attendance Rate,${data.volunteer_activities.schedules.summary.attendance_rate.toFixed(2)}%`)
    csvRows.push('')
    csvRows.push('Trainings Summary')
    csvRows.push(`Total Trainings,${data.volunteer_activities.trainings.summary.total}`)
    csvRows.push(`Total Enrollments,${data.volunteer_activities.trainings.summary.total_enrollments}`)
    csvRows.push(`Avg Performance Rating,${data.volunteer_activities.trainings.summary.avg_performance_rating.toFixed(2)}`)
    csvRows.push('')
  }

  const csvContent = csvRows.join('\n')
  
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="rvois-report-${reportType}-${startDate}-${endDate}.csv"`
    }
  })
}


