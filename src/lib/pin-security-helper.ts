/**
 * PIN Security Helper Functions
 * Utilities for checking PIN verification status and requiring re-verification
 */

/**
 * Check if PIN is verified (for client-side use)
 * This calls the API to check verification status
 */
export async function checkPinVerified(): Promise<{
  verified: boolean
  reason?: string
  message?: string
}> {
  try {
    const res = await fetch('/api/pin/check-verified', {
      credentials: 'include',
      cache: 'no-store'
    })
    
    if (!res.ok) {
      return { verified: false, reason: 'api_error', message: 'Failed to check PIN status' }
    }
    
    const json = await res.json()
    return {
      verified: json.verified || false,
      reason: json.reason,
      message: json.message
    }
  } catch (error) {
    console.error('Error checking PIN verification:', error)
    return { verified: false, reason: 'error', message: 'Error checking PIN verification' }
  }
}

/**
 * Require PIN re-verification for sensitive operations
 * This clears the PIN verification cookie, forcing re-entry
 */
export async function requirePinReverify(): Promise<boolean> {
  try {
    const res = await fetch('/api/pin/require-reverify', {
      method: 'POST',
      credentials: 'include'
    })
    
    if (!res.ok) {
      return false
    }
    
    const json = await res.json()
    return json.success || false
  } catch (error) {
    console.error('Error requiring PIN re-verification:', error)
    return false
  }
}

/**
 * Check PIN before performing sensitive operation
 * Returns true if PIN is verified, false otherwise
 * If false, redirects to PIN verify page
 */
export async function checkPinBeforeSensitiveOperation(
  redirectTo?: string
): Promise<boolean> {
  const checkResult = await checkPinVerified()
  
  if (!checkResult.verified) {
    // Redirect to PIN verify page
    const redirect = redirectTo || window.location.pathname
    window.location.href = `/pin/verify?redirect=${encodeURIComponent(redirect)}`
    return false
  }
  
  return true
}

/**
 * Update last activity timestamp
 * This should be called periodically during active use to prevent inactivity timeout
 */
export async function updatePinActivity(): Promise<void> {
  try {
    // Just calling check-verified updates the activity timestamp
    await fetch('/api/pin/check-verified', {
      credentials: 'include',
      cache: 'no-store'
    })
  } catch (error) {
    // Silently fail - this is just activity tracking
    console.debug('Failed to update PIN activity:', error)
  }
}

