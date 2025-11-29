// src/lib/supabase-auth-timeout.ts
// Utility functions for Supabase auth calls with timeout protection
// Critical for mobile devices where auth calls can hang indefinitely

import { supabase } from './supabase'

/**
 * Get user with timeout - prevents infinite hanging on mobile
 * @param timeoutMs Timeout in milliseconds (default: 5000 = 5 seconds)
 * @returns User data or throws timeout error
 */
export async function getUserWithTimeout(timeoutMs = 5000) {
  return Promise.race([
    supabase.auth.getUser(),
    new Promise<{ error: { message: string } }>((resolve) => 
      setTimeout(() => resolve({ error: { message: 'Auth timeout' } }), timeoutMs)
    )
  ]).then(result => {
    if ('error' in result && result.error?.message === 'Auth timeout') {
      throw new Error('Authentication timeout. Please check your connection and try again.')
    }
    return result as Awaited<ReturnType<typeof supabase.auth.getUser>>
  })
}

/**
 * Get session with timeout - prevents infinite hanging on mobile
 * @param timeoutMs Timeout in milliseconds (default: 5000 = 5 seconds)
 * @returns Session data or throws timeout error
 */
export async function getSessionWithTimeout(timeoutMs = 5000) {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<{ error: { message: string } }>((resolve) => 
      setTimeout(() => resolve({ error: { message: 'Session timeout' } }), timeoutMs)
    )
  ]).then(result => {
    if ('error' in result && result.error?.message === 'Session timeout') {
      throw new Error('Session verification timeout. Please try again.')
    }
    return result as Awaited<ReturnType<typeof supabase.auth.getSession>>
  })
}

