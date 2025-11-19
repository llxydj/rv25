"use client"

import { useState, useEffect } from "react"
import { Lock, X, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth"

const SESSION_UNLOCK_KEY = "pin_unlocked_session"

export function PinSecurityGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [pinEnabled, setPinEnabled] = useState(true)
  const [hasPin, setHasPin] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [inputPin, setInputPin] = useState("")
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [error, setError] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
// Inside PinSecurityGate, near the top
const bypassPin = true; // TEMPORARY: disable PIN

if (bypassPin) {
  setIsUnlocked(true)
  setLoading(false)
  return <>{children}</>
}

  // Check PIN status on mount
  useEffect(() => {
    const checkPinStatus = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/pin/status')
        const result = await response.json()

        if (result.success) {
          setPinEnabled(result.enabled)
          setHasPin(result.hasPin)
          setNeedsSetup(result.needsSetup)

          // Check if already unlocked in this session
          if (typeof window !== "undefined") {
            const sessionUnlocked = sessionStorage.getItem(SESSION_UNLOCK_KEY)
            if (sessionUnlocked === "true" && result.enabled) {
              setIsUnlocked(true)
            } else if (!result.enabled || result.excluded) {
              // PIN disabled or user excluded (barangay)
              setIsUnlocked(true)
            } else if (result.needsSetup) {
              // First-time user needs to set PIN
              setShowSettings(true)
            }
          }
        }
      } catch (err) {
        console.error('Error checking PIN status:', err)
        // On error, allow access (fail open for UX)
        setIsUnlocked(true)
      } finally {
        setLoading(false)
      }
    }

    checkPinStatus()
  }, [user])

  // Clear PIN unlock on logout
  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_UNLOCK_KEY)
      setIsUnlocked(false)
    }
  }, [user])

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (inputPin.length !== 4) {
      setError("PIN must be 4 digits")
      return
    }

    try {
      const response = await fetch('/api/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: inputPin })
      })

      const result = await response.json()

      if (result.success && result.unlocked) {
        setIsUnlocked(true)
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        }
        setInputPin("")
        setError("")
      } else {
        setError(result.message || "Incorrect PIN. Please try again.")
        setInputPin("")
      }
    } catch (err) {
      setError("Failed to verify PIN. Please try again.")
      setInputPin("")
    }
  }

  const handleTogglePin = async (enabled: boolean) => {
    // Edge case: If toggling PIN ON mid-session, require re-verification
    if (enabled && isUnlocked) {
      // User is currently unlocked but wants to enable PIN
      // This means they need to verify PIN again to stay unlocked
      setError("Enabling PIN security requires re-verification. Please enter your PIN.")
      setIsUnlocked(false)
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(SESSION_UNLOCK_KEY)
      }
    }

    setSaving(true)
    try {
      const response = await fetch('/api/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })

      const result = await response.json()

      if (result.success) {
        setPinEnabled(enabled)
        if (!enabled) {
          // Disabling PIN: unlock immediately
          setIsUnlocked(true)
          if (typeof window !== "undefined") {
            sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
          }
        } else {
          // Enabling PIN: lock and require verification
          setIsUnlocked(false)
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(SESSION_UNLOCK_KEY)
          }
        }
        setError("") // Clear any previous errors
      } else {
        setError(result.message || "Failed to update PIN settings")
      }
    } catch (err) {
      setError("Failed to update PIN settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSetPin = async (newPin: string) => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits")
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin })
      })

      const result = await response.json()

      if (result.success) {
        setHasPin(true)
        setNeedsSetup(false)
        setShowSettings(false)
        setInputPin("")
        setError("")
        // Auto-unlock after setting PIN
        setIsUnlocked(true)
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        }
      } else {
        setError(result.message || "Failed to set PIN")
      }
    } catch (err) {
      setError("Failed to set PIN. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // Show loading state
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

  // If PIN is disabled or user excluded, show children immediately
  if (!pinEnabled || !user) {
    return <>{children}</>
  }

  // If unlocked, show children
  if (isUnlocked) {
    return <>{children}</>
  }

  // Show PIN entry screen
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
                  if (val.length === 4) {
                    handleSetPin(val)
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500"
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
          <>
            <p className="text-gray-600 mb-6 text-center">
              Enter your 4-digit PIN to access the app
            </p>
            
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={inputPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "")
                    setInputPin(val)
                    setError("")
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-center text-3xl tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="0000"
                  autoFocus
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
                )}
              </div>
              
              <button
                type="submit"
                className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={inputPin.length !== 4}
              >
                Unlock
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowSettings(true)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Settings
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
