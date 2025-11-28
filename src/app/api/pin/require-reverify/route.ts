import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = "force-dynamic"

/**
 * API endpoint to require PIN re-verification for sensitive operations
 * This clears the PIN verification cookie, forcing the user to re-enter PIN
 * 
 * Use this endpoint before performing sensitive operations like:
 * - Password changes
 * - User deletion/deactivation
 * - Admin settings changes
 * - PIN changes
 * - Account settings modifications
 */
export async function POST() {
  try {
    const response = NextResponse.json({ 
      success: true,
      message: 'PIN re-verification required',
      requiresReverify: true
    })
    
    // Clear PIN verification cookies to force re-verification
    response.cookies.delete('pin_verified')
    response.cookies.delete('pin_verified_at')
    response.cookies.delete('pin_last_activity')
    
    return response
  } catch (error: any) {
    console.error('PIN require reverify error:', error)
    return NextResponse.json({ 
      success: false,
      message: 'Error requiring PIN re-verification'
    }, { status: 500 })
  }
}

