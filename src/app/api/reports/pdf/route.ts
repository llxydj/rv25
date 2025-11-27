import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"

// PDF Generation using jsPDF
import jsPDF from 'jspdf'
// Import jspdf-autotable - in v5.x it extends jsPDF automatically
import 'jspdf-autotable'

// Also import as a function for direct use if needed
import autoTable from 'jspdf-autotable'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

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

    let pdfBuffer: Buffer

    switch (reportType) {
      case 'incidents':
        pdfBuffer = await generateIncidentReport(filters)
        break
      case 'volunteers':
        pdfBuffer = await generateVolunteerPerformanceReport(filters)
        break
      case 'analytics':
        pdfBuffer = await generateAnalyticsReport(filters)
        break
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid report type' },
          { status: 400 }
        )
    }

    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer as ArrayBuffer)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate PDF report', error: error.message },
      { status: 500 }
    )
  }
}

async function generateIncidentReport(filters: ReportFilters): Promise<Buffer> {
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

  // Create PDF
  const doc = new jsPDF()
  
  // Add header
  doc.setFontSize(20)
  doc.text('RVOIS Incident Report', 20, 30)
  
  doc.setFontSize(12)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40)
  doc.text(`Period: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`, 20, 50)
  doc.text(`Total Incidents: ${incidents?.length || 0}`, 20, 60)

  // Add summary statistics
  if (incidents && incidents.length > 0) {
    const statusCounts = incidents.reduce((acc: any, incident: any) => {
      acc[incident.status] = (acc[incident.status] || 0) + 1
      return acc
    }, {})

    const severityCounts = incidents.reduce((acc: any, incident: any) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1
      return acc
    }, {})

    doc.setFontSize(14)
    doc.text('Summary Statistics', 20, 80)
    
    doc.setFontSize(10)
    let yPos = 90
    doc.text('Status Distribution:', 20, yPos)
    yPos += 10
    Object.entries(statusCounts).forEach(([status, count]) => {
      doc.text(`  ${status}: ${count}`, 30, yPos)
      yPos += 8
    })

    yPos += 10
    doc.text('Severity Distribution:', 20, yPos)
    yPos += 10
    Object.entries(severityCounts).forEach(([severity, count]) => {
      doc.text(`  Level ${severity}: ${count}`, 30, yPos)
      yPos += 8
    })

    // Add incidents table
    yPos += 20
    doc.setFontSize(14)
    doc.text('Incident Details', 20, yPos)
    yPos += 10

    // Prepare table data
    const tableData = incidents.map((incident: IncidentReportData) => [
      incident.id.slice(0, 8),
      incident.incident_type,
      incident.status,
      `Level ${incident.severity}`,
      incident.barangay,
      new Date(incident.created_at).toLocaleDateString(),
      incident.assigned_to ? 'Yes' : 'No',
      incident.resolved_at ? new Date(incident.resolved_at).toLocaleDateString() : 'N/A'
    ])

    autoTable(doc, {
      head: [['ID', 'Type', 'Status', 'Severity', 'Barangay', 'Created', 'Assigned', 'Resolved']],
      body: tableData,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    })
  }

  // Add footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(`Page ${i} of ${pageCount}`, 20, doc.internal.pageSize.height - 10)
    doc.text('RVOIS - Resident Volunteer Operations Information System', doc.internal.pageSize.width - 100, doc.internal.pageSize.height - 10)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

