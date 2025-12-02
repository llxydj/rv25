import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export const dynamic = "force-dynamic"
export const runtime = 'nodejs' // Explicitly set runtime to prevent 404s

// Service role client for admin operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Common PINs to prevent (weak security)
const COMMON_PINS = ['0000', '1111', '1234', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '0123', '3210']

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()

    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const userId = userRes.user.id

    // CRITICAL: Check if user is deactivated and get current PIN status
    const { data: userData, error: userCheckError } = await supabase
      .from('users')
      .select('status, pin_hash, role')
      .eq('id', userId)
      .single()

    if (userCheckError || !userData) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    if ((userData as any).status === 'inactive') {
      return NextResponse.json({ 
        success: false, 
        message: 'Your account has been deactivated. Please contact an administrator.' 
      }, { status: 403 })
    }

    // CRITICAL: Exclude residents and barangay users - PIN not available for these roles
    if (userData.role === 'resident' || userData.role === 'barangay') {
      return NextResponse.json({ 
        success: false, 
        message: 'PIN setup not available for this account type' 
      }, { status: 403 })
    }
    
    // Check if this is a new PIN setup (user didn't have a PIN before)
    const isNewPinSetup = !userData.pin_hash

    const body = await request.json()
    const { pin, confirmPin } = body

    // Validate PIN format
    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ success: false, message: 'PIN is required' }, { status: 400 })
    }

    // Validate PIN is 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ success: false, message: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    // Check if PIN matches confirmation (skip if confirmPin not provided - for simple set flow)
    if (confirmPin !== undefined && pin !== confirmPin) {
      return NextResponse.json({ success: false, message: 'PIN and confirmation do not match' }, { status: 400 })
    }

    // Prevent common PINs
    if (COMMON_PINS.includes(pin)) {
      return NextResponse.json({ 
        success: false, 
        message: 'This PIN is too common. Please choose a different PIN.' 
      }, { status: 400 })
    }

    // Hash PIN with bcrypt
    const pinHash = await bcrypt.hash(pin, 10)

    console.log('📌 [PIN Set] Updating PIN for user:', userId)

    // Update user's PIN using service role client (bypasses RLS)
    // Set pin_created_at to current timestamp for 15-day validity tracking
    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        pin_hash: pinHash,
        pin_enabled: true,
        pin_created_at: now // Track when PIN was created for 15-day validity
      })
      .eq('id', userId)

    if (updateError) {
      console.error('❌ [PIN Set] Failed to set PIN:', updateError)
      return NextResponse.json({ success: false, message: 'Failed to set PIN' }, { status: 500 })
    }

    console.log('✅ [PIN Set] PIN hash saved successfully')

    // Clear any failed attempts when PIN is set/reset
    await supabaseAdmin
      .from('pin_attempts')
      .delete()
      .eq('user_id', userId)
      .then(() => console.log('✅ [PIN Set] Cleared PIN attempts'))
      .catch((err) => console.warn('⚠️ [PIN Set] Could not clear attempts:', err))

    // For new PIN setups, automatically set verification cookie so user doesn't need to enter PIN again
    const response = NextResponse.json({ 
      success: true, 
      message: 'PIN set successfully' 
    })
    
    if (isNewPinSetup) {
      // Set PIN verification cookie (HTTP-only, secure, 24 hours)
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

      response.cookies.set('pin_verified_at', now.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/'
      })

      response.cookies.set('pin_last_activity', now.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/'
      })
      
      console.log('✅ [PIN Set] Auto-verified new PIN setup')
    }
    
    return response
  } catch (error: any) {
    console.error('PIN set error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
