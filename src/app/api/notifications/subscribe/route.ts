// src/app/api/notifications/subscribe/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'notifications:subscribe:post'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    // Get authenticated user from session
    const supabase = await getServerSupabase()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser?.id) {
      return NextResponse.json({ success: false, code: 'UNAUTHORIZED', message: 'Not authenticated' }, { status: 401 })
    }

    const { subscription } = await request.json()
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'subscription with endpoint, p256dh, auth required' }, { status: 400 })
    }

    const payload: any = {
      user_id: authUser.id,
      endpoint: subscription.endpoint as string,
      p256dh: subscription.keys.p256dh as string,
      auth: subscription.keys.auth as string,
      subscription,
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to subscribe' }, { status: 500 })
  }
}


