import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = "force-dynamic"

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

    // Verify admin role
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .single()

    if (adminError || adminData?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { targetUserId } = body

    if (!targetUserId) {
      return NextResponse.json({ success: false, message: 'targetUserId is required' }, { status: 400 })
    }

    // Reset PIN for target user (clear hash, keep enabled so they must set new PIN)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        pin_hash: null,
        pin_enabled: true // Force them to set new PIN
      })
      .eq('id', targetUserId)

    if (updateError) {
      console.error('Failed to reset PIN:', updateError)
      return NextResponse.json({ success: false, message: 'Failed to reset PIN' }, { status: 500 })
    }

    // Clear PIN attempts
    await supabaseAdmin
      .from('pin_attempts')
      .delete()
      .eq('user_id', targetUserId)

    // Clear PIN verification cookies for target user (would need to be done client-side)
    // Admin can't clear cookies for other users, but that's okay - they'll need to verify again

    return NextResponse.json({ 
      success: true, 
      message: 'PIN reset successfully. User will need to set a new PIN on next login.' 
    })
  } catch (error: any) {
    console.error('PIN reset error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

