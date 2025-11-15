import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await getServerSupabase()
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    // Use service role to bypass RLS but enforce assigned_to = uid at API level
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data, error } = await admin
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id, first_name, last_name, email, phone_number
        )
      `)
      .eq('assigned_to', uid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch incidents' }, { status: 500 })
  }
}
