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

    const userId = userRes.user.id

    // Check if PIN is set and user status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('pin_hash, status, role')
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

    // CRITICAL: Exclude residents, barangay, and volunteer users - PIN not available for these roles
    if (userData.role === 'resident' || userData.role === 'barangay' || userData.role === 'volunteer') {
      return NextResponse.json({ 
        success: false, 
        message: 'PIN management not available for this account type' 
      }, { status: 403 })
    }

    if (!userData.pin_hash) {
      return NextResponse.json({ 
        success: false, 
        message: 'PIN not set. Please set up your PIN first.' 
      }, { status: 400 })
    }

    // Enable PIN for user
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ pin_enabled: true })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to enable PIN:', updateError)
      return NextResponse.json({ success: false, message: 'Failed to enable PIN' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'PIN enabled successfully' 
    })
  } catch (error: any) {
    console.error('PIN enable error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

