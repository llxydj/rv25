import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = "force-dynamic"

// PIN verification expiration settings
const PIN_SESSION_DURATION_HOURS = 24 // PIN valid for 24 hours
const PIN_INACTIVITY_TIMEOUT_MINUTES_ADMIN = 5 // Require re-verification after 5 minutes of inactivity for admins
const PIN_INACTIVITY_TIMEOUT_MINUTES_VOLUNTEER = 120 // Require re-verification after 2 hours of inactivity for volunteers
const PIN_INACTIVITY_TIMEOUT_MINUTES_OTHER = 30 // Require re-verification after 30 minutes of inactivity for other roles

export async function GET() {
  try {
    // CRITICAL: Check if user is deactivated first
    const supabase = await getServerSupabase()
    const { data: userRes } = await supabase.auth.getUser()
    
    let userRole: string | null = null
    
    if (userRes?.user?.id) {
      const { data: userData } = await supabase
        .from('users')
        .select('status, role')
        .eq('id', userRes.user.id)
        .maybeSingle()

      if (userData) {
        userRole = (userData as any).role
        
        if ((userData as any).status === 'inactive') {
          // Clear PIN cookies if user is deactivated
          const response = NextResponse.json({ 
            verified: false,
            reason: 'account_deactivated',
            message: 'Your account has been deactivated.'
          })
          response.cookies.delete('pin_verified')
          response.cookies.delete('pin_verified_at')
          response.cookies.delete('pin_last_activity')
          return response
        }
      }
    }

    const cookieStore = await cookies()
    const pinVerified = cookieStore.get('pin_verified')
    const pinVerifiedAt = cookieStore.get('pin_verified_at')
    const lastActivityAt = cookieStore.get('pin_last_activity')

    // Check if PIN verification cookie exists and is valid
    if (pinVerified?.value === 'true' && pinVerifiedAt?.value) {
      const verifiedAt = parseInt(pinVerifiedAt.value)
      const now = Date.now()
      const hoursSinceVerification = (now - verifiedAt) / (1000 * 60 * 60)

      // Check if PIN session has expired (24 hours)
      if (hoursSinceVerification >= PIN_SESSION_DURATION_HOURS) {
        return NextResponse.json({ 
          verified: false,
          reason: 'session_expired',
          message: 'PIN session expired. Please verify again.'
        })
      }

      // Check inactivity timeout (5 minutes for admins, 2 hours for volunteers, 30 minutes for others)
      const inactivityTimeout = userRole === 'admin' 
        ? PIN_INACTIVITY_TIMEOUT_MINUTES_ADMIN 
        : userRole === 'volunteer'
        ? PIN_INACTIVITY_TIMEOUT_MINUTES_VOLUNTEER
        : PIN_INACTIVITY_TIMEOUT_MINUTES_OTHER
        
      // Check inactivity timeout - if no activity timestamp exists, treat as just verified (set it now)
      let lastActivity = now
      if (lastActivityAt?.value) {
        lastActivity = parseInt(lastActivityAt.value)
        const minutesSinceActivity = (now - lastActivity) / (1000 * 60)
        
        if (minutesSinceActivity >= inactivityTimeout) {
          return NextResponse.json({ 
            verified: false,
            reason: 'inactivity_timeout',
            message: 'PIN verification required due to inactivity.'
          })
        }
      }
      // If no activity timestamp exists but PIN is verified, this is a fresh verification
      // We'll set the activity timestamp now to start tracking

      // Update last activity timestamp (this extends the session on every check/refresh)
      const response = NextResponse.json({ 
        verified: true,
        verifiedAt: verifiedAt,
        lastActivity: lastActivity
      })

      // Update activity timestamp - this ensures refreshes extend the session
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + PIN_SESSION_DURATION_HOURS)
      
      response.cookies.set('pin_last_activity', now.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/'
      })

      return response
    }

    return NextResponse.json({ 
      verified: false,
      reason: 'not_verified',
      message: 'PIN not verified.'
    })
  } catch (error: any) {
    console.error('PIN check verified error:', error)
    return NextResponse.json({ 
      verified: false,
      reason: 'error',
      message: 'Error checking PIN verification.'
    })
  }
}

