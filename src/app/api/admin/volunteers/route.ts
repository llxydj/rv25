import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const Schema = z.object({
      adminId: z.string().uuid(),
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      barangay: z.string().optional().nullable(),
    })
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', issues: parsed.error.flatten() }, { status: 400 })
    }
    const { adminId, email, password, firstName, lastName, phone, address, barangay } = parsed.data

    const toSentenceCase = (s?: string | null) => {
      try { const lower = (s || '').toLowerCase(); return lower.replace(/(^\w|[\.\!\?]\s+\w)/g, (c) => c.toUpperCase()) } catch { return s || null }
    }

    // Check if admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", adminId)
      .single()

    if (adminError) {
      return NextResponse.json({ success: false, message: "Error verifying admin status" }, { status: 401 })
    }

    if (adminData.role !== "admin") {
      return NextResponse.json({ success: false, message: "Only admins can create volunteer accounts" }, { status: 403 })
    }

    // Idempotent behavior: if a user with this email already exists, reuse it
    // 1) Try to find existing users row
    const { data: existingUserRow } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .ilike('email', email)
      .maybeSingle()

    let userId = existingUserRow?.id as string | undefined

    // 2) If no users row, try to create auth user; if already exists in auth, locate it and then create users row
    if (!userId) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'volunteer', created_by: adminId, created_at: new Date().toISOString() },
      })

      if (authError) {
        // If email already registered, find the auth user via listUsers and reuse
        if (authError.message?.toLowerCase?.().includes('already') || authError.status === 422) {
          try {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
            const found = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
            if (!found) return NextResponse.json({ success: false, message: 'User already exists but could not be looked up.' }, { status: 400 })
            userId = found.id
          } catch (e: any) {
            return NextResponse.json({ success: false, message: 'User already exists and lookup failed' }, { status: 400 })
          }
        } else {
          return NextResponse.json({ success: false, message: authError.message }, { status: 400 })
        }
      } else {
        if (!authData?.user) return NextResponse.json({ success: false, message: 'Failed to create user account' }, { status: 400 })
        userId = authData.user.id
        // Ensure app_metadata.role
        try { await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { role: 'volunteer' } }) } catch {}
      }
    }

    // Upsert users row with volunteer role
    const payload = {
      id: userId!,
      email,
      first_name: toSentenceCase(firstName),
      last_name: toSentenceCase(lastName),
      role: 'volunteer',
      phone_number: phone || null,
      address: toSentenceCase(address || undefined),
      barangay: toSentenceCase(barangay || undefined),
      city: 'Talisay City',
      province: 'Negros Occidental',
      updated_at: new Date().toISOString(),
    } as any

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()
    if (userError) return NextResponse.json({ success: false, message: userError.message }, { status: 400 })

    // Ensure volunteer_profiles exists
    const { data: existingProfile } = await supabaseAdmin
      .from('volunteer_profiles')
      .select('volunteer_user_id')
      .eq('volunteer_user_id', userId!)
      .maybeSingle()
    if (!existingProfile) {
      const now = new Date().toISOString()
      const { error: profErr } = await supabaseAdmin
        .from('volunteer_profiles')
        .insert({
          volunteer_user_id: userId!,
          admin_user_id: adminId,
          status: 'INACTIVE',
          is_available: false,
          skills: [],
          availability: [],
          assigned_barangays: [],
          total_incidents_resolved: 0,
          created_at: now,
          updated_at: now,
          last_status_change: now,
          last_status_changed_by: adminId,
        })
      if (profErr) {
        // Not fatal for return, but report
        console.warn('Failed to create volunteer_profiles:', profErr.message)
      }
    }

    return NextResponse.json({ success: true, data: userData, message: 'Volunteer ensured with profile' })
  } catch (error: any) {
    console.error("Error creating volunteer:", error)
    return NextResponse.json(
      { success: false, message: error.message || "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Use service role client for data fetch to avoid RLS gaps
    const { data: volunteers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('role', 'volunteer')

    if (usersError) throw usersError

    const ids = (volunteers || []).map(v => v.id)
    let profiles: any[] = []
    if (ids.length) {
      const { data: profs, error: profErr } = await supabaseAdmin
        .from('volunteer_profiles')
        .select('*')
        .in('volunteer_user_id', ids)
      if (profErr) throw profErr
      profiles = profs || []
    }

    const merged = (volunteers || []).map(u => {
      const p = profiles.find(pr => pr.volunteer_user_id === u.id) || null
      return {
        ...u,
        role: 'volunteer',
        volunteer_profiles: p ? {
          ...p,
          is_available: p.is_available === true || p.is_available === 'true',
          skills: Array.isArray(p.skills) ? p.skills : [],
          availability: Array.isArray(p.availability) ? p.availability : [],
          assigned_barangays: Array.isArray(p.assigned_barangays) ? p.assigned_barangays : [],
        } : null,
      }
    })

    const url = new URL(request.url)
    const debug = url.searchParams.get('debug') === '1'
    if (debug) {
      return NextResponse.json({
        success: true,
        data: merged,
        meta: {
          requester_role: roleRow?.role || null,
          volunteers_count: volunteers?.length || 0,
          profiles_count: profiles?.length || 0,
        }
      })
    }

    return NextResponse.json({ success: true, data: merged })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch volunteers' }, { status: 500 })
  }
}