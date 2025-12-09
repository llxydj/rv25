"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Lock, X, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

const SESSION_UNLOCK_KEY = "pin_unlocked_session"
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000 // Update activity every 5 minutes
const ACTIVITY_DEBOUNCE_MS = 30 * 1000 // Don't update more than once per 30 seconds

export function PinSecurityGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [pinEnabled, setPinEnabled] = useState(true)
  const [hasPin, setHasPin] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [inputPin, setInputPin] = useState("")
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [error, setError] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hasError, setHasError] = useState(false)

  const bypassPin = false // PIN security enabled
  
  // Skip PIN check for these routes
  const skipRoutes = ['/pin/setup', '/pin/verify', '/login', '/auth/callback', '/unauthorized']

  // Set mounted flag to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle bypass in useEffect to avoid re-render loop
  useEffect(() => {
    if (bypassPin) {
      setIsUnlocked(true)
      setLoading(false)
    }
  }, [bypassPin])

  // Check PIN status on mount (only once per user)
  useEffect(() => {
    if (bypassPin) return // skip if bypassed
    if (!user) {
      setLoading(false)
      return
    }

    // CRITICAL: SKIP PIN CHECK FOR RESIDENTS, BARANGAY, AND VOLUNTEERS - No PIN required
    // Check this FIRST before any PIN API calls
    // Also skip if role is not yet loaded (prevents PIN from showing while role loads)
    if (user.role === 'resident' || user.role === 'barangay' || user.role === 'volunteer') {
      setIsUnlocked(true)
      setLoading(false)
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        sessionStorage.setItem("pin_user_id", user.id)
      }
      return
    }

    // If user exists but role is not loaded yet, wait for role to load
    // Don't show PIN while waiting (prevents flash of PIN screen)
    // This is especially important for new Google OAuth users who might not have a role yet
    if (!user.role) {
      // Wait up to 2 seconds for role to load (longer timeout for OAuth users)
      const timeoutId = setTimeout(() => {
        // If role still not loaded after timeout, skip PIN (fail open for UX)
        // This prevents blocking users who might be in registration flow
        console.log('[PIN] Role not loaded after timeout, skipping PIN check')
        setIsUnlocked(true)
        setLoading(false)
      }, 2000)
      
      // If role loads, this effect will re-run (due to user.role dependency)
      // and we'll check again
      return () => clearTimeout(timeoutId)
    }

    let mounted = true

    const checkPinStatus = async () => {
      try {
        // Check session storage first (faster than API call)
        if (typeof window !== "undefined") {
          const sessionUnlocked = sessionStorage.getItem(SESSION_UNLOCK_KEY)
          const cachedUserId = sessionStorage.getItem("pin_user_id")
          
          // If session says unlocked and user matches, verify with server to ensure cookie is still valid
          if (sessionUnlocked === "true" && cachedUserId === user.id) {
            // Double-check with server that PIN cookie is still valid
            try {
              const verifyRes = await fetch("/api/pin/check-verified", {
                credentials: 'include',
                cache: 'no-store'
              })
              
              if (verifyRes.ok) {
                const verifyJson = await verifyRes.json()
                if (verifyJson.verified) {
                  // Cookie is valid, unlock immediately
                  if (mounted) {
                    setIsUnlocked(true)
                    setLoading(false)
                  }
                  return
                } else {
                  // Cookie expired, clear session storage
                  sessionStorage.removeItem(SESSION_UNLOCK_KEY)
                }
              }
            } catch {
              // If check fails, continue to full status check
            }
          }
        }

        // Check PIN status and verification
        const [statusRes, verifyRes] = await Promise.all([
          fetch("/api/pin/status", { cache: 'no-store' }),
          fetch("/api/pin/check-verified", { credentials: 'include', cache: 'no-store' })
        ])
        
        if (!mounted) return
        
        const statusResult = await statusRes.json()
        const verifyResult = verifyRes.ok ? await verifyRes.json() : { verified: false }

        if (statusResult.success) {
          setPinEnabled(statusResult.enabled)
          setHasPin(statusResult.hasPin)
          // Check if PIN is expired - if so, user needs to create a new PIN
          const needsNewPin = statusResult.pinExpired || statusResult.needsSetup
          setNeedsSetup(needsNewPin)

          // Check if PIN verification failed due to expiration
          if (verifyResult.reason === 'pin_expired' || statusResult.pinExpired) {
            if (mounted) {
              // Redirect to PIN setup page for expired PIN
              if (!skipRoutes.some(route => pathname.startsWith(route))) {
                const currentPath = pathname + (typeof window !== "undefined" ? window.location.search : "")
                router.replace(`/pin/setup?redirect=${encodeURIComponent(currentPath)}&expired=true`)
              }
            }
            return
          }

          // If PIN is verified via cookie OR PIN is disabled/excluded, unlock
          // Also unlock if inactivity timeout hasn't been reached (user is still active)
          // This prevents PIN popup on page refresh when user is within activity window
          const isVerified = verifyResult.verified || !statusResult.enabled || statusResult.excluded
          const isInactivityTimeout = verifyResult.reason === 'inactivity_timeout'
          
          if (isVerified && !isInactivityTimeout) {
            if (mounted) {
              setIsUnlocked(true)
              // Update session storage to persist across refreshes
              if (typeof window !== "undefined" && verifyResult.verified) {
                sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
                sessionStorage.setItem("pin_user_id", user.id)
              }
            }
          } else if (needsNewPin) {
            if (mounted) {
              // Redirect to PIN setup page instead of showing modal
              // Only redirect if not already on a PIN page
              if (!skipRoutes.some(route => pathname.startsWith(route))) {
                const currentPath = pathname + (typeof window !== "undefined" ? window.location.search : "")
                router.replace(`/pin/setup?redirect=${encodeURIComponent(currentPath)}`)
              }
            }
          }
        }
      } catch (err) {
        console.error("Error checking PIN status:", err)
        if (mounted) {
          setIsUnlocked(true) // fail open for UX
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkPinStatus()

    return () => {
      mounted = false
    }
  }, [user?.id, user?.role, bypassPin]) // Re-run if user ID or role changes

  // Clear PIN unlock on logout OR when user changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!user) {
        // User logged out
        sessionStorage.removeItem(SESSION_UNLOCK_KEY)
        sessionStorage.removeItem("pin_user_id")
        setIsUnlocked(false)
      } else {
        // Check if this is a different user than before
        const previousUserId = sessionStorage.getItem("pin_user_id")
        if (previousUserId && previousUserId !== user.id) {
          // Different user logged in - clear PIN session
          console.log("[PIN] User changed, clearing PIN session")
          sessionStorage.removeItem(SESSION_UNLOCK_KEY)
          setIsUnlocked(false)
        }
        // Store current user ID
        sessionStorage.setItem("pin_user_id", user.id)
      }
    }
  }, [user])

  // ============================================================================
  // ACTIVITY TRACKING - Keeps PIN session alive during active use
  // This prevents the 30-minute inactivity timeout from triggering while user
  // is actively using the app
  // ============================================================================
  const lastActivityUpdateRef = useRef<number>(0)
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const updateServerActivity = useCallback(async () => {
    // Only update if unlocked and user is admin (admins have stricter timeout)
    if (!isUnlocked || !user || user.role !== 'admin') return
    
    const now = Date.now()
    // Debounce: Don't update more than once per 30 seconds
    if (now - lastActivityUpdateRef.current < ACTIVITY_DEBOUNCE_MS) return
    
    lastActivityUpdateRef.current = now
    
    try {
      // This call updates the pin_last_activity cookie on the server
      await fetch('/api/pin/check-verified', {
        credentials: 'include',
        cache: 'no-store'
      })
    } catch {
      // Silently fail - this is just activity tracking
    }
  }, [isUnlocked, user])

  // Periodic activity update (every 5 minutes)
  useEffect(() => {
    if (!isUnlocked || !user || user.role !== 'admin') {
      // Clear interval if not needed
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current)
        activityIntervalRef.current = null
      }
      return
    }

    // Update activity immediately when unlocked
    updateServerActivity()

    // Set up periodic updates
    activityIntervalRef.current = setInterval(() => {
      updateServerActivity()
    }, ACTIVITY_UPDATE_INTERVAL_MS)

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current)
        activityIntervalRef.current = null
      }
    }
  }, [isUnlocked, user, updateServerActivity])

  // Update activity on user interactions (click, keypress, touch)
  useEffect(() => {
    if (!isUnlocked || !user || user.role !== 'admin') return

    const handleUserActivity = () => {
      updateServerActivity()
    }

    // Listen for user activity
    window.addEventListener('click', handleUserActivity, { passive: true })
    window.addEventListener('keydown', handleUserActivity, { passive: true })
    window.addEventListener('touchstart', handleUserActivity, { passive: true })

    return () => {
      window.removeEventListener('click', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
      window.removeEventListener('touchstart', handleUserActivity)
    }
  }, [isUnlocked, user, updateServerActivity])

  // Update activity on route changes
  useEffect(() => {
    if (isUnlocked && user?.role === 'admin') {
      updateServerActivity()
    }
  }, [pathname, isUnlocked, user, updateServerActivity])

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setHasError(false)

    if (inputPin.length !== 4) {
      setError("PIN must be 4 digits")
      setHasError(true)
      return
    }

    try {
      const res = await fetch("/api/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: inputPin }),
      })
      const result = await res.json()

      if (result.success && result.verified) {
        // Clear PIN status cache so fresh data is fetched
        const { clearPinStatusCache } = await import('@/lib/pin-auth-helper')
        clearPinStatusCache()
        
        setIsUnlocked(true)
        sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        setInputPin("")
        setError("")
        setHasError(false)
      } else {
        setError(result.message || "Incorrect PIN. Please try again.")
        setInputPin("")
        setHasError(true)
      }
    } catch {
      setError("Failed to verify PIN. Please try again.")
      setInputPin("")
      setHasError(true)
    }
  }

  const handleTogglePin = async (enabled: boolean) => {
    if (enabled && isUnlocked) {
      setError("Enabling PIN security requires re-verification. Please enter your PIN.")
      setIsUnlocked(false)
      sessionStorage.removeItem(SESSION_UNLOCK_KEY)
    }

    setSaving(true)
    try {
      const res = await fetch("/api/pin/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      const result = await res.json()
      if (result.success) {
        setPinEnabled(enabled)
        if (!enabled) {
          setIsUnlocked(true)
          sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        } else {
          setIsUnlocked(false)
          sessionStorage.removeItem(SESSION_UNLOCK_KEY)
        }
        setError("")
      } else setError(result.message || "Failed to update PIN settings")
    } catch {
      setError("Failed to update PIN settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSetPin = async (newPin: string) => {
    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits")
      setHasError(true)
      return
    }

    setSaving(true)
    setHasError(false)
    try {
      const res = await fetch("/api/pin/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      })
      const result = await res.json()
      if (result.success) {
        // Clear PIN status cache so fresh data is fetched
        const { clearPinStatusCache } = await import('@/lib/pin-auth-helper')
        clearPinStatusCache()
        
        setHasPin(true)
        setNeedsSetup(false)
        setShowSettings(false)
        setInputPin("")
        setIsUnlocked(true)
        sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        setError("")
        setHasError(false)
      } else {
        setError(result.message || "Failed to set PIN")
        setHasError(true)
      }
    } catch {
      setError("Failed to set PIN. Please try again.")
      setHasError(true)
    } finally {
      setSaving(false)
    }
  }

  // Prevent hydration mismatch - show children during SSR
  if (!mounted) {
    return <>{children}</>
  }

  // Loading screen
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-red-600" />
          <p className="text-gray-600">Loading security settings...</p>
        </div>
      </div>
    )
  }

  // Skip PIN gate if on PIN pages, if bypassed/unlocked, or if user is a resident/barangay/volunteer
  // CRITICAL: Also skip if user has no role yet (prevents PIN from showing while role loads)
  // This is important for new Google OAuth users who are in the registration flow
  if (bypassPin || !pinEnabled || !user || isUnlocked || skipRoutes.some(route => pathname.startsWith(route)) || user?.role === 'resident' || user?.role === 'barangay' || user?.role === 'volunteer' || !user?.role) {
    return <>{children}</>
  }

  // PIN entry screen
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              {needsSetup ? "Set PIN" : "Enter PIN"}
            </h2>
          </div>
          {!needsSetup && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Settings"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {showSettings || needsSetup ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {needsSetup ? "Create Your PIN (4 digits)" : "Set New PIN (4 digits)"}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={inputPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "")
                  setInputPin(val)
                  setError("")
                  setHasError(false)
                  if (val.length === 4) handleSetPin(val)
                }}
                className={`w-full px-4 py-2 border rounded-md text-center text-2xl tracking-widest focus:outline-none focus:ring-2 ${
                  hasError 
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500" 
                    : "border-gray-300 focus:ring-red-500"
                }`}
                placeholder="0000"
                autoFocus
                disabled={saving}
              />
              {needsSetup && (
                <p className="mt-2 text-xs text-gray-500 text-center">
                  This PIN will protect your app access. You can change it later in settings.
                </p>
              )}
            </div>
            {!needsSetup && (
              <>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pinEnabled}
                      onChange={(e) => handleTogglePin(e.target.checked)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      disabled={saving}
                    />
                    <span className="text-sm text-gray-700">Enable PIN Security</span>
                  </label>
                </div>
                <button
                  onClick={() => {
                    setShowSettings(false)
                    setInputPin("")
                    setError("")
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  disabled={saving}
                >
                  Back to PIN Entry
                </button>
              </>
            )}
            {saving && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-4 text-center">
            <p className="text-gray-600 mb-6">Enter your 4-digit PIN to access the app</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={inputPin}
              onChange={(e) => {
                setInputPin(e.target.value.replace(/\D/g, ""))
                setHasError(false)
                setError("")
              }}
              className={`w-full px-4 py-2 border rounded-md text-center text-3xl tracking-widest focus:outline-none focus:ring-2 ${
                hasError 
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500" 
                  : "border-gray-300 focus:ring-red-500"
              }`}
              placeholder="0000"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={inputPin.length !== 4}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Settings
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
