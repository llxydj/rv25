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
    const { pin } = await request.json()

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ success: false, message: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    // Get user's PIN hash and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('pin_hash, pin_enabled, role')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    if (userData.role === 'barangay') {
      return NextResponse.json({ success: true, unlocked: true, needsSetup: false, excluded: true })
    }

    if (!userData.pin_enabled) {
      return NextResponse.json({ success: true, unlocked: true, needsSetup: false })
    }

    if (!userData.pin_hash) {
      return NextResponse.json({ success: false, message: 'PIN not set', needsSetup: true }, { status: 400 })
    }

    const match = await bcrypt.compare(pin, userData.pin_hash)
    if (!match) {
      return NextResponse.json({ success: false, message: 'Invalid PIN' }, { status: 401 })
    }

    return NextResponse.json({ success: true, unlocked: true, needsSetup: false })
  } catch (error: any) {
    console.error('PIN verify error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
