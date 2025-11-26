"use client"

import { useState, useEffect } from "react"
import { Lock, X, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

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

  const bypassPin = true // TEMPORARY: disable PIN

  // Handle bypass in useEffect to avoid re-render loop
  useEffect(() => {
    if (bypassPin) {
      setIsUnlocked(true)
      setLoading(false)
    }
  }, [bypassPin])

  // Check PIN status on mount
  useEffect(() => {
    if (bypassPin) return // skip if bypassed
    if (!user) {
      setLoading(false)
      return
    }

    const checkPinStatus = async () => {
      try {
        const res = await fetch("/api/pin/status")
        const result = await res.json()

        if (result.success) {
          setPinEnabled(result.enabled)
          setHasPin(result.hasPin)
          setNeedsSetup(result.needsSetup)

          if (typeof window !== "undefined") {
            const sessionUnlocked = sessionStorage.getItem(SESSION_UNLOCK_KEY)
            if ((sessionUnlocked === "true" && result.enabled) || !result.enabled || result.excluded) {
              setIsUnlocked(true)
            } else if (result.needsSetup) {
              setShowSettings(true)
            }
          }
        }
      } catch (err) {
        console.error("Error checking PIN status:", err)
        setIsUnlocked(true) // fail open for UX
      } finally {
        setLoading(false)
      }
    }

    checkPinStatus()
  }, [user, bypassPin])

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
      const res = await fetch("/api/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: inputPin }),
      })
      const result = await res.json()

      if (result.success && result.unlocked) {
        setIsUnlocked(true)
        sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        setInputPin("")
        setError("")
      } else {
        setError(result.message || "Incorrect PIN. Please try again.")
        setInputPin("")
      }
    } catch {
      setError("Failed to verify PIN. Please try again.")
      setInputPin("")
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
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/pin/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      })
      const result = await res.json()
      if (result.success) {
        setHasPin(true)
        setNeedsSetup(false)
        setShowSettings(false)
        setInputPin("")
        setIsUnlocked(true)
        sessionStorage.setItem(SESSION_UNLOCK_KEY, "true")
        setError("")
      } else setError(result.message || "Failed to set PIN")
    } catch {
      setError("Failed to set PIN. Please try again.")
    } finally {
      setSaving(false)
    }
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

  if (bypassPin || !pinEnabled || !user || isUnlocked) return <>{children}</>

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
                  if (val.length === 4) handleSetPin(val)
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
          <form onSubmit={handlePinSubmit} className="space-y-4 text-center">
            <p className="text-gray-600 mb-6">Enter your 4-digit PIN to access the app</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-center text-3xl tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500"
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
