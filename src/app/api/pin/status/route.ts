import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()

    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const userId = userRes.user.id

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, pin_hash, pin_enabled')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    // Exclude barangay users
    if (userData.role === 'barangay') {
      return NextResponse.json({ success: true, enabled: false, hasPin: false, excluded: true })
    }

    const pinEnabled = userData.pin_enabled !== false
    const hasPin = !!userData.pin_hash

    return NextResponse.json({
      success: true,
      enabled: pinEnabled,
      hasPin,
      needsSetup: pinEnabled && !hasPin
    })
  } catch (error: any) {
    console.error('PIN status error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
