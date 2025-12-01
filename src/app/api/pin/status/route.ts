import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = "force-dynamic"
export const runtime = 'nodejs' // Explicitly set runtime to prevent 404s

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
      .select('role, pin_hash, pin_enabled, status, pin_created_at')
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

    // Exclude barangay users
    if (userData.role === 'barangay') {
      return NextResponse.json({ success: true, enabled: false, hasPin: false, excluded: true })
    }

    const pinEnabled = userData.pin_enabled !== false
    const hasPin = !!userData.pin_hash
    
    // Check if PIN has expired (15 days from creation)
    let pinExpired = false
    let daysUntilExpiry: number | null = null
    if (hasPin && userData.pin_created_at) {
      const pinCreatedDate = new Date(userData.pin_created_at)
      const now = new Date()
      const daysSinceCreation = (now.getTime() - pinCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
      const PIN_VALIDITY_DAYS = 15
      
      if (daysSinceCreation >= PIN_VALIDITY_DAYS) {
        pinExpired = true
      } else {
        daysUntilExpiry = Math.floor(PIN_VALIDITY_DAYS - daysSinceCreation)
      }
    }

    // Check if account is locked
    const { data: attemptData } = await supabase
      .from('pin_attempts')
      .select('locked_until, attempt_count')
      .eq('user_id', userId)
      .maybeSingle()

    const isLocked = attemptData?.locked_until 
      ? new Date(attemptData.locked_until) > new Date()
      : false

    return NextResponse.json({
      success: true,
      enabled: pinEnabled,
      hasPin,
      needsSetup: pinEnabled && (!hasPin || pinExpired), // Need setup if no PIN or PIN expired
      isLocked,
      lockedUntil: attemptData?.locked_until || null,
      failedAttempts: attemptData?.attempt_count || 0,
      pinExpired,
      daysUntilExpiry,
      pinCreatedAt: userData.pin_created_at || null
    })
  } catch (error: any) {
    console.error('PIN status error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
