import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'
import webpush from 'web-push'
import { Database } from '@/types/supabase'

type ScheduleRow = Database['public']['Tables']['schedules']['Row']
type ScheduleInsert = Database['public']['Tables']['schedules']['Insert']
type ScheduleUpdate = Database['public']['Tables']['schedules']['Update']

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const url = new URL(req.url)
    const volunteerId = url.searchParams.get('volunteer_id')

    let query = supabaseAdmin
      .from('schedules')
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email
        ),
        creator:users!schedules_created_by_fkey (
          id, first_name, last_name
        )
      `)
      .order('start_time', { ascending: true })

    if (volunteerId) {
      query = query.eq('volunteer_id', volunteerId)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal error' }, { status: 500 })
  }
}

function configureWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL || process.env.WEB_PUSH_CONTACT || 'mailto:admin@rvois.talisaycity.gov.ph'
  if (pub && priv) {
    try { 
      webpush.setVapidDetails(vapidEmail, pub, priv)
      console.log('[schedules] VAPID configured for schedule notifications')
    } catch (error: any) {
      console.error('[schedules] Failed to configure VAPID:', error.message)
    }
  }
  return Boolean(pub && priv)
}

async function sendPushToUser(userId: string, payload: any) {
  try {
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, subscription')
      .eq('user_id', userId)
    if (error || !subs?.length) return
    const configured = configureWebPush()
    if (!configured) return
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          const subscription = s.subscription as unknown as webpush.PushSubscription
          await webpush.sendNotification(subscription, JSON.stringify(payload))
        } catch { }
      })
    )
  } catch { }
}

export async function POST(req: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const { volunteer_id, title, description, start_time, end_time, location, barangay } = body || {}

    const payload: ScheduleInsert = {
      volunteer_id,
      title,
      description: description ?? null,
      start_time,
      end_time,
      location: location ?? null,
      barangay: barangay ?? null,
      created_by: uid,
    }

    const { data, error } = await supabaseAdmin
      .from('schedules')
      .insert(payload)
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email, phone_number
        ),
        creator:users!schedules_created_by_fkey (
          id, first_name, last_name
        )
      `)
      .single()

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    // Fire-and-forget push notification to assigned volunteer
    const url = '/volunteer/schedules'
    await sendPushToUser(volunteer_id, {
      title: 'New Scheduled Activity',
      body: `${title} • ${new Date(start_time).toLocaleString()} - ${new Date(end_time).toLocaleString()}`,
      url,
    })

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updates } = body || {}
    if (!id) return NextResponse.json({ success: false, message: 'Missing schedule id' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('schedules')
      .update(updates as ScheduleUpdate)
      .eq('id', id)
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email, phone_number
        ),
        creator:users!schedules_created_by_fkey (
          id, first_name, last_name
        )
      `)
      .single()

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    // Notify volunteer about schedule update if volunteer_id present in updates or returned row
    const volunteerId = (updates as ScheduleUpdate)?.volunteer_id || (data as unknown as ScheduleRow)?.volunteer_id
    if (volunteerId) {
      const scheduleData = data as unknown as ScheduleRow
      await sendPushToUser(volunteerId, {
        title: 'Schedule Updated',
        body: `${scheduleData?.title || 'Activity'} • ${new Date(scheduleData?.start_time).toLocaleString()} - ${new Date(scheduleData?.end_time).toLocaleString()}`,
        url: '/volunteer/schedules',
      })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 })

    const { error } = await supabaseAdmin.from('schedules').delete().eq('id', id)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Internal error' }, { status: 500 })
  }
}
