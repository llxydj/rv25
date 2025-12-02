"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Lock, ArrowRight, AlertCircle, CheckCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"

export default function PinSetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const redirectTo = searchParams.get('redirect') || '/resident/dashboard'
  const isExpired = searchParams.get('expired') === 'true'

  // CRITICAL: Redirect residents, barangay, and volunteers away from PIN pages - they don't need PIN
  useEffect(() => {
    if (user?.role === 'resident' || user?.role === 'barangay' || user?.role === 'volunteer') {
      router.replace(redirectTo)
    }
  }, [user?.role, router, redirectTo])
  
  const [pin, setPin] = useState<string[]>(['', '', '', ''])
  const [confirmPin, setConfirmPin] = useState<string[]>(['', '', '', ''])
  const [currentStep, setCurrentStep] = useState<'pin' | 'confirm'>('pin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasError, setHasError] = useState(false)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const confirmInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Focus first input on mount
    if (currentStep === 'pin' && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    } else if (currentStep === 'confirm' && confirmInputRefs.current[0]) {
      confirmInputRefs.current[0].focus()
    }
  }, [currentStep])

  const handlePinChange = (index: number, value: string, isConfirm: boolean = false) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const refs = isConfirm ? confirmInputRefs : inputRefs
    const state = isConfirm ? confirmPin : pin
    const setState = isConfirm ? setConfirmPin : setPin

    const newPin = [...state]
    newPin[index] = value
    setState(newPin)
    
    // Clear error state when user starts typing
    if (hasError) {
      setHasError(false)
      setError(null)
    }

    // Auto-advance to next input
    if (value && index < 3 && refs.current[index + 1]) {
      refs.current[index + 1]?.focus()
    }

    // Auto-submit when all 4 digits are entered
    if (!isConfirm && newPin.every(d => d !== '') && index === 3) {
      setTimeout(() => {
        setCurrentStep('confirm')
      }, 100)
    } else if (isConfirm && newPin.every(d => d !== '') && index === 3) {
      // Auto-submit confirmation
      setTimeout(() => {
        handleSubmit()
      }, 100)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, isConfirm: boolean = false) => {
    const refs = isConfirm ? confirmInputRefs : inputRefs
    const state = isConfirm ? confirmPin : pin

    if (e.key === 'Backspace' && !state[index] && index > 0) {
      refs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setHasError(false)
    setLoading(true)

    const pinString = pin.join('')
    const confirmPinString = confirmPin.join('')

    // Validate PIN format
    if (!pinString || pinString.length !== 4) {
      setError('Please enter a 4-digit PIN')
      setHasError(true)
      setLoading(false)
      return
    }

    // Validate PIN contains only digits
    if (!/^\d{4}$/.test(pinString)) {
      setError('PIN must contain only numbers (0-9)')
      setHasError(true)
      setLoading(false)
      return
    }

    // Validate confirmation PIN
    if (!confirmPinString || confirmPinString.length !== 4) {
      setError('Please confirm your PIN by entering all 4 digits')
      setHasError(true)
      setLoading(false)
      return
    }

    // Validate PINs match
    if (pinString !== confirmPinString) {
      setError('PINs do not match. Please try again.')
      setHasError(true)
      setConfirmPin(['', '', '', ''])
      setCurrentStep('pin')
      setLoading(false)
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus()
        }
      }, 100)
      return
    }

    try {
      const res = await fetch('/api/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinString, confirmPin: confirmPinString })
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        // Handle specific error codes
        if (res.status === 400) {
          throw new Error(json.message || 'Invalid PIN. Please check your input and try again.')
        } else if (res.status === 401) {
          throw new Error('You are not authenticated. Please log in again.')
        } else if (res.status === 403) {
          throw new Error(json.message || 'You do not have permission to set a PIN.')
        } else if (res.status === 404) {
          throw new Error('User account not found. Please contact support.')
        } else if (res.status === 500) {
          throw new Error('Server error. Please try again in a moment.')
        }
        throw new Error(json.message || 'Failed to set PIN. Please try again.')
      }

      setSuccess(true)
      setError(null)
      setHasError(false)
      
      // Redirect after short delay
      // Use replace to prevent back button from going to setup page
      setTimeout(() => {
        router.replace(redirectTo)
      }, 1500)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to set PIN. Please try again.'
      setError(errorMessage)
      setHasError(true)
      setPin(['', '', '', ''])
      setConfirmPin(['', '', '', ''])
      setCurrentStep('pin')
      setLoading(false)
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus()
        }
      }, 100)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">PIN Set Successfully!</h2>
            <p className="text-gray-600 dark:text-gray-400">Redirecting you now...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isExpired ? 'PIN Expired - Create New PIN' : 'Set Up Your PIN'}
          </CardTitle>
          <CardDescription>
            {isExpired 
              ? 'Your PIN has expired after 15 days. Please create a new PIN to continue.'
              : currentStep === 'pin' 
                ? 'Enter a 4-digit PIN to secure your account'
                : 'Confirm your PIN to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isExpired && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 dark:border-yellow-400 p-4 rounded">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    PIN Security Notice
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    For security reasons, your PIN expires after 15 days. Please create a new PIN to continue using the system.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 p-4 rounded">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                {currentStep === 'pin' ? 'Enter Your PIN' : 'Confirm Your PIN'}
              </label>
              <div className="flex justify-center gap-3">
                {(currentStep === 'pin' ? pin : confirmPin).map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      if (currentStep === 'pin') {
                        inputRefs.current[index] = el
                      } else {
                        confirmInputRefs.current[index] = el
                      }
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value, currentStep === 'confirm')}
                    onKeyDown={(e) => handleKeyDown(index, e, currentStep === 'confirm')}
                    className={`w-16 h-16 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      hasError 
                        ? "border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500" 
                        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                    disabled={loading}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </div>

            {currentStep === 'confirm' && (
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCurrentStep('pin')
                    setConfirmPin(['', '', '', ''])
                    if (inputRefs.current[0]) {
                      inputRefs.current[0].focus()
                    }
                  }}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || confirmPin.some(d => d === '')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" color="text-white" />
                  ) : (
                    <>
                      Confirm & Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Security Information:</strong>
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
              <li>Choose a PIN that's easy for you to remember but hard for others to guess</li>
              <li>Don't use common PINs like 0000, 1234, or your birth year</li>
              <li>Your PIN is encrypted and stored securely</li>
              <li>PINs expire after 15 days for security - you'll need to create a new one</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

