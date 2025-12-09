import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateEnhancedCSV, formatDateForCSV } from '@/lib/enhanced-csv-export'
import { getServerSupabase } from '@/lib/supabase-server'

// Use service role key for admin exports to bypass RLS and get accurate data
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function GET(request: NextRequest) {
  try {
    // Verify user is admin
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }
    
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (userData?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden: Admin access required' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const type = searchParams.get('type') || undefined
    const barangay = searchParams.get('barangay') || undefined

    // FIXED: Use admin client with pagination to ensure all data is exported
    let allIncidents: any[] = []
    let page = 0
    const pageSize = 1000
    
    while (true) {
      let query = supabaseAdmin
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
          location_lat,
          location_lng,
          assigned_at,
          resolved_at,
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
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (start) query = query.gte('created_at', start)
      if (end) query = query.lte('created_at', end)
      if (type) query = query.eq('incident_type', type)
      if (barangay) query = query.eq('barangay', barangay)

      const { data, error } = await query
      if (error) throw error
      
      if (!data || data.length === 0) break
      allIncidents = allIncidents.concat(data)
      if (data.length < pageSize) break
      page++
    }
    
    const data = allIncidents

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

    // Convert formatted data to objects for enhanced CSV
    const csvData = formattedData.map(row => {
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = row[index] || ''
      })
      return obj
    })

    // Generate enhanced CSV
    const csv = generateEnhancedCSV(csvData, headers, {
      organizationName: 'RVOIS - Rescue Volunteers Operations Information System',
      reportTitle: 'Analytics Incident Export',
      includeMetadata: true,
      includeSummary: true,
      metadata: {
        'Report Period': start && end 
          ? `${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}`
          : 'All Time',
        'Total Records': csvData.length.toString(),
        ...(type ? { 'Filter: Type': type } : {}),
        ...(barangay ? { 'Filter: Barangay': barangay } : {})
      }
    })

    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csv

    return new NextResponse(csvWithBOM, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="incidents_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to export' }, { status: 500 })
  }
}






