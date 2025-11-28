import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    // Use service role to avoid RLS timeouts, but enforce volunteer_id = uid at API layer
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data, error } = await admin
      .from('schedules')
      .select(`
        *,
        creator:users!schedules_created_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .eq('volunteer_id', uid)
      .order('start_time', { ascending: true })

    if (error) return NextResponse.json({ success: false, message: error.message, data: [] }, { status: 400 })

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch schedules', data: [] }, { status: 500 })
  }
}

// Accept or decline a schedule
export async function PATCH(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const body = await request.json()
    const { schedule_id, accept } = body

    if (!schedule_id || typeof accept !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Missing schedule_id or accept status' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Verify the schedule belongs to this volunteer
    const { data: schedule, error: checkError } = await admin
      .from('schedules')
      .select('id, volunteer_id')
      .eq('id', schedule_id)
      .eq('volunteer_id', uid)
      .single()

    if (checkError || !schedule) {
      return NextResponse.json({ success: false, message: 'Schedule not found or access denied' }, { status: 404 })
    }

    // Update the schedule
    const { data: updated, error } = await admin
      .from('schedules')
      .update({
        is_accepted: accept,
        response_at: new Date().toISOString()
      })
      .eq('id', schedule_id)
      .select(`
        *,
        creator:users!schedules_created_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .single()

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to update schedule' }, { status: 500 })
  }
}