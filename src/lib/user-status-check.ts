// Helper function to check if user is active
// This should be used in all API routes and auth checks

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface UserStatusCheck {
  isActive: boolean
  user: any | null
  error?: string
}

/**
 * Check if a user is active (not deactivated)
 * Returns false if user status is 'inactive' or user doesn't exist
 */
export async function checkUserStatus(userId: string): Promise<UserStatusCheck> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, status, role, first_name, last_name, email')
      .eq('id', userId)
      .maybeSingle()

    if (error || !user) {
      return {
        isActive: false,
        user: null,
        error: error?.message || 'User not found'
      }
    }

    // Check if user is deactivated
    if (user.status === 'inactive') {
      return {
        isActive: false,
        user: null,
        error: 'User account is deactivated'
      }
    }

    return {
      isActive: true,
      user
    }
  } catch (error: any) {
    return {
      isActive: false,
      user: null,
      error: error?.message || 'Failed to check user status'
    }
  }
}

/**
 * Check user status and return error response if inactive
 * Use this in API routes
 */
export async function requireActiveUser(userId: string): Promise<{
  success: boolean
  user?: any
  error?: NextResponse
}> {
  const statusCheck = await checkUserStatus(userId)
  
  if (!statusCheck.isActive) {
    return {
      success: false,
      error: NextResponse.json(
        { 
          success: false, 
          code: 'USER_DEACTIVATED',
          message: statusCheck.error || 'Your account has been deactivated. Please contact an administrator.' 
        },
        { status: 403 }
      )
    }
  }

  return {
    success: true,
    user: statusCheck.user
  }
}

