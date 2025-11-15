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
      .select('id, created_at, incident_type, severity, barangay, status')
      .order('created_at', { ascending: true })

    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)
    if (type) query = query.eq('incident_type', type)
    if (barangay) query = query.eq('barangay', barangay)

    const { data, error } = await query
    if (error) throw error

    const rows = [
      ['id','created_at','incident_type','severity','barangay','status'],
      ...((data || []).map((r:any)=>[
        r.id, r.created_at, r.incident_type, r.severity || '', r.barangay, r.status
      ]))
    ]
    const csv = rows.map(r => r.map(String).map(v => v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v).join(',')).join('\n')
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






