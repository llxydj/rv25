import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

// Use service role key for admin dashboard to bypass RLS and get accurate counts
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

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'analytics:dashboard:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Use HEAD + count to avoid transferring rows
    // Use admin client to bypass RLS for accurate admin counts
    const [
      pendingP,
      assignedP,
      respondingP,
      arrivedP,
      resolvedTodayP,
      totalP
    ] = await Promise.all([
      supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'ASSIGNED'),
      supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'RESPONDING'),
      supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true }).eq('status', 'ARRIVED'),
      supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true }).gte('resolved_at', todayStart.toISOString()),
      supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true })
    ])

    const anyError = pendingP.error || assignedP.error || respondingP.error || arrivedP.error || resolvedTodayP.error || totalP.error
    if (anyError) throw anyError

    const data = {
      total_incidents: totalP.count ?? 0,
      pending_count: pendingP.count ?? 0,
      assigned_count: assignedP.count ?? 0,
      responding_count: respondingP.count ?? 0,
      arrived_count: arrivedP.count ?? 0,
      resolved_today_count: resolvedTodayP.count ?? 0,
      // room for future aggregations (volunteers, schedules) without UI changes
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch dashboard analytics' }, { status: 500 })
  }
}
