import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Get year-based report data
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const year = url.searchParams.get('year')
    const archived = url.searchParams.get('archived') === 'true'
    const exportType = url.searchParams.get('export')

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Handle CSV export
    if (exportType === 'csv' && year) {
      const yearNum = parseInt(year)
      const startDate = new Date(yearNum, 0, 1).toISOString()
      const endDate = new Date(yearNum + 1, 0, 1).toISOString()
      
      // Get incidents for CSV export - ENHANCED with all fields
      const { data: incidents, error: incidentsError } = await supabaseAdmin
        .from('incidents')
        .select(`
          id,
          created_at,
          updated_at,
          incident_type,
          description,
          location_lat,
          location_lng,
          address,
          barangay,
          city,
          province,
          status,
          priority,
          severity,
          assigned_at,
          resolved_at,
          resolution_notes,
          photo_url,
          photo_urls,
          reporter_id,
          assigned_to,
          reporter:users!incidents_reporter_id_fkey(
            id,
            first_name,
            last_name,
            email,
            phone_number
          ),
          assigned_to_user:users!incidents_assigned_to_fkey(
            id,
            first_name,
            last_name,
            email,
            phone_number
          ),
          incident_updates(
            id,
            created_at,
            new_status,
            previous_status,
            notes
          )
        `)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false })
      
      if (incidentsError) throw incidentsError
      
      // Create CSV with header information
      const currentDate = new Date().toLocaleDateString()
      const csvHeader = [
        `Organization: Radiant Rescue Volunteers Inc.`,
        `Report Type: Yearly Incidents Report`,
        `Year: ${yearNum}`,
        `Generated Date: ${currentDate}`,
        `Total Incidents: ${incidents.length}`,
        '',
        ''
      ].join('\n')
      
      // Format data for CSV with complete information
      const csvData = incidents.map(incident => {
        const reporter = Array.isArray(incident.reporter) && incident.reporter.length > 0 ? incident.reporter[0] : null;
        const assignedTo = Array.isArray(incident.assigned_to_user) && incident.assigned_to_user.length > 0 ? incident.assigned_to_user[0] : null;
        const timelineUpdates = incident.incident_updates || [];
        
        // Calculate timeline metrics
        const timelineEventCount = timelineUpdates.length;
        const lastTimelineUpdate = timelineUpdates.length > 0
          ? timelineUpdates.sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]
          : null;
        
        const statusChanges = timelineUpdates.filter((u: any) => 
          u.new_status && u.previous_status && u.new_status !== u.previous_status
        ).length;
        const photoAdditions = timelineUpdates.filter((u: any) => 
          u.notes?.includes('Photo') || u.notes?.includes('photo')
        ).length;
        const locationUpdates = timelineUpdates.filter((u: any) => 
          u.notes?.includes('Location') || u.notes?.includes('location')
        ).length;
        const severityChanges = timelineUpdates.filter((u: any) => 
          u.previous_status === 'SEVERITY_UPDATE' && u.new_status === 'SEVERITY_UPDATE'
        ).length;

        // Calculate response time (time from creation to assignment)
        const responseTimeMinutes = incident.assigned_at && incident.created_at
          ? Math.round((new Date(incident.assigned_at).getTime() - new Date(incident.created_at).getTime()) / (1000 * 60))
          : null;

        // Calculate resolution time (time from creation to resolution)
        const resolutionTimeMinutes = incident.resolved_at && incident.created_at
          ? Math.round((new Date(incident.resolved_at).getTime() - new Date(incident.created_at).getTime()) / (1000 * 60))
          : null;

        // Calculate assignment to resolution time
        const assignmentToResolutionMinutes = incident.resolved_at && incident.assigned_at
          ? Math.round((new Date(incident.resolved_at).getTime() - new Date(incident.assigned_at).getTime()) / (1000 * 60))
          : null;

        // Format time durations
        const formatDuration = (minutes: number | null) => {
          if (minutes === null) return "N/A";
          if (minutes < 60) return `${minutes} min`;
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        };

        return {
          "Incident ID": incident.id,
          "Created At": new Date(incident.created_at).toLocaleString(),
          "Updated At": incident.updated_at ? new Date(incident.updated_at).toLocaleString() : "N/A",
          "Type": incident.incident_type,
          "Description": incident.description || "",
          "Latitude": incident.location_lat,
          "Longitude": incident.location_lng,
          "Address": incident.address || "",
          "Barangay": incident.barangay,
          "City": incident.city || "TALISAY CITY",
          "Province": incident.province || "NEGROS OCCIDENTAL",
          "Status": incident.status,
          "Priority": incident.priority,
          "Severity": incident.severity || "MODERATE",
          "Reporter ID": incident.reporter_id || "N/A",
          "Reporter Name": reporter ? `${reporter.first_name || ""} ${reporter.last_name || ""}`.trim() : "Unknown",
          "Reporter Email": reporter?.email || "N/A",
          "Reporter Phone": reporter?.phone_number || "N/A",
          "Assigned To ID": incident.assigned_to || "N/A",
          "Assigned To Name": assignedTo ? `${assignedTo.first_name || ""} ${assignedTo.last_name || ""}`.trim() : "Unassigned",
          "Assigned To Email": assignedTo?.email || "N/A",
          "Assigned To Phone": assignedTo?.phone_number || "N/A",
          "Assigned At": incident.assigned_at ? new Date(incident.assigned_at).toLocaleString() : "N/A",
          "Resolved At": incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : "N/A",
          "Response Time": formatDuration(responseTimeMinutes),
          "Resolution Time": formatDuration(resolutionTimeMinutes),
          "Assignment to Resolution Time": formatDuration(assignmentToResolutionMinutes),
          "Resolution Notes": incident.resolution_notes || "",
          "Photo URL": incident.photo_url || "",
          "Photo Count": Array.isArray(incident.photo_urls) ? incident.photo_urls.length : (incident.photo_url ? 1 : 0),
          "Timeline Event Count": timelineEventCount,
          "Status Changes": statusChanges,
          "Photo Additions": photoAdditions,
          "Location Updates": locationUpdates,
          "Severity Changes": severityChanges,
          "Last Timeline Update": lastTimelineUpdate ? new Date(lastTimelineUpdate.created_at).toLocaleString() : "N/A",
          "Last Update Type": lastTimelineUpdate?.new_status || "N/A",
        }
      })
      
      // Create headers row
      const headers = Object.keys(csvData[0] || {}).join(',')
      
      // Create data rows
      const rows = csvData.map(item => 
        Object.values(item).map(value => 
          typeof value === 'string' && (value.includes(',') || value.includes('"')) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value
        ).join(',')
      )
      
      // Combine header and data
      const csvContent = csvHeader + headers + '\n' + rows.join('\n')
      
      return NextResponse.json({ 
        success: true, 
        data: csvContent,
        exportType: 'csv',
        filename: `incidents-report-${yearNum}.csv`
      })
    }

    // Get all years with incident data
    if (!year) {
      const { data: yearsData, error: yearsError } = await supabaseAdmin
        .from('incidents')
        .select('created_at')
        .order('created_at', { ascending: true })
      
      if (yearsError) throw yearsError
      
      // Extract unique years
      const years = Array.from(
        new Set(yearsData.map(incident => new Date(incident.created_at).getFullYear()))
      ).sort((a, b) => b - a) // Sort descending (newest first)
      
      // Get incident counts per year
      const yearStats: any[] = []
      for (const y of years) {
        const { count } = await supabaseAdmin
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(y, 0, 1).toISOString())
          .lt('created_at', new Date(y + 1, 0, 1).toISOString())
        
        yearStats.push({
          year: y,
          incident_count: count || 0
        })
      }
      
      return NextResponse.json({ 
        success: true, 
        data: yearStats
      })
    }

    // Get data for specific year
    const yearNum = parseInt(year)
    const startDate = new Date(yearNum, 0, 1).toISOString()
    const endDate = new Date(yearNum + 1, 0, 1).toISOString()
    
    // Get incidents for the year
    const { data: incidents, error: incidentsError } = await supabaseAdmin
      .from('incidents')
      .select('*')
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: false })
    
    if (incidentsError) throw incidentsError
    
    // Calculate quarterly breakdown
    const quarters = [
      { quarter: 'Q1', start: new Date(yearNum, 0, 1), end: new Date(yearNum, 3, 1), incident_count: 0 },
      { quarter: 'Q2', start: new Date(yearNum, 3, 1), end: new Date(yearNum, 6, 1), incident_count: 0 },
      { quarter: 'Q3', start: new Date(yearNum, 6, 1), end: new Date(yearNum, 9, 1), incident_count: 0 },
      { quarter: 'Q4', start: new Date(yearNum, 9, 1), end: new Date(yearNum + 1, 0, 1), incident_count: 0 }
    ]

    const monthlyBreakdown = new Map<number, {
      month_index: number
      label: string
      incident_count: number
      week_counts: number[]
      start: string
      end: string
    }>()
    
    // Count incidents per quarter
    incidents.forEach(incident => {
      const incidentDate = new Date(incident.created_at)

      const monthIndex = incidentDate.getMonth()
      if (!monthlyBreakdown.has(monthIndex)) {
        const start = new Date(yearNum, monthIndex, 1)
        const end = new Date(yearNum, monthIndex + 1, 0)
        monthlyBreakdown.set(monthIndex, {
          month_index: monthIndex,
          label: start.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
          incident_count: 0,
          week_counts: [0, 0, 0, 0, 0],
          start: start.toISOString(),
          end: end.toISOString()
        })
      }

      const monthEntry = monthlyBreakdown.get(monthIndex)!
      monthEntry.incident_count += 1

      const weekIndex = Math.min(4, Math.floor((incidentDate.getDate() - 1) / 7))
      monthEntry.week_counts[weekIndex] += 1

      for (const quarter of quarters) {
        if (incidentDate >= quarter.start && incidentDate < quarter.end) {
          quarter.incident_count++
          break
        }
      }
    })
    
    // Get status summary
    const statusSummary: Record<string, number> = {}
    incidents.forEach(incident => {
      statusSummary[incident.status] = (statusSummary[incident.status] || 0) + 1
    })
    
    // Get incident types breakdown
    const typeBreakdown: Record<string, number> = {}
    incidents.forEach(incident => {
      typeBreakdown[incident.incident_type] = (typeBreakdown[incident.incident_type] || 0) + 1
    })
    
    // Get barangay breakdown
    const barangayBreakdown: Record<string, number> = {}
    incidents.forEach(incident => {
      barangayBreakdown[incident.barangay] = (barangayBreakdown[incident.barangay] || 0) + 1
    })
    
    // Get reports for the year
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('*')
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .eq('archived', archived)
    
    if (reportsError) throw reportsError
    
    return NextResponse.json({ 
      success: true, 
      data: {
        year: yearNum,
        total_incidents: incidents.length,
        quarters,
        status_summary: statusSummary,
        type_breakdown: typeBreakdown,
        barangay_breakdown: barangayBreakdown,
        monthly_breakdown: Array.from(monthlyBreakdown.values()).sort((a, b) => a.month_index - b.month_index),
        reports: reports,
        archived
      }
    })
  } catch (e: any) {
    console.error('Error fetching year-based reports:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch year-based reports' 
    }, { status: 500 })
  }
}

