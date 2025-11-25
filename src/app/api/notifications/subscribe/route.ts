// src/app/api/notifications/subscribe/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'notifications:subscribe:post'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { user_id, subscription } = await request.json()
    if (!user_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'user_id, endpoint, p256dh, auth required' }, { status: 400 })
    }

    const payload = {
      user_id,
      endpoint: subscription.endpoint as string,
      p256dh: subscription.keys.p256dh as string,
      auth: subscription.keys.auth as string,
      subscription,
    }

    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    if (!me?.user?.id || me.user.id !== user_id) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'user_id,subscription_hash' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to subscribe' }, { status: 500 })
  }
}


