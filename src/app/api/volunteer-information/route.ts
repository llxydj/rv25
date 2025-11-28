import { NextResponse } from 'next/server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const VolunteerInformationSchema = z.object({
  user_id: z.string(),
  joined_date: z.string().optional(),
  last_activity: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  bio: z.string().optional(),
  skills: z.string().optional(),
  documents: z.string().optional(),
  verified: z.coerce.boolean().optional()
})

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'volunteer-information:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const is_active = searchParams.get('is_active')
    const verified = searchParams.get('verified')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('volunteer_information')
      .select('*')
      .order('joined_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    if (is_active !== null) {
      query = query.eq('is_active', is_active === 'true')
    }

    if (verified !== null) {
      query = query.eq('verified', verified === 'true')
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch volunteer information' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'volunteer-information:post'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const parsed = VolunteerInformationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('volunteer_information')
      .upsert(parsed.data, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    // Notify admins on verification triggers (best-effort)
    try {
      const { data: existing } = await supabase
        .from('volunteer_information')
        .select('*')
        .eq('user_id', parsed.data.user_id)
        .single()
      const prevVerified = existing?.verified ?? false
      const nextVerified = (data as any)?.verified ?? false
      const changedWhileUnverified = (!nextVerified) && (
        (existing?.bio !== (data as any)?.bio) ||
        (existing?.skills !== (data as any)?.skills) ||
        (existing?.documents !== (data as any)?.documents)
      )

      const shouldFire = (prevVerified === false && nextVerified === true) || changedWhileUnverified
      if (shouldFire) {
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')

        if (admins && admins.length > 0) {
          const { shouldNotify } = await import('@/lib/notifications-server')
          for (const a of admins as any[]) {
            if (await shouldNotify(supabase as any, a.id, 'status_update')) {
              await supabase
                .from('notifications')
                .insert({
                  user_id: a.id,
                  title: nextVerified ? 'Volunteer Verified' : 'Volunteer Update Pending Review',
                  body: nextVerified ? 'A volunteer has been verified.' : 'A volunteer updated details while unverified.',
                  type: 'status_update',
                  data: { user_id: parsed.data.user_id }
                })
            }
          }
        }
      }
    } catch { /* ignore notification errors */ }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to save volunteer information' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'volunteer-information:put'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const parsed = VolunteerInformationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    // Load previous to compare triggers
    const { data: existing } = await supabase
      .from('volunteer_information')
      .select('*')
      .eq('user_id', parsed.data.user_id)
      .single()

    const { data, error } = await supabase
      .from('volunteer_information')
      .upsert(parsed.data, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    // Notifications
    try {
      const prevVerified = existing?.verified ?? false
      const nextVerified = (data as any)?.verified ?? false
      const changedWhileUnverified = (!nextVerified) && (
        (existing?.bio !== (data as any)?.bio) ||
        (existing?.skills !== (data as any)?.skills) ||
        (existing?.documents !== (data as any)?.documents)
      )
      const shouldFire = (prevVerified === false && nextVerified === true) || changedWhileUnverified
      if (shouldFire) {
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')

        if (admins && admins.length > 0) {
          const { shouldNotify } = await import('@/lib/notifications-server')
          for (const a of admins as any[]) {
            if (await shouldNotify(supabase as any, a.id, 'status_update')) {
              await supabase
                .from('notifications')
                .insert({
                  user_id: a.id,
                  title: nextVerified ? 'Volunteer Verified' : 'Volunteer Update Pending Review',
                  body: nextVerified ? 'A volunteer has been verified.' : 'A volunteer updated details while unverified.',
                  type: 'status_update',
                  data: { user_id: parsed.data.user_id }
                })
            }
          }
        }
      }
    } catch { /* ignore notification errors */ }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to update volunteer information' }, { status: 500 })
  }
}

