import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const type = searchParams.get('type') || undefined
    const barangay = searchParams.get('barangay') || undefined

    let query = supabase
      .from('incidents')
      .select(`
        id,
        created_at,
        incident_type,
        severity,
        barangay,
        status,
        priority,
        description,
        address,
        reporter:users!incidents_reporter_id_fkey(
          first_name,
          last_name,
          email,
          phone_number
        ),
        assignee:users!incidents_assigned_to_fkey(
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: true })

    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)
    if (type) query = query.eq('incident_type', type)
    if (barangay) query = query.eq('barangay', barangay)

    const { data, error } = await query
    if (error) throw error

    // Helper function to escape CSV fields
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Format data with reporter and assignee info
    const formattedData = (data || []).map((incident: any) => {
      const reporter = Array.isArray(incident.reporter) ? incident.reporter[0] : incident.reporter
      const assignee = Array.isArray(incident.assignee) ? incident.assignee[0] : incident.assignee
      
      const reporterName = reporter 
        ? (reporter.first_name && reporter.last_name 
            ? `${reporter.first_name} ${reporter.last_name}` 
            : reporter.first_name || reporter.last_name || reporter.email || 'Unknown')
        : 'Anonymous'
      
      const reporterContact = reporter?.phone_number || reporter?.email || 'N/A'
      
      const assigneeName = assignee
        ? (assignee.first_name && assignee.last_name
            ? `${assignee.first_name} ${assignee.last_name}`
            : assignee.first_name || assignee.last_name || 'Unknown')
        : 'Unassigned'

      return [
        incident.id,
        incident.created_at,
        incident.incident_type,
        incident.severity || '',
        incident.barangay,
        incident.status,
        incident.priority,
        incident.description || '',
        incident.address || '',
        reporterName,
        reporterContact,
        assigneeName
      ]
    })

    const headers = [
      'ID',
      'Created At',
      'Incident Type',
      'Severity',
      'Barangay',
      'Status',
      'Priority',
      'Description',
      'Address',
      'Reporter Name',
      'Reporter Contact',
      'Assigned To'
    ]

    const rows = [
      headers,
      ...formattedData
    ]

    const csv = rows
      .map(row => row.map(escapeCSV).join(','))
      .join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="incidents_export.csv"'
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to export' }, { status: 500 })
  }
}






