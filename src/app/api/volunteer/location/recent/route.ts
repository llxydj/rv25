import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    // Admins only
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const url = new URL(request.url)
    const sinceMin = parseInt(url.searchParams.get('since') || '120', 10) // default 2h
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 2000)

    const sinceIso = new Date(Date.now() - sinceMin * 60 * 1000).toISOString()

    // Fetch most recent points (simple version: latest N rows)
    const { data, error } = await supabase
      .from('volunteer_locations')
      .select('id,user_id,lat,lng,accuracy,speed,heading,created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch recent locations' }, { status: 500 })
  }
}
