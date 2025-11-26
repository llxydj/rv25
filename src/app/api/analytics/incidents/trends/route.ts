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
    const group = (searchParams.get('group') || 'day').toLowerCase() // day|week|month

    // fetch minimal columns
    let query = supabase
      .from('incidents')
      .select('created_at, incident_type, severity, barangay')

    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)
    if (type) query = query.eq('incident_type', type)
    if (barangay) query = query.eq('barangay', barangay)

    const { data, error } = await query
    if (error) throw error

    // group client-side to avoid complex SQL for portability
    const bucket = (iso: string) => {
      const d = new Date(iso)
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      if (group === 'month') return `${y}-${m}`
      if (group === 'week') {
        const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()))
        const dayNum = (tmp.getUTCDay() + 6) % 7
        tmp.setUTCDate(tmp.getUTCDate() - dayNum)
        const wy = tmp.getUTCFullYear()
        const wm = String(tmp.getUTCMonth() + 1).padStart(2, '0')
        const wd = String(tmp.getUTCDate()).padStart(2, '0')
        return `${wy}-W${wm}-${wd}`
      }
      return `${y}-${m}-${day}`
    }

    const byDate: Record<string, { total: number; bySeverity: Record<string, number>; byType: Record<string, number> }> = {}
    for (const row of data || []) {
      const key = bucket(row.created_at as any)
      const entry = byDate[key] || { total: 0, bySeverity: {}, byType: {} }
      entry.total += 1
      if (row.severity) entry.bySeverity[row.severity] = (entry.bySeverity[row.severity] || 0) + 1
      if (row.incident_type) entry.byType[row.incident_type] = (entry.byType[row.incident_type] || 0) + 1
      byDate[key] = entry
    }

    const series = Object.keys(byDate).sort().map(k => ({ date: k, ...byDate[k] }))
    return NextResponse.json({ success: true, data: { series } })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to load trends' }, { status: 500 })
  }
}





