import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { searchParams } = new URL(request.url)
    const barangay = searchParams.get('barangay')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!barangay) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'barangay is required' }, { status: 400 })
    }

    let query = supabase
      .from('incidents')
      .select('*')
      .eq('barangay', barangay)
      .order('created_at', { ascending: false })

    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to load barangay summary' }, { status: 500 })
  }
}
