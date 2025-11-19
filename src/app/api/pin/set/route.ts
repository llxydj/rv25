import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()

    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const userId = userRes.user.id
    const { pin, enabled } = await request.json()

    // Validate PIN format
    if (pin && (!/^\d{4}$/.test(pin))) {
      return NextResponse.json({ success: false, message: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    // Get user's role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    // Exclude barangay users
    if (userData.role === 'barangay') {
      return NextResponse.json({ success: false, message: 'PIN security is not available for barangay users' }, { status: 403 })
    }

    const updateData: { pin_hash?: string; pin_enabled?: boolean } = {}

    if (pin) {
      const pinHash = await bcrypt.hash(pin, 10)
      updateData.pin_hash = pinHash
      updateData.pin_enabled = true // enable PIN automatically if setting
    }

    if (enabled !== undefined) {
      updateData.pin_enabled = enabled
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating PIN:', updateError)
      return NextResponse.json({ success: false, message: 'Failed to update PIN' }, { status: 500 })
    }

    // Log PIN change
    try {
      await supabase.from('system_logs').insert({
        user_id: userId,
        action: pin ? 'PIN_SET' : 'PIN_ENABLED_CHANGED',
        details: JSON.stringify({ enabled: updateData.pin_enabled ?? true, timestamp: new Date().toISOString() })
      })
    } catch (err) {
      // ignore logging errors
    }

    return NextResponse.json({ success: true, message: pin ? 'PIN set successfully' : 'PIN settings updated' }, { status: 200 })
  } catch (error: any) {
    console.error('PIN set error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
