/**
 * PIN Authentication Helper
 * Functions to check PIN status and redirect accordingly
 */

export interface PinStatus {
  success: boolean
  enabled: boolean
  hasPin: boolean
  needsSetup: boolean
  isLocked: boolean
  lockedUntil: string | null
  excluded?: boolean
}

// Cache PIN status to prevent multiple API calls
let pinStatusCache: { status: PinStatus | null; timestamp: number } | null = null
const CACHE_DURATION_MS = 5000 // Cache for 5 seconds

export async function checkPinStatus(useCache: boolean = true): Promise<PinStatus | null> {
  // Return cached result if still valid
  if (useCache && pinStatusCache) {
    const age = Date.now() - pinStatusCache.timestamp
    if (age < CACHE_DURATION_MS) {
      return pinStatusCache.status
    }
  }

  try {
    const res = await fetch('/api/pin/status', {
      credentials: 'include',
      cache: 'no-store' // Ensure fresh data
    })
    
    if (!res.ok) {
      console.warn('[PIN] Status check failed:', res.status)
      return null
    }
    
    const json = await res.json()
    
    // Cache the result
    pinStatusCache = {
      status: json,
      timestamp: Date.now()
    }
    
    return json
  } catch (error) {
    console.error('Error checking PIN status:', error)
    return null
  }
}

// Clear PIN status cache (useful after PIN changes)
export function clearPinStatusCache() {
  pinStatusCache = null
}

export function getPinRedirectUrl(pinStatus: PinStatus | null, defaultRedirect: string): string {
  if (!pinStatus || !pinStatus.success) {
    // SECURITY: If PIN check fails, log warning but allow access
    // This prevents blocking legitimate users if API is temporarily down
    // However, we should still redirect to verify page to be safe
    console.warn('[PIN] PIN status check failed, redirecting to verify for safety')
    // Redirect to verify page - it will check cookie and redirect if already verified
    return `/pin/verify?redirect=${encodeURIComponent(defaultRedirect)}`
  }

  // Excluded users (barangay) don't need PIN
  if (pinStatus.excluded) {
    return defaultRedirect
  }

  // If PIN is disabled, go to dashboard
  if (!pinStatus.enabled) {
    return defaultRedirect
  }

  // If PIN needs setup, redirect to setup
  if (pinStatus.needsSetup) {
    return `/pin/setup?redirect=${encodeURIComponent(defaultRedirect)}`
  }

  // If PIN is enabled and set, check if verified
  if (pinStatus.enabled && pinStatus.hasPin) {
    // If locked, redirect to verify (which will show lock message)
    if (pinStatus.isLocked) {
      return `/pin/verify?redirect=${encodeURIComponent(defaultRedirect)}`
    }
    
    // Check if PIN is verified (via cookie check endpoint)
    // For now, we'll redirect to verify page and let it check the cookie
    // The verify page will redirect if already verified
    return `/pin/verify?redirect=${encodeURIComponent(defaultRedirect)}`
  }

  // Default: go to dashboard
  return defaultRedirect
}

export async function getPinRedirectForRole(role: string | null): Promise<string> {
  const defaultRedirects: Record<string, string> = {
    admin: '/admin/dashboard',
    volunteer: '/volunteer/dashboard',
    resident: '/resident/dashboard',
    barangay: '/barangay/dashboard'
  }

  const defaultRedirect = role ? defaultRedirects[role] || '/resident/dashboard' : '/resident/dashboard'
  
  // SKIP PIN CHECK FOR RESIDENTS AND BARANGAY - No PIN required
  if (role === 'resident' || role === 'barangay') {
    return defaultRedirect
  }
  
  const pinStatus = await checkPinStatus()
  
  // If PIN is enabled and set, check if already verified before redirecting
  if (pinStatus?.enabled && pinStatus?.hasPin && !pinStatus?.needsSetup) {
    try {
      // Check if PIN is already verified via cookie
      const verifyRes = await fetch('/api/pin/check-verified', {
        credentials: 'include',
        cache: 'no-store'
      })
      
      if (verifyRes.ok) {
        const verifyJson = await verifyRes.json()
        if (verifyJson.verified) {
          // PIN is already verified, go directly to dashboard
          return defaultRedirect
        }
      }
    } catch (error) {
      console.error('[PIN] Error checking verification status:', error)
      // If check fails, redirect to verify page for safety
    }
  }
  
  return getPinRedirectUrl(pinStatus, defaultRedirect)
}