// Archive reports for a year
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { year } = await request.json()

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const yearNum = parseInt(year)
    const startDate = new Date(yearNum, 0, 1).toISOString()
    const endDate = new Date(yearNum + 1, 0, 1).toISOString()
    
    // Check if already archived
    const { data: existingArchived } = await supabaseAdmin
      .from('reports')
      .select('id')
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .eq('archived', true)
      .limit(1)
    
    if (existingArchived && existingArchived.length > 0) {
      return NextResponse.json({ 
        success: false, 
        code: 'ALREADY_ARCHIVED',
        message: `Reports for ${yearNum} are already archived` 
      }, { status: 400 })
    }
    
    // Archive reports for the year
    const { error: updateError } = await supabaseAdmin
      .from('reports')
      .update({ archived: true })
      .gte('created_at', startDate)
      .lt('created_at', endDate)
    
    if (updateError) throw updateError
    
    // Log the action
    await supabaseAdmin.from('system_logs').insert({
      action: 'REPORTS_ARCHIVED',
      details: `Reports for year ${yearNum} archived by admin ${uid}`,
      user_id: uid
    })
    
    return NextResponse.json({ 
      success: true, 
      message: `Reports for ${yearNum} archived successfully` 
    })
  } catch (e: any) {
    console.error('Error archiving reports:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to archive reports' 
    }, { status: 500 })
  }
}

// Get archived years
export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Get all archived years
    const { data: archivedReports, error: archivedError } = await supabaseAdmin
      .from('reports')
      .select('created_at')
      .eq('archived', true)
    
    if (archivedError) throw archivedError
    
    // Extract unique years
    const archivedYears = Array.from(
      new Set(archivedReports.map(report => new Date(report.created_at).getFullYear()))
    ).sort((a, b) => b - a) // Sort descending (newest first)
    
    return NextResponse.json({ 
      success: true, 
      data: archivedYears
    })
  } catch (e: any) {
    console.error('Error fetching archived years:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch archived years' 
    }, { status: 500 })
  }
}