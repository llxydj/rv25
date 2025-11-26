"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AuthLayout } from '@/components/layout/auth-layout'
import { useAuth as useAuthCtx } from '@/hooks/use-auth'
import { TermsModal } from '@/components/ui/terms-modal'
import { clearUserCache } from '@/lib/user-data-cache'
import { CheckCircle } from 'lucide-react'

export default function RegisterGoogleResidentPage() {
  const router = useRouter()
  const { refreshUser } = useAuthCtx()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [address, setAddress] = useState('')
  const [barangay, setBarangay] = useState('')
  const [barangays, setBarangays] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [touched, setTouched] = useState<{ first?: boolean; last?: boolean; address?: boolean; phone?: boolean; barangay?: boolean }>({})
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // 🔠 Auto-uppercase function
  const toCaps = (s: string) => s.toUpperCase()

  // Validation
  const firstValid = firstName.trim().length > 0
  const lastValid = lastName.trim().length > 0
  const addressValid = address.trim().length > 0
  const phoneValid = /^09\d{9}$/.test(phoneNumber)
  const allFieldsValid = firstValid && lastValid && addressValid && phoneValid && barangay && termsAccepted

  // Load Google session email
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setEmail(session?.user?.email || "")
    }
    load()
  }, [])

  // Fetch barangays
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch('/api/barangays')
        const json = await res.json()
        const names = (Array.isArray(json?.data) ? json.data : []).map((b: any) => b?.name).filter(Boolean)
        setBarangays(names)
      } catch {
        setBarangays([
          'ZONE 1', 'ZONE 2', 'ZONE 3', 'ZONE 4', 'ZONE 5',
          'ZONE 6', 'ZONE 7', 'ZONE 8', 'ZONE 9', 'ZONE 10',
          'ZONE 11', 'ZONE 12', 'ZONE 13', 'ZONE 14', 'ZONE 15',
          'ZONE 16', 'ZONE 17', 'ZONE 18', 'ZONE 19', 'ZONE 20',
          'CONCEPCION', 'CABATANGAN', 'MATAB-ANG', 'BUBOG',
          'DOS HERMANAS', 'EFIGENIO LIZARES', 'KATILINGBAN'
        ])
      }
    }
    fetchBarangays()
  }, [])

  // Submit handler
  const handleSubmitClick = () => {
    setTouched({ first: true, last: true, address: true, phone: true, barangay: true })
    
    if (!allFieldsValid) {
      setError('Please complete all required fields correctly and accept terms.')
      return
    }
    
    submit()
  }

  // API submission
  const submit = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/resident/register-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phoneNumber,
          address,
          barangay,
        })
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json?.message || 'Failed to save profile')
      }

      // Show success modal
      setShowSuccessModal(true)

      // Clear cache and refresh auth
      const userId = session?.user?.id
      if (userId) clearUserCache(userId)
      
      try {
        await refreshUser()
      } catch (err) {
        console.warn("Failed to refresh auth state:", err)
      }

      // Auto-redirect after 2 seconds if user doesn't click
      setTimeout(() => {
        if (showSuccessModal) {
          router.replace('/resident/dashboard')
        }
      }, 2000)

    } catch (e: any) {
      setError(e?.message || 'Failed to save profile')
      setLoading(false)
    }
  }

  return (
    <AuthLayout allowedRoles={[]}>
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Complete Your Resident Profile
        </h1>

        <Card className="p-4 space-y-4 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-sm text-red-700 dark:text-red-400 p-3 rounded">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
            <Input value={email} disabled readOnly className="bg-gray-100 dark:bg-gray-700" />
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">First Name *</label>
              <Input
                value={firstName}
                onChange={e => setFirstName(toCaps(e.target.value))}
                onBlur={() => setTouched(prev => ({ ...prev, first: true }))}
                placeholder="JUAN"
                required
              />
              {touched.first && !firstValid && <p className="text-xs text-red-600 dark:text-red-400 mt-1">First name is required.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Last Name *</label>
              <Input
                value={lastName}
                onChange={e => setLastName(toCaps(e.target.value))}
                onBlur={() => setTouched(prev => ({ ...prev, last: true }))}
                placeholder="DELA CRUZ"
                required
              />
              {touched.last && !lastValid && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Last name is required.</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Mobile Number *</label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={phoneNumber}
              placeholder="09XXXXXXXXX"
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '')
                setPhoneNumber(digits)
                setPhoneError(digits && !/^09\d{9}$/.test(digits) ? 'Must be 11 digits starting with 09.' : null)
              }}
              onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
              required
            />
            {phoneError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{phoneError}</p>}
            {touched.phone && !phoneValid && !phoneError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Valid mobile number required.</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Street Address *</label>
            <Input
              value={address}
              onChange={e => setAddress(toCaps(e.target.value))}
              onBlur={() => setTouched(prev => ({ ...prev, address: true }))}
              placeholder="123 MAIN STREET"
              required
            />
            {touched.address && !addressValid && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Street address is required.</p>}
          </div>

          {/* Barangay */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Barangay *</label>
            <select
              value={barangay}
              onChange={e => setBarangay(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, barangay: true }))}
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-red-500 focus:border-red-500"
              required
            >
              <option value="">Select Barangay</option>
              {barangays.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {touched.barangay && !barangay && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Please select a barangay.</p>}
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-3 py-2">
            <input
              type="checkbox"
              id="terms-agree"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="terms-agree" className="text-sm text-gray-700 dark:text-gray-300">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium underline"
              >
                terms and conditions
              </button>
              {' *'}
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-2 space-y-3">
            <Button
              onClick={handleSubmitClick}
              disabled={loading || !allFieldsValid}
              className="w-full text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save and Continue'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Terms Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setTermsAccepted(true)
          setShowTermsModal(false)
          setError(null)
        }}
        requireAcceptance
      />

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-sm w-full text-center space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Registration Successful!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Your resident profile has been saved successfully. Redirecting to your dashboard...
            </p>
            <Button
              onClick={() => {
                setShowSuccessModal(false)
                router.replace('/resident/dashboard')
              }}
              className="w-full text-white bg-red-600 hover:bg-red-700"
            >
              Continue to Dashboard
            </Button>
          </div>
        </div>
      )}
    </AuthLayout>
  )
}