async function generateVolunteerPerformanceReport(filters: ReportFilters): Promise<Buffer> {
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
      users!volunteer_profiles_volunteer_user_id_fkey (
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

  // Create PDF
  const doc = new jsPDF()
  
  // Add header
  doc.setFontSize(20)
  doc.text('RVOIS Volunteer Performance Report', 20, 30)
  
  doc.setFontSize(12)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40)
  doc.text(`Period: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`, 20, 50)
  doc.text(`Active Volunteers: ${volunteerStats.length}`, 20, 60)

  // Add performance summary
  if (volunteerStats.length > 0) {
    const totalIncidents = volunteerStats.reduce((sum, v) => sum + v.totalIncidents, 0)
    const totalResolved = volunteerStats.reduce((sum, v) => sum + v.resolvedIncidents, 0)
    const avgResolutionRate = totalIncidents ? (totalResolved / totalIncidents * 100).toFixed(1) : '0'

    doc.setFontSize(14)
    doc.text('Performance Summary', 20, 80)
    
    doc.setFontSize(10)
    doc.text(`Total Incidents Assigned: ${totalIncidents}`, 20, 90)
    doc.text(`Total Incidents Resolved: ${totalResolved}`, 20, 100)
    doc.text(`Overall Resolution Rate: ${avgResolutionRate}%`, 20, 110)

    // Add volunteer performance table
    doc.setFontSize(14)
    doc.text('Volunteer Performance Details', 20, 130)

    const tableData = volunteerStats.map((volunteer: any) => [
      `${volunteer.users.first_name} ${volunteer.users.last_name}`,
      volunteer.users.phone_number,
      volunteer.skills?.join(', ') || 'None',
      volunteer.totalIncidents.toString(),
      volunteer.resolvedIncidents.toString(),
      `${volunteer.resolutionRate}%`
    ])

    autoTable(doc, {
      head: [['Name', 'Phone', 'Skills', 'Assigned', 'Resolved', 'Resolution Rate']],
      body: tableData,
      startY: 140,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    })
  }

  // Add footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(`Page ${i} of ${pageCount}`, 20, doc.internal.pageSize.height - 10)
    doc.text('RVOIS - Resident Volunteer Operations Information System', doc.internal.pageSize.width - 100, doc.internal.pageSize.height - 10)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

async function generateAnalyticsReport(filters: ReportFilters): Promise<Buffer> {
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

  // Create PDF
  const doc = new jsPDF()
  
  // Add header
  doc.setFontSize(20)
  doc.text('RVOIS Analytics Report', 20, 30)
  
  doc.setFontSize(12)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40)
  doc.text(`Period: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`, 20, 50)

  // Add key metrics
  doc.setFontSize(14)
  doc.text('Key Metrics', 20, 70)
  
  doc.setFontSize(10)
  doc.text(`Total Incidents: ${totalIncidents}`, 20, 80)
  doc.text(`Resolved Incidents: ${statusDistribution.RESOLVED || 0}`, 20, 90)
  doc.text(`Average Response Time: ${avgResponseTime.toFixed(1)} hours`, 20, 100)
  doc.text(`Resolution Rate: ${totalIncidents ? ((statusDistribution.RESOLVED || 0) / totalIncidents * 100).toFixed(1) : 0}%`, 20, 110)

  // Add distribution tables
  let yPos = 130

  // Status distribution
  doc.setFontSize(12)
  doc.text('Status Distribution', 20, yPos)
  yPos += 10

  const statusData = Object.entries(statusDistribution).map(([status, count]) => [
    status,
    (count as number).toString(),
    `${((count as number) / totalIncidents * 100).toFixed(1)}%`
  ])

  autoTable(doc, {
    head: [['Status', 'Count', 'Percentage']],
    body: statusData,
    startY: yPos,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  })

  yPos = (doc as any).lastAutoTable.finalY + 20

  // Incident type distribution
  doc.setFontSize(12)
  doc.text('Incident Type Distribution', 20, yPos)
  yPos += 10

  const typeData = Object.entries(typeDistribution).map(([type, count]) => [
    type,
    (count as number).toString(),
    `${((count as number) / totalIncidents * 100).toFixed(1)}%`
  ])

  autoTable(doc, {
    head: [['Type', 'Count', 'Percentage']],
    body: typeData,
    startY: yPos,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  })

  yPos = (doc as any).lastAutoTable.finalY + 20

  // Barangay distribution
  doc.setFontSize(12)
  doc.text('Barangay Distribution', 20, yPos)
  yPos += 10

  const barangayData = Object.entries(barangayDistribution)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 10) // Top 10 barangays
    .map(([barangay, count]) => [
      barangay,
      (count as number).toString(),
      `${((count as number) / totalIncidents * 100).toFixed(1)}%`
    ])

  autoTable(doc, {
    head: [['Barangay', 'Count', 'Percentage']],
    body: barangayData,
    startY: yPos,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  })

  // Add footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(`Page ${i} of ${pageCount}`, 20, doc.internal.pageSize.height - 10)
    doc.text('RVOIS - Resident Volunteer Operations Information System', doc.internal.pageSize.width - 100, doc.internal.pageSize.height - 10)
  }

  return Buffer.from(doc.output('arraybuffer'))
}
