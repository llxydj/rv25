import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const userId = userRes.user.id
    const { pin } = await request.json()

    if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, message: 'Invalid PIN format' },
        { status: 400 }
      )
    }

    // Get user's role and PIN hash from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, pin_hash, pin_enabled')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    // Security: Barangay users are excluded from PIN protection (per requirements)
    if (userData.role === 'barangay') {
      return NextResponse.json(
        { success: true, unlocked: true },
        { status: 200 }
      )
    }

    // Security: All other roles (admin, volunteer, resident) require PIN verification
    // This prevents non-admin users from bypassing PIN accidentally
    // Check if PIN is enabled for this user (default true if not set)
    const pinEnabled = userData.pin_enabled !== false

    if (!pinEnabled) {
      // User has explicitly disabled PIN - allow access
      // But log this for audit purposes
      await supabase.from('system_logs').insert({
        user_id: userId,
        action: 'PIN_BYPASS_DISABLED',
        details: JSON.stringify({ 
          timestamp: new Date().toISOString(),
          role: userData.role 
        })
      }).then(() => {}).catch(() => {})
      
      return NextResponse.json(
        { success: true, unlocked: true },
        { status: 200 }
      )
    }

    // If no PIN hash exists, allow access (first-time user)
    if (!userData.pin_hash) {
      return NextResponse.json(
        { success: true, unlocked: true, needsSetup: true },
        { status: 200 }
      )
    }

    // Verify PIN against hash using bcryptjs
    const isValid = await bcrypt.compare(pin, userData.pin_hash)

    if (!isValid) {
      // Log failed attempt (for audit)
      await supabase.from('system_logs').insert({
        user_id: userId,
        action: 'PIN_VERIFICATION_FAILED',
        details: JSON.stringify({ timestamp: new Date().toISOString() })
      }).then(() => {}).catch(() => {})

      return NextResponse.json(
        { success: false, message: 'Incorrect PIN' },
        { status: 401 }
      )
    }

    // Log successful verification
    await supabase.from('system_logs').insert({
      user_id: userId,
      action: 'PIN_VERIFICATION_SUCCESS',
      details: JSON.stringify({ timestamp: new Date().toISOString() })
    }).catch(() => {})

    return NextResponse.json(
      { success: true, unlocked: true },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('PIN verification error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

