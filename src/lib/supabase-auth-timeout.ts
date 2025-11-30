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
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ error: { message: string } }>((resolve) => 
        setTimeout(() => resolve({ error: { message: 'Auth timeout' } }), timeoutMs)
      )
    ])
    
    clearTimeout(timeoutId)
    
    if ('error' in result && result.error?.message === 'Auth timeout') {
      throw new Error('Authentication timeout. Please check your connection and try again.')
    }
    
    // Check if the actual result has an error (network timeout, etc.)
    const authResult = result as Awaited<ReturnType<typeof supabase.auth.getUser>>
    if (authResult.error) {
      // Handle Supabase connection errors
      if (authResult.error.message?.includes('timeout') || 
          authResult.error.message?.includes('Connect Timeout') ||
          authResult.error.message?.includes('UND_ERR_CONNECT_TIMEOUT')) {
        throw new Error('Connection timeout. Please check your internet connection and try again.')
      }
      throw new Error(authResult.error.message || 'Authentication failed')
    }
    
    return authResult
  } catch (error: any) {
    clearTimeout(timeoutId)
    // Handle AbortError from timeout
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      throw new Error('Authentication timeout. Please check your connection and try again.')
    }
    // Re-throw other errors
    throw error
  }
}

/**
 * Get session with timeout - prevents infinite hanging on mobile
 * @param timeoutMs Timeout in milliseconds (default: 5000 = 5 seconds)
 * @returns Session data or throws timeout error
 */
export async function getSessionWithTimeout(timeoutMs = 5000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ error: { message: string } }>((resolve) => 
        setTimeout(() => resolve({ error: { message: 'Session timeout' } }), timeoutMs)
      )
    ])
    
    clearTimeout(timeoutId)
    
    if ('error' in result && result.error?.message === 'Session timeout') {
      throw new Error('Session verification timeout. Please try again.')
    }
    
    // Check if the actual result has an error (network timeout, etc.)
    const sessionResult = result as Awaited<ReturnType<typeof supabase.auth.getSession>>
    if (sessionResult.error) {
      // Handle Supabase connection errors
      if (sessionResult.error.message?.includes('timeout') || 
          sessionResult.error.message?.includes('Connect Timeout') ||
          sessionResult.error.message?.includes('UND_ERR_CONNECT_TIMEOUT')) {
        throw new Error('Connection timeout. Please check your internet connection and try again.')
      }
      throw new Error(sessionResult.error.message || 'Session verification failed')
    }
    
    return sessionResult
  } catch (error: any) {
    clearTimeout(timeoutId)
    // Handle AbortError from timeout
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      throw new Error('Session verification timeout. Please try again.')
    }
    // Re-throw other errors
    throw error
  }
}

