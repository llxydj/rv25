"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Lock, ArrowRight, AlertCircle, CheckCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PinSetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/resident/dashboard'
  
  const [pin, setPin] = useState<string[]>(['', '', '', ''])
  const [confirmPin, setConfirmPin] = useState<string[]>(['', '', '', ''])
  const [currentStep, setCurrentStep] = useState<'pin' | 'confirm'>('pin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
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
    setLoading(true)

    const pinString = pin.join('')
    const confirmPinString = confirmPin.join('')

    // Validate
    if (pinString.length !== 4) {
      setError('Please enter a 4-digit PIN')
      setLoading(false)
      return
    }

    if (confirmPinString.length !== 4) {
      setError('Please confirm your PIN')
      setLoading(false)
      return
    }

    if (pinString !== confirmPinString) {
      setError('PINs do not match. Please try again.')
      setConfirmPin(['', '', '', ''])
      setCurrentStep('pin')
      setLoading(false)
      if (confirmInputRefs.current[0]) {
        confirmInputRefs.current[0].focus()
      }
      return
    }

    try {
      const res = await fetch('/api/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinString, confirmPin: confirmPinString })
      })

      const json = await res.json()

      if (!json.success) {
        throw new Error(json.message || 'Failed to set PIN')
      }

      setSuccess(true)
      
      // Redirect after short delay
      // Use replace to prevent back button from going to setup page
      setTimeout(() => {
        router.replace(redirectTo)
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to set PIN. Please try again.')
      setPin(['', '', '', ''])
      setConfirmPin(['', '', '', ''])
      setCurrentStep('pin')
      setLoading(false)
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus()
      }
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
          <CardTitle className="text-2xl font-bold">Set Up Your PIN</CardTitle>
          <CardDescription>
            {currentStep === 'pin' 
              ? 'Enter a 4-digit PIN to secure your account'
              : 'Confirm your PIN to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 p-4 rounded">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="ml-3 text-sm text-red-700 dark:text-red-300">{error}</p>
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
                    className="w-16 h-16 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
              <strong>Security Tips:</strong>
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
              <li>Choose a PIN that's easy for you to remember but hard for others to guess</li>
              <li>Don't use common PINs like 0000, 1234, or your birth year</li>
              <li>Your PIN is encrypted and stored securely</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

