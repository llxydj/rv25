"use client"

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AuthLayout } from '@/components/layout/auth-layout'
import { useAuth as useAuthCtx } from '@/hooks/use-auth'
import { TermsModal } from '@/components/ui/terms-modal'
import { AlertCircle } from 'lucide-react'

export default function RegisterGoogleResidentPage() {
  const router = useRouter()
  const { refreshSession } = useAuthCtx()
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
  const [touched, setTouched] = useState<{first?: boolean; last?: boolean; address?: boolean; phone?: boolean; barangay?: boolean}>({})
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // ✅ Sentence case utility
  const toSentenceCase = (s: string) => {
    if (!s) return ''
    return s
      .toLowerCase()
      .replace(/(^\s*\w|[\.\!\?]\s+\w)/g, (c) => c.toUpperCase())
  }

  const normalizedFirstName = useMemo(() => toSentenceCase(firstName), [firstName])
  const normalizedLastName = useMemo(() => toSentenceCase(lastName), [lastName])
  const normalizedAddress = useMemo(() => toSentenceCase(address), [address])

  const firstValid = normalizedFirstName.trim().length > 0
  const lastValid = normalizedLastName.trim().length > 0
  const addressValid = normalizedAddress.trim().length > 0
  const phoneValid = /^09\d{9}$/.test(phoneNumber)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const sEmail = session?.user?.email || ''
      setEmail(sEmail)
      if (!sEmail) router.replace('/login')
    }
    load()
  }, [router])

  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch('/api/barangays')
        const json = await res.json()
        const names = (Array.isArray(json?.data) ? json.data : []).map((b: any) => b?.name).filter(Boolean)
        setBarangays(names)
      } catch {
        setBarangays([
          'Zone 1','Zone 2','Zone 3','Zone 4','Zone 5','Zone 6','Zone 7','Zone 8','Zone 9','Zone 10',
          'Concepcion','Cabatangan','Matab-ang','Bubog','Dos Hermanas','Efigenio Lizares','Katilingban'
        ])
      }
    }
    fetchBarangays()
  }, [])

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
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phoneNumber,
          address: normalizedAddress,
          barangay: toSentenceCase(barangay),
        })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.message || 'Failed to save profile')
      setSuccess('Profile saved. Redirecting...')
      await refreshSession()
      // Immediately redirect to dashboard without waiting for role update
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
        <h1 className="text-2xl font-semibold">Complete Your Resident Profile</h1>
        <Card className="p-4 space-y-3">
          {error && <div className="bg-red-50 border-l-4 border-red-500 text-sm text-red-700 p-3">{error}</div>}
          {success && <div className="bg-green-50 border-l-4 border-green-500 text-sm text-green-700 p-3">{success}</div>}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input value={email} disabled readOnly />
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <Input
                value={firstName}
                onChange={(e)=>setFirstName(toSentenceCase(e.target.value))}
                onBlur={()=> setTouched(prev=>({ ...prev, first: true }))}
                required
              />
              {touched.first && !firstValid && <p className="text-xs text-red-600 mt-1">First name is required.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <Input
                value={lastName}
                onChange={(e)=>setLastName(toSentenceCase(e.target.value))}
                onBlur={()=> setTouched(prev=>({ ...prev, last: true }))}
                required
              />
              {touched.last && !lastValid && <p className="text-xs text-red-600 mt-1">Last name is required.</p>}
            </div>
          </div>

          {/* ✅ Phone Number Field */}
          <div>
            <label className="block text-sm font-medium mb-1">Mobile Number</label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={phoneNumber}
              placeholder="09XXXXXXXXX"
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '')
                setPhoneNumber(digitsOnly)
                if (digitsOnly && !/^09\d{9}$/.test(digitsOnly)) {
                  setPhoneError('Mobile number must be 11 digits and start with 09.')
                } else {
                  setPhoneError(null)
                }
              }}
              onBlur={()=> setTouched(prev=>({ ...prev, phone: true }))}
              required
            />
            {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
          </div>

          {/* ✅ Street Field with sentence case */}
          <div>
            <label className="block text-sm font-medium mb-1">Street Address</label>
            <Input
              value={address}
              onChange={(e)=>setAddress(toSentenceCase(e.target.value))}
              onBlur={()=> setTouched(prev=>({ ...prev, address: true }))}
              required
            />
            {touched.address && !addressValid && <p className="text-xs text-red-600 mt-1">Street address is required.</p>}
          </div>

          {/* Barangay */}
          <div>
            <label className="block text-sm font-medium mb-1">Barangay</label>
            <select
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500"
              onBlur={()=> setTouched(prev=>({ ...prev, barangay: true }))}
              required
            >
              <option value="">Select Barangay</option>
              {barangays.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {touched.barangay && !barangay && <p className="text-xs text-red-600 mt-1">Please select a barangay.</p>}
          </div>

          {/* Buttons */}
          <div className="pt-2 space-y-3">
            {!termsAccepted && (
              <Button type="button" variant="outline" onClick={() => setShowTermsModal(true)} className="w-full border-red-600 text-red-600 hover:bg-red-50">
                Read Terms & Privacy Policy
              </Button>
            )}
            <Button
              onClick={handleSubmitClick}
              disabled={loading || !email || !barangay || !firstValid || !lastValid || !addressValid || !!phoneError || !termsAccepted}
              className="w-full"
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
