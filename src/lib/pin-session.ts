/**
 * PIN Session Management
 * Helper functions to check PIN verification status
 */

export async function checkPinVerified(): Promise<boolean> {
  try {
    // Check PIN status - if enabled and has PIN, verify cookie exists
    const res = await fetch('/api/pin/status', {
      credentials: 'include'
    })
    const json = await res.json()

    if (!json.success) {
      return false
    }

    // If PIN is disabled or not set, consider it "verified"
    if (!json.enabled || !json.hasPin) {
      return true
    }

    // If account is locked, not verified
    if (json.isLocked) {
      return false
    }

    // For client-side, we can't read HTTP-only cookies
    // So we'll check via a separate endpoint that reads the cookie server-side
    const verifyRes = await fetch('/api/pin/check-verified', {
      credentials: 'include'
    })
    const verifyJson = await verifyRes.json()

    return verifyJson.verified === true
  } catch (error) {
    console.error('Error checking PIN verification:', error)
    return false
  }
}

export function clearPinSession() {
  // Clear PIN verification cookies
  // Note: HTTP-only cookies can only be cleared server-side
  // This is handled in the sign-out function
  if (typeof document !== 'undefined') {
    // Clear any client-side PIN state if needed
    sessionStorage.removeItem('pin_unlocked_session')
  }
}

