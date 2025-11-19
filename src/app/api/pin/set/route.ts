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
    const { pin, enabled } = await request.json()

    // Validate PIN format
    if (pin && (typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin))) {
      return NextResponse.json(
        { success: false, message: 'PIN must be exactly 4 digits' },
        { status: 400 }
      )
    }

    // Get user's role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
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
        { success: false, message: 'PIN security is not available for barangay users' },
        { status: 403 }
      )
    }

    // Security: All other roles (admin, volunteer, resident) can set/change PIN
    // No role-based restrictions beyond barangay exclusion

    const updateData: { pin_hash?: string; pin_enabled?: boolean } = {}

    // Hash PIN if provided using bcryptjs
    if (pin) {
      const saltRounds = 10
      const pinHash = await bcrypt.hash(pin, saltRounds)
      updateData.pin_hash = pinHash
    }

    // Update enabled status if provided
    if (enabled !== undefined) {
      updateData.pin_enabled = enabled
    }

    // Update user record
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating PIN:', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to update PIN' },
        { status: 500 }
      )
    }

    // Log PIN change
    try {
      await supabase.from('system_logs').insert({
        user_id: userId,
        action: pin ? 'PIN_SET' : 'PIN_ENABLED_CHANGED',
        details: JSON.stringify({ 
          enabled: enabled !== undefined ? enabled : true,
          timestamp: new Date().toISOString() 
        })
      })
    } catch (err) {
      // Ignore logging errors
    }

    return NextResponse.json(
      { success: true, message: pin ? 'PIN set successfully' : 'PIN settings updated' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('PIN set error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

