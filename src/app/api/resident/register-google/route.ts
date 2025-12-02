import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

function toSentenceCase(s?: string | null) {
  try {
    const lower = (s || '').toLowerCase()
    return lower.replace(/(^\w|[\.\!\?]\s+\w)/g, (c) => c.toUpperCase())
  } catch {
    return s || null
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()

    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const Schema = z.object({
      firstName: z.string().trim().min(1, 'First name is required'),
      lastName: z.string().trim().min(1, 'Last name is required'),
      phoneNumber: z.string().trim().regex(/^09\d{9}$/,'Phone must be a valid PH mobile number (09XXXXXXXXX)'),
      address: z.string().trim().min(1, 'Address is required'),
      barangay: z.string().trim().min(1, 'Barangay is required'),
    })
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })
    }
    const { firstName, lastName, phoneNumber, address, barangay } = parsed.data

    // Upsert users profile as resident
    const { data: existing, error: readErr } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()
    if (readErr) {
      // Non-fatal for missing row
      console.warn("Read existing user warning:", readErr)
    }

    const payload: any = {
      id: user.id,
      email: user.email,
      role: 'resident',
      first_name: toSentenceCase(firstName) || null,
      last_name: toSentenceCase(lastName) || null,
      phone_number: phoneNumber || null,
      address: toSentenceCase(address) || null,
      barangay: toSentenceCase(barangay) || null,
      city: 'Talisay City',
      province: 'Negros Occidental',
      pin_enabled: false, // PIN disabled for residents - no PIN required
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error("Error upserting user:", error)
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error("Error in resident registration:", e)
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to register resident' }, { status: 500 })
  }
}