import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import bcrypt from 'bcryptjs'

export const dynamic = "force-dynamic"

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

    // Check if PIN matches confirmation
    if (pin !== confirmPin) {
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

    // Update user's PIN
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        pin_hash: pinHash,
        pin_enabled: true
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to set PIN:', updateError)
      return NextResponse.json({ success: false, message: 'Failed to set PIN' }, { status: 500 })
    }

    // Clear any failed attempts when PIN is set/reset
    await supabase
      .from('pin_attempts')
      .delete()
      .eq('user_id', userId)

    return NextResponse.json({ 
      success: true, 
      message: 'PIN set successfully' 
    })
  } catch (error: any) {
    console.error('PIN set error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
