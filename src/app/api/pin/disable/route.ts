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

    // CRITICAL: Check if user is deactivated
    const { data: userData, error: userCheckError } = await supabase
      .from('users')
      .select('status, role')
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

    // CRITICAL: Exclude residents, barangay, and volunteer users - PIN not available for these roles
    if (userData.role === 'resident' || userData.role === 'barangay' || userData.role === 'volunteer') {
      return NextResponse.json({ 
        success: false, 
        message: 'PIN management not available for this account type' 
      }, { status: 403 })
    }

    // Disable PIN for user
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        pin_enabled: false
        // Note: We keep pin_hash for privacy, but user can't use it when disabled
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to disable PIN:', updateError)
      return NextResponse.json({ success: false, message: 'Failed to disable PIN' }, { status: 500 })
    }

    // Clear PIN verification cookies
    const response = NextResponse.json({ 
      success: true, 
      message: 'PIN disabled successfully' 
    })

    response.cookies.delete('pin_verified')
    response.cookies.delete('pin_verified_at')

    return response
  } catch (error: any) {
    console.error('PIN disable error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

