"use client"

import { useState, useEffect } from "react"
import { Lock, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/hooks/use-auth"

export function PinManagement() {
  const { user } = useAuth()
  const [pinStatus, setPinStatus] = useState<{
    enabled: boolean
    hasPin: boolean
    needsSetup: boolean
    isLocked: boolean
    loading: boolean
    excluded?: boolean
  }>({
    enabled: false,
    hasPin: false,
    needsSetup: false,
    isLocked: false,
    loading: true
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // CRITICAL: Hide PIN management for residents, barangay, and volunteers - they don't need PIN
  if (user?.role === 'resident' || user?.role === 'barangay' || user?.role === 'volunteer') {
    return null
  }

  useEffect(() => {
    fetchPinStatus()
  }, [])

  const fetchPinStatus = async () => {
    try {
      const res = await fetch('/api/pin/status')
      const json = await res.json()
      
      if (json.success) {
        // If user is excluded (resident/barangay), don't show PIN management
        if (json.excluded) {
          setPinStatus(prev => ({ ...prev, loading: false, excluded: true }))
          return
        }
        
        setPinStatus({
          enabled: json.enabled,
          hasPin: json.hasPin,
          needsSetup: json.needsSetup,
          isLocked: json.isLocked,
          loading: false,
          excluded: false
        })
      } else {
        setError('Failed to load PIN status')
        setPinStatus(prev => ({ ...prev, loading: false }))
      }
    } catch (err: any) {
      setError('Failed to load PIN status')
      setPinStatus(prev => ({ ...prev, loading: false }))
    }
  }

  const handleEnable = async () => {
    if (!pinStatus.hasPin) {
      // Redirect to setup
      window.location.href = '/pin/setup?redirect=' + encodeURIComponent(window.location.pathname)
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/pin/enable', {
        method: 'POST'
      })
      const json = await res.json()

      if (json.success) {
        setSuccess('PIN enabled successfully')
        await fetchPinStatus()
      } else {
        setError(json.message || 'Failed to enable PIN')
      }
    } catch (err: any) {
      setError('Failed to enable PIN')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable PIN protection? This will make your account less secure.')) {
      return
    }

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/pin/disable', {
        method: 'POST'
      })
      const json = await res.json()

      if (json.success) {
        setSuccess('PIN disabled successfully')
        await fetchPinStatus()
      } else {
        setError(json.message || 'Failed to disable PIN')
      }
    } catch (err: any) {
      setError('Failed to disable PIN')
    } finally {
      setActionLoading(false)
    }
  }

  const handleChangePin = () => {
    // Redirect to setup (which will update existing PIN)
    window.location.href = '/pin/setup?redirect=' + encodeURIComponent(window.location.pathname)
  }

  // Don't render if excluded (resident/barangay)
  if (pinStatus.excluded) {
    return null
  }

  if (pinStatus.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium mb-4 flex items-center">
          <Lock className="mr-2 h-5 w-5" />
          PIN Security
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Add an extra layer of security to your account with a 4-digit PIN. You'll be asked to enter your PIN after logging in.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="ml-3 text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-900">PIN Status</p>
            <p className="text-xs text-gray-500 mt-1">
              {pinStatus.enabled && pinStatus.hasPin
                ? 'PIN is enabled and set'
                : pinStatus.needsSetup
                ? 'PIN is enabled but not set'
                : 'PIN is disabled'}
            </p>
          </div>
          <div className="flex items-center">
            {pinStatus.enabled && pinStatus.hasPin ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>

        {pinStatus.isLocked && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
            <p className="text-xs text-yellow-800">
              ⚠️ Your account is temporarily locked due to too many failed PIN attempts. Please wait before trying again.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {!pinStatus.hasPin ? (
            <Button
              onClick={handleEnable}
              disabled={actionLoading || pinStatus.isLocked}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Set Up PIN
                </>
              )}
            </Button>
          ) : pinStatus.enabled ? (
            <>
              <Button
                onClick={handleChangePin}
                disabled={actionLoading || pinStatus.isLocked}
                variant="outline"
                className="w-full"
              >
                Change PIN
              </Button>
              <Button
                onClick={handleDisable}
                disabled={actionLoading || pinStatus.isLocked}
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
              >
                Disable PIN
              </Button>
            </>
          ) : (
            <Button
              onClick={handleEnable}
              disabled={actionLoading || pinStatus.isLocked}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Enable PIN
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-xs text-blue-800 font-medium mb-2">Security Tips:</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Choose a PIN that's easy for you to remember but hard for others to guess</li>
          <li>Don't use common PINs like 0000, 1234, or your birth year</li>
          <li>Your PIN is encrypted and stored securely</li>
          <li>You can disable PIN protection at any time</li>
        </ul>
      </div>
    </div>
  )
}

