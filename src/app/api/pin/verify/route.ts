import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { checkPinRateLimit, recordPinAttempt } from '@/lib/pin-rate-limit'

export const dynamic = "force-dynamic"

// Service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()

    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const userId = userRes.user.id

    const body = await request.json()
    const { pin } = body

    // Validate PIN format
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ success: false, message: 'Invalid PIN format' }, { status: 400 })
    }

    // Check rate limiting
    const rateLimit = await checkPinRateLimit(supabaseAdmin, userId)
    if (!rateLimit.allowed) {
      await recordPinAttempt(supabaseAdmin, userId, false)
      return NextResponse.json({ 
        success: false, 
        message: rateLimit.message,
        locked: rateLimit.locked,
        lockedUntil: rateLimit.lockedUntil?.toISOString() || null,
        attemptsRemaining: rateLimit.attemptsRemaining
      }, { status: 429 })
    }

    // Get user's PIN hash and status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('pin_hash, pin_enabled, role, status')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    // CRITICAL: Check if user is deactivated
    if ((userData as any).status === 'inactive') {
      return NextResponse.json({ 
        success: false, 
        message: 'Your account has been deactivated. Please contact an administrator.' 
      }, { status: 403 })
    }

    // Exclude barangay users
    if (userData.role === 'barangay') {
      return NextResponse.json({ success: false, message: 'PIN verification not available for this account type' }, { status: 403 })
    }

    // Check if PIN is enabled
    if (userData.pin_enabled === false) {
      return NextResponse.json({ success: true, verified: true, message: 'PIN is disabled' })
    }

    // Check if PIN is set
    if (!userData.pin_hash) {
      return NextResponse.json({ success: false, message: 'PIN not set. Please set up your PIN first.' }, { status: 400 })
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, userData.pin_hash)

    if (!isValid) {
      // Record failed attempt
      await recordPinAttempt(supabaseAdmin, userId, false)
      
      // Check rate limit again after recording
      const newRateLimit = await checkPinRateLimit(supabaseAdmin, userId)
      
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid PIN',
        attemptsRemaining: newRateLimit.attemptsRemaining,
        locked: newRateLimit.locked,
        lockedUntil: newRateLimit.lockedUntil?.toISOString() || null
      }, { status: 401 })
    }

    // PIN is valid - record success and clear attempts
    await recordPinAttempt(supabaseAdmin, userId, true)

    // Set PIN verification cookie (HTTP-only, secure, 24 hours)
    const response = NextResponse.json({ 
      success: true, 
      verified: true,
      message: 'PIN verified successfully'
    })

    // Set HTTP-only cookie for PIN verification
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hours
    const now = Date.now()

    response.cookies.set('pin_verified', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    })

    // Also set a timestamp cookie for verification
    response.cookies.set('pin_verified_at', now.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    })

    // Set last activity timestamp for inactivity tracking
    response.cookies.set('pin_last_activity', now.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    })

    return response
  } catch (error: any) {
    console.error('PIN verify error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
