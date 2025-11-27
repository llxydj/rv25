import { NextResponse } from 'next/server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { getServerSupabase } from '@/lib/supabase-server'

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'announcements:get'), 120)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })
    
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit')
    
    const supabase = await getServerSupabase()
    let query = supabase
      .from('announcements')
      .select(`
        *,
        creator:users!announcements_created_by_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
    
    if (limit) {
      query = query.limit(Number.parseInt(limit))
    }
    
    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch announcements' }, { status: 500 })
  }
}



