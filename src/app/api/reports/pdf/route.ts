import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"

// PDF Generation using Puppeteer (better quality)
import { generatePDFFromHTML } from '@/lib/pdf-generator-puppeteer'
import { generateIncidentReportHTML, type IncidentReportData } from '@/lib/pdf-templates/incident-report-template'
import { generateVolunteerReportHTML, type VolunteerReportData } from '@/lib/pdf-templates/volunteer-report-template'
import { generateAnalyticsReportHTML, type AnalyticsReportData } from '@/lib/pdf-templates/analytics-report-template'

// Fallback to jsPDF if Puppeteer fails (for compatibility)
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import autoTable from 'jspdf-autotable'

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
    // SECURITY FIX: Sanitize error messages in production
    const isProduction = process.env.NODE_ENV === 'production'
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to generate PDF report', 
        error: isProduction ? undefined : error.message 
      },
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

  // ENHANCED: Build query - include ALL necessary fields for detailed reports
  let query = supabaseAdmin
    .from('incidents')
    .select(`
      *,
      users:reporter_id (
        first_name,
        last_name,
        phone_number,
        email
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

  // Try Puppeteer first (better quality), fallback to jsPDF if it fails
  try {
    // ENHANCED: Calculate comprehensive statistics
    const statusCounts = incidents?.reduce((acc: any, incident: any) => {
      acc[incident.status] = (acc[incident.status] || 0) + 1
      return acc
    }, {}) || {}

    const severityCounts = incidents?.reduce((acc: any, incident: any) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1
      return acc
    }, {}) || {}

    const typeCounts = incidents?.reduce((acc: any, incident: any) => {
      const type = incident.incident_type || 'Unspecified'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {}) || {}

    const barangayCounts = incidents?.reduce((acc: any, incident: any) => {
      const brgy = incident.barangay || 'Unknown'
      acc[brgy] = (acc[brgy] || 0) + 1
      return acc
    }, {}) || {}

    // ENHANCED: Format incidents with ALL detailed information
    const formattedIncidents = (incidents || []).map((incident: any) => {
      // Extract reporter information
      const reporterData = Array.isArray(incident.users) ? incident.users[0] : incident.users
      const reporter = reporterData
        ? `${reporterData.first_name || ''} ${reporterData.last_name || ''}`.trim()
        : 'Anonymous'
      const reporterPhone = reporterData?.phone_number
      const reporterEmail = reporterData?.email

      // Extract assigned volunteer information
      const volunteerData = Array.isArray(incident.volunteer_profiles) 
        ? incident.volunteer_profiles[0] 
        : incident.volunteer_profiles
      const assignedTo = volunteerData
        ? `${volunteerData.first_name || ''} ${volunteerData.last_name || ''}`.trim()
        : undefined
      const assignedToPhone = volunteerData?.phone_number

      // Location information
      const location = incident.address || 
        (incident.location_lat && incident.location_lng 
          ? `${incident.location_lat.toFixed(6)}, ${incident.location_lng.toFixed(6)}` 
          : 'N/A')

      // Calculate response times
      let responseTimeMinutes: number | undefined
      let resolutionTimeMinutes: number | undefined
      
      if (incident.assigned_at && incident.created_at) {
        const created = new Date(incident.created_at)
        const assigned = new Date(incident.assigned_at)
        if (!isNaN(created.getTime()) && !isNaN(assigned.getTime()) && assigned >= created) {
          responseTimeMinutes = (assigned.getTime() - created.getTime()) / (1000 * 60)
          if (responseTimeMinutes < 0) responseTimeMinutes = undefined
        }
      }

      if (incident.resolved_at && incident.created_at) {
        const created = new Date(incident.created_at)
        const resolved = new Date(incident.resolved_at)
        if (!isNaN(created.getTime()) && !isNaN(resolved.getTime()) && resolved >= created) {
          resolutionTimeMinutes = (resolved.getTime() - created.getTime()) / (1000 * 60)
          if (resolutionTimeMinutes < 0) resolutionTimeMinutes = undefined
        }
      }

      // Count photos
      const photoCount = Array.isArray(incident.photo_urls) 
        ? incident.photo_urls.length 
        : (incident.photo_url ? 1 : 0)

      return {
        id: incident.id,
        type: incident.incident_type || 'Unspecified',
        status: incident.status,
        severity: incident.severity || 3,
        priority: incident.priority,
        // New categorization fields
        incident_category: incident.incident_category || 'N/A',
        trauma_subcategory: incident.trauma_subcategory || 'N/A',
        severity_level: incident.severity_level || 'N/A',
        location: location,
        address: incident.address,
        barangay: incident.barangay || 'N/A',
        city: incident.city,
        province: incident.province,
        created_at: incident.created_at,
        updated_at: incident.updated_at,
        assigned_at: incident.assigned_at,
        resolved_at: incident.resolved_at,
        reporter: reporter || undefined,
        reporterPhone: reporterPhone,
        reporterEmail: reporterEmail,
        description: incident.description,
        fullDescription: incident.description, // Use description as full description
        assignedTo: assignedTo,
        assignedToPhone: assignedToPhone,
        resolutionNotes: incident.resolution_notes,
        photoCount: photoCount > 0 ? photoCount : undefined,
        responseTimeMinutes: responseTimeMinutes ? Math.round(responseTimeMinutes * 100) / 100 : undefined,
        resolutionTimeMinutes: resolutionTimeMinutes ? Math.round(resolutionTimeMinutes * 100) / 100 : undefined
      }
    })

    // ENHANCED: Prepare comprehensive data for template
    const reportData: IncidentReportData = {
      total: incidents?.length || 0,
      startDate: filters.startDate,
      endDate: filters.endDate,
      statusCounts,
      severityCounts,
      typeCounts,
      barangayCounts,
      // New categorization counts
      categoryCounts,
      severityLevelCounts,
      incidents: formattedIncidents,
      reportClassification: 'INTERNAL', // Default classification
      generatedBy: 'System Administrator' // Can be enhanced to get from auth
    }

    // Load logo as base64
    let logoBase64: string | undefined
    try {
      const fs = await import('fs')
      const path = await import('path')
      const logoPath = path.join(process.cwd(), 'public', 'assets', 'radiant-logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        logoBase64 = logoBuffer.toString('base64')
      }
    } catch (error) {
      console.warn('Could not load logo for PDF:', error)
    }

    // Generate HTML with logo
    const html = generateIncidentReportHTML(reportData, logoBase64)

    // Generate PDF using Puppeteer with enhanced options
    const pdfBuffer = await generatePDFFromHTML(html, {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%; color: #6b7280; padding: 5px;">RVOIS - Rescue Volunteers Operations Information System</div>',
      footerTemplate: '<div style="font-size: 9px; text-align: center; width: 100%; color: #6b7280; padding: 5px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    })

    return pdfBuffer
  } catch (puppeteerError) {
    console.warn('Puppeteer PDF generation failed, falling back to jsPDF:', puppeteerError)
    // Fallback to jsPDF if Puppeteer fails
  }

  // Fallback: jsPDF implementation (original code)
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

    // Add detailed incident information section
    yPos += 20
    doc.setFontSize(14)
    doc.text('Detailed Incident Information', 20, yPos)
    yPos += 10
    
    // Add detailed info for each incident (if space allows, otherwise just table)
    if (incidents.length <= 5) {
      incidents.forEach((incident: any, index: number) => {
        if (yPos > 250) {
          doc.addPage()
          yPos = 20
        }
        
        doc.setFontSize(10)
        doc.setFont(undefined, 'bold')
        doc.text(`Incident ${index + 1}: ${incident.id.slice(0, 8)}`, 20, yPos)
        yPos += 8
        
        doc.setFont(undefined, 'normal')
        doc.setFontSize(9)
        doc.text(`Type: ${incident.incident_type}`, 20, yPos)
        yPos += 6
        doc.text(`Status: ${incident.status}`, 20, yPos)
        yPos += 6
        doc.text(`Severity: Level ${incident.severity}`, 20, yPos)
        yPos += 6
        doc.text(`Location: ${incident.address || `${incident.location_lat}, ${incident.location_lng}`}`, 20, yPos)
        yPos += 6
        doc.text(`Barangay: ${incident.barangay}`, 20, yPos)
        yPos += 6
        
        if (incident.users) {
          const reporter = incident.users as any
          doc.text(`Reporter: ${reporter.first_name || ''} ${reporter.last_name || ''}`, 20, yPos)
          yPos += 6
          doc.text(`Reporter Phone: ${reporter.phone_number || 'N/A'}`, 20, yPos)
          yPos += 6
        }
        
        doc.text(`Description: ${(incident.description || '').substring(0, 80)}${incident.description?.length > 80 ? '...' : ''}`, 20, yPos)
        yPos += 6
        doc.text(`Created: ${new Date(incident.created_at).toLocaleString()}`, 20, yPos)
        yPos += 6
        
        if (incident.resolved_at) {
          doc.text(`Resolved: ${new Date(incident.resolved_at).toLocaleString()}`, 20, yPos)
          yPos += 6
        }
        
        if ((incident.photo_urls && (incident.photo_urls as any[]).length > 0) || incident.photo_url) {
          doc.text(`Photos: ${(incident.photo_urls as any[])?.length || (incident.photo_url ? 1 : 0)} attached`, 20, yPos)
          yPos += 6
        }
        
        yPos += 5
      })
      
      yPos += 10
    }
    
    // Add incidents table
    doc.setFontSize(14)
    doc.text('Incident Summary Table', 20, yPos)
    yPos += 10

    // Prepare table data with enhanced details
    const tableData = incidents.map((incident: IncidentReportData) => {
      const reporter = incident.users ? `${(incident.users as any).first_name || ''} ${(incident.users as any).last_name || ''}`.trim() : 'N/A'
      const reporterPhone = incident.users ? (incident.users as any).phone_number || 'N/A' : 'N/A'
      const location = incident.address || `${incident.location_lat?.toFixed(6)}, ${incident.location_lng?.toFixed(6)}` || 'N/A'
      const hasPhotos = (incident.photo_urls && (incident.photo_urls as any[]).length > 0) || incident.photo_url ? 'Yes' : 'No'
      
      return [
        incident.id.slice(0, 8),
        incident.incident_type,
        incident.status,
        `Level ${incident.severity}`,
        incident.barangay || 'N/A',
        location.substring(0, 30) + (location.length > 30 ? '...' : ''),
        reporter || 'N/A',
        reporterPhone || 'N/A',
        hasPhotos,
        new Date(incident.created_at).toLocaleDateString(),
        incident.assigned_to ? 'Yes' : 'No',
        incident.resolved_at ? new Date(incident.resolved_at).toLocaleDateString() : 'N/A'
      ]
    })

    autoTable(doc, {
      head: [['ID', 'Type', 'Status', 'Severity', 'Barangay', 'Location', 'Reporter', 'Phone', 'Photos', 'Created', 'Assigned', 'Resolved']],
      body: tableData,
      startY: yPos,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [220, 38, 38], fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 30 },
        5: { cellWidth: 40 },
        6: { cellWidth: 35 },
        7: { cellWidth: 30 },
        8: { cellWidth: 15 },
        9: { cellWidth: 25 },
        10: { cellWidth: 20 },
        11: { cellWidth: 25 }
      }
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

  // Try Puppeteer first (better quality), fallback to jsPDF if it fails
  try {
    const totalIncidents = volunteerStats.reduce((sum, v) => sum + v.totalIncidents, 0)
    const totalResolved = volunteerStats.reduce((sum, v) => sum + v.resolvedIncidents, 0)
    const avgResolutionRate = totalIncidents ? (totalResolved / totalIncidents * 100).toFixed(1) : '0'

    // Format volunteers for template
    const formattedVolunteers = volunteerStats.map((volunteer: any) => ({
      name: volunteer.users ? `${volunteer.users.first_name || ''} ${volunteer.users.last_name || ''}`.trim() : 'Unknown',
      phone: volunteer.users?.phone_number || 'N/A',
      skills: volunteer.skills || [],
      totalIncidents: volunteer.totalIncidents,
      resolvedIncidents: volunteer.resolvedIncidents,
      resolutionRate: volunteer.resolutionRate
    }))

    // Prepare data for template
    const reportData: VolunteerReportData = {
      totalVolunteers: volunteerStats.length,
      startDate: filters.startDate,
      endDate: filters.endDate,
      summary: {
        totalIncidents,
        totalResolved,
        avgResolutionRate
      },
      volunteers: formattedVolunteers
    }

    // Generate HTML
    const html = generateVolunteerReportHTML(reportData)

    // Generate PDF using Puppeteer
    const pdfBuffer = await generatePDFFromHTML(html, {
      format: 'A4',
      printBackground: true
    })

    return pdfBuffer
  } catch (puppeteerError) {
    console.warn('Puppeteer PDF generation failed, falling back to jsPDF:', puppeteerError)
    // Fallback to jsPDF if Puppeteer fails
  }

  // Fallback: jsPDF implementation
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

  // Try Puppeteer first (better quality), fallback to jsPDF if it fails
  try {
    const resolved = statusDistribution.RESOLVED || 0
    const resolutionRate = totalIncidents > 0 ? ((resolved / totalIncidents) * 100).toFixed(1) : '0.0'

    // Prepare data for template
    const reportData: AnalyticsReportData = {
      totalIncidents,
      startDate: filters.startDate,
      endDate: filters.endDate,
      resolved,
      avgResponseTime,
      resolutionRate,
      statusDistribution,
      typeDistribution,
      barangayDistribution,
      severityDistribution
    }

    // Generate HTML
    const html = generateAnalyticsReportHTML(reportData)

    // Generate PDF using Puppeteer
    const pdfBuffer = await generatePDFFromHTML(html, {
      format: 'A4',
      printBackground: true
    })

    return pdfBuffer
  } catch (puppeteerError) {
    console.warn('Puppeteer PDF generation failed, falling back to jsPDF:', puppeteerError)
    // Fallback to jsPDF if Puppeteer fails
  }

  // Fallback: jsPDF implementation
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
