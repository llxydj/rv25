"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Lock, AlertCircle, AlertTriangle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PinVerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/resident/dashboard'
  
  const [pin, setPin] = useState<string[]>(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Check if PIN is already verified (cookie exists)
    const checkVerified = async () => {
      try {
        const res = await fetch('/api/pin/check-verified', {
          credentials: 'include',
          cache: 'no-store' // Always check fresh
        })
        
        if (!res.ok) {
          // If check fails, show PIN entry form
          if (inputRefs.current[0]) {
            inputRefs.current[0].focus()
          }
          return
        }
        
        const json = await res.json()
        
        if (json.verified) {
          // Already verified, redirect immediately WITHOUT showing the page
          // Use replace to prevent back button issues and avoid flash
          router.replace(redirectTo)
          return
        }
      } catch (error) {
        console.error('Error checking PIN verification:', error)
        // If check fails, show PIN entry form (fail open for UX)
      }
      
      // Focus first input if not verified
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus()
      }
    }

    // Check immediately on mount - no delay to prevent flash
    checkVerified()
  }, [router, redirectTo])

  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newPin = [...pin]
    newPin[index] = value
    setPin(newPin)

    // Auto-advance to next input
    if (value && index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 4 digits are entered
    if (newPin.every(d => d !== '') && index === 3) {
      setTimeout(() => {
        handleSubmit()
      }, 100)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    const pinString = pin.join('')

    // Validate
    if (pinString.length !== 4) {
      setError('Please enter a 4-digit PIN')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinString })
      })

      const json = await res.json()

      if (!json.success) {
        if (json.locked) {
          setIsLocked(true)
          if (json.lockedUntil) {
            setLockedUntil(new Date(json.lockedUntil))
          }
          setError(json.message || 'Account locked due to too many failed attempts')
        } else {
          setError(json.message || 'Invalid PIN')
          setAttemptsRemaining(json.attemptsRemaining ?? null)
          setPin(['', '', '', ''])
          if (inputRefs.current[0]) {
            inputRefs.current[0].focus()
          }
        }
        setLoading(false)
        return
      }

      // Success - verify cookie was set before redirecting
      // This prevents race conditions where the cookie isn't immediately available
      let attempts = 0
      const maxAttempts = 10
      const checkCookie = async () => {
        try {
          const verifyRes = await fetch('/api/pin/check-verified', {
            credentials: 'include',
            cache: 'no-store'
          })
          
          if (verifyRes.ok) {
            const verifyJson = await verifyRes.json()
            if (verifyJson.verified) {
              // Cookie is confirmed set, redirect
              router.replace(redirectTo)
              return
            }
          }
          
          // Cookie not set yet, retry
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(checkCookie, 100)
          } else {
            // Max attempts reached, redirect anyway (cookie should be set by now)
            router.replace(redirectTo)
          }
        } catch (err) {
          console.error('Error verifying cookie:', err)
          // If check fails, redirect anyway (cookie should be set)
          router.replace(redirectTo)
        }
      }
      
      // Start checking after a small delay
      setTimeout(checkCookie, 150)
    } catch (err: any) {
      setError(err.message || 'Failed to verify PIN. Please try again.')
      setPin(['', '', '', ''])
      setLoading(false)
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus()
      }
    }
  }

  const getLockedMessage = () => {
    if (!lockedUntil) return 'Account is locked'
    const now = new Date()
    const diff = lockedUntil.getTime() - now.getTime()
    const minutes = Math.ceil(diff / (60 * 1000))
    return `Account locked. Try again in ${minutes} minute(s).`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Enter Your PIN</CardTitle>
          <CardDescription>
            Please enter your 4-digit PIN to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className={`border-l-4 p-4 rounded ${
              isLocked 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-400'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-400'
            }`}>
              <div className="flex items-start">
                {isLocked ? (
                  <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="ml-3">
                  <p className={`text-sm ${
                    isLocked 
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {isLocked ? getLockedMessage() : error}
                  </p>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <p className="text-xs mt-1 text-yellow-600 dark:text-yellow-400">
                      {attemptsRemaining} attempt(s) remaining
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                Enter Your PIN
              </label>
              <div className="flex justify-center gap-3">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-16 h-16 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    disabled={loading || isLocked}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </div>

            {!isLocked && (
              <Button
                onClick={handleSubmit}
                disabled={loading || pin.some(d => d === '')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <LoadingSpinner size="sm" color="text-white" />
                ) : (
                  'Verify PIN'
                )}
              </Button>
            )}
          </div>

          {isLocked && lockedUntil && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getLockedMessage()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

