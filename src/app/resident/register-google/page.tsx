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
  const [success, setSuccess] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [touched, setTouched] = useState<{ first?: boolean; last?: boolean; address?: boolean; phone?: boolean; barangay?: boolean }>({})
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // 🔠 Auto-uppercase function
  const toCaps = (s: string) => s.toUpperCase()

  // Validation
  const firstValid = firstName.trim().length > 0
  const lastValid = lastName.trim().length > 0
  const addressValid = address.trim().length > 0
  const phoneValid = /^09\d{9}$/.test(phoneNumber)

  // ✅ Load Google session email
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
          'Zone 1','Zone 2','Zone 3','Zone 4','Zone 5',
          'Zone 6','Zone 7','Zone 8','Zone 9','Zone 10',
          'Concepcion','Cabatangan','Matab-ang','Bubog',
          'Dos Hermanas','Efigenio Lizares','Katilingban'
        ])
      }
    }
    fetchBarangays()
  }, [])

  // Submit handler
  const handleSubmitClick = () => {
    setTouched({ first: true, last: true, address: true, phone: true, barangay: true })

    if (!firstValid || !lastValid || !addressValid || !phoneValid || !barangay) {
      setError('Please complete all required fields correctly.')
      return
    }

    if (!termsAccepted) {
      setShowTermsModal(true)
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
      if (!res.ok || !json.success) throw new Error(json?.message || 'Failed to save profile')

      setSuccess('Profile saved. Redirecting...')

      const userId = session?.user?.id
      if (userId) clearUserCache(userId)

      refreshUser().catch(err => console.warn("Failed to refresh auth state:", err))
      router.replace('/resident/dashboard')
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout allowedRoles={[]}>
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Complete Your Resident Profile
        </h1>

        <Card className="p-4 space-y-4">
          {error && <div className="bg-red-50 border-l-4 border-red-500 text-sm text-red-700 p-3">{error}</div>}
          {success && <div className="bg-green-50 border-l-4 border-green-500 text-sm text-green-700 p-3">{success}</div>}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Email</label>
            <Input value={email} disabled readOnly />
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">First Name</label>
              <Input
                value={firstName}
                onChange={e => setFirstName(toCaps(e.target.value))}
                onBlur={() => setTouched(prev => ({ ...prev, first: true }))}
                required
              />
              {touched.first && !firstValid && <p className="text-xs text-red-600 mt-1">First name is required.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Last Name</label>
              <Input
                value={lastName}
                onChange={e => setLastName(toCaps(e.target.value))}
                onBlur={() => setTouched(prev => ({ ...prev, last: true }))}
                required
              />
              {touched.last && !lastValid && <p className="text-xs text-red-600 mt-1">Last name is required.</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Mobile Number</label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={phoneNumber}
              placeholder="09XXXXXXXXX"
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '')
                setPhoneNumber(digits)
                setPhoneError(digits && !/^09\d{9}$/.test(digits) ? 'Mobile number must be 11 digits and start with 09.' : null)
              }}
              onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
              required
            />
            {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Street Address</label>
            <Input
              value={address}
              onChange={e => setAddress(toCaps(e.target.value))}
              onBlur={() => setTouched(prev => ({ ...prev, address: true }))}
              required
            />
            {touched.address && !addressValid && <p className="text-xs text-red-600 mt-1">Street address is required.</p>}
          </div>

          {/* Barangay */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Barangay</label>
            <select
              value={barangay}
              onChange={e => setBarangay(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, barangay: true }))}
              className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-red-500 focus:border-red-500"
              required
            >
              <option value="">Select Barangay</option>
              {barangays.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {touched.barangay && !barangay && <p className="text-xs text-red-600 mt-1">Please select a barangay.</p>}
          </div>

          {/* Buttons */}
          <div className="pt-2 space-y-3">
            {!termsAccepted && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTermsModal(true)}
                className="w-full border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700"
              >
                Read Terms & Privacy Policy
              </Button>
            )}
            <Button
              onClick={handleSubmitClick}
              disabled={loading || !email || !barangay || !firstValid || !lastValid || !addressValid || !!phoneError || !termsAccepted}
              className="w-full text-white dark:text-white"
            >
              {loading ? 'Saving...' : termsAccepted ? 'Save and Continue' : 'Please Accept Terms First'}
            </Button>
          </div>
        </Card>
      </div>

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => { setTermsAccepted(true); setShowTermsModal(false); setError(null) }}
        requireAcceptance
      />
    </AuthLayout>
  )
}
