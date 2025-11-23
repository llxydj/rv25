export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()

    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const userId = userRes.user.id

    // Fetch user
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

    let pinEnabled = userData.pin_enabled !== false
    let hasPin = !!userData.pin_hash

    // ===== EMERGENCY BYPASS =====
    // If no PIN hash, create a temporary default PIN ("0000") for access
    if (!hasPin && pinEnabled) {
      const tempPin = '0000'
      const tempHash = await bcrypt.hash(tempPin, 10)

      const { error: updateError } = await supabase
        .from('users')
        .update({ pin_hash: tempHash })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to set temporary PIN hash:', updateError)
      } else {
        console.log(`Temporary PIN "0000" set for user ${userId}`)
        hasPin = true
      }
    }
    // =============================

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
