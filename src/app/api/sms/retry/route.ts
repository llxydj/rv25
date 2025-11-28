// src/app/api/sms/retry/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { smsService } from '@/lib/sms-service'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =======================
// Helper: Admin Access
// =======================
async function verifyAdminAccess(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { authorized: false, error: 'Unauthorized', status: 401 }
    }

    const { data: adminProfile } = await supabase
      .from('admin_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!adminProfile) {
      return { authorized: false, error: 'Admin access required', status: 403 }
    }

    return { authorized: true, user }
  } catch (error: any) {
    return { authorized: false, error: error.message, status: 500 }
  }
}

// =======================
// POST: Retry Failed SMS
// =======================
export async function POST(request: NextRequest) {
  try {
    // ✅ Verify Admin
    const auth = await verifyAdminAccess(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      )
    }

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'sms:retry:post'), 10)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    // Retry failed SMS sends
    const result = await smsService.retryFailedSMS()

    return NextResponse.json({
      success: result.success,
      retried: result.retried,
      results: result.results,
      message: result.retried > 0 
        ? `Retried ${result.retried} failed SMS sends` 
        : 'No failed SMS to retry'
    })

  } catch (error: any) {
    console.error('SMS retry API error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to retry SMS sends', error: error.message },
      { status: 500 }
    )
  }
}

