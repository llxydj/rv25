import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'
import webpush from 'web-push'
import { Database } from '@/types/supabase'
import { smsService } from '@/lib/sms-service'
import { ScheduleCreateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

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
    if (error) {
      console.error('[admin-schedules] Query error:', error)
      return NextResponse.json({ success: false, message: error.message, error: error.code }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    console.error('[admin-schedules] Unexpected error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Internal error', stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined }, { status: 500 })
  }
}

function configureWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const contact = process.env.WEB_PUSH_CONTACT || 'mailto:admin@example.com'
  if (pub && priv) {
    try { webpush.setVapidDetails(contact, pub, priv) } catch { }
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
    
    // Validate input
    const parsed = ScheduleCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { volunteer_id, volunteer_ids, title, description, start_time, end_time, location, barangay } = parsed.data

    // Support both single volunteer_id and bulk volunteer_ids
    const volunteerIds = volunteer_ids && Array.isArray(volunteer_ids) && volunteer_ids.length > 0
      ? volunteer_ids
      : volunteer_id
        ? [volunteer_id]
        : []

    if (volunteerIds.length === 0) {
      return NextResponse.json({ success: false, message: 'At least one volunteer must be selected' }, { status: 400 })
    }

    // Create schedules for all selected volunteers
    const schedulesToInsert = volunteerIds.map((vid: string) => ({
      volunteer_id: vid,
      title,
      description: description ?? null,
      start_time,
      end_time,
      location: location ?? null,
      barangay: barangay ?? null,
      created_by: uid,
    }))

    const { data: insertedSchedules, error } = await supabaseAdmin
      .from('schedules')
      .insert(schedulesToInsert)
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email, phone_number
        ),
        creator:users!schedules_created_by_fkey (
          id, first_name, last_name
        )
      `)

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    // Return response immediately - don't wait for notifications
    const data = insertedSchedules.length === 1 ? insertedSchedules[0] : insertedSchedules
    const response = NextResponse.json({ success: true, data, count: insertedSchedules.length })

    // Send notifications in background (fire-and-forget) - don't await
    const url = '/volunteer/schedules'
    const scheduleDetails = `${title}${location ? ` at ${location}` : ''}${barangay ? `, ${barangay}` : ''}`
    const timeRange = `${new Date(start_time).toLocaleString()} - ${new Date(end_time).toLocaleString()}`

    // Fire-and-forget notifications - run in background without blocking response
    Promise.allSettled(
      insertedSchedules.map(async (schedule: any) => {
        const volunteer = schedule.volunteer
        if (!volunteer) return

        try {
          // Push notification
          await sendPushToUser(volunteer.id, {
            title: 'New Scheduled Activity',
            body: `${scheduleDetails} • ${timeRange}`,
            url,
          })
        } catch (pushErr) {
          console.error('Failed to send push notification for schedule:', pushErr)
        }

        // SMS notification
        if (volunteer.phone_number) {
          try {
            const scheduleDate = new Date(start_time).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })
            const scheduleTime = `${new Date(start_time).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })} - ${new Date(end_time).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}`
            const locationText = location ? ` at ${location}` : (barangay ? ` in ${barangay}` : '')

            await smsService.sendSMS(
              volunteer.phone_number,
              'TEMPLATE_SCHEDULE_ASSIGN',
              {
                title: title,
                date: scheduleDate,
                time: scheduleTime,
                location: locationText
              },
              {
                incidentId: schedule.id, // Using schedule ID as reference
                referenceId: schedule.id.substring(0, 8).toUpperCase(),
                triggerSource: 'Schedule_Created',
                recipientUserId: volunteer.id
              }
            )
          } catch (smsErr) {
            console.error('Failed to send SMS for schedule:', smsErr)
          }
        }
      })
    ).catch(err => {
      console.error('Error in background notification sending:', err)
    })

    return response
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

    // Return response immediately
    const response = NextResponse.json({ success: true, data })

    // Notify volunteer about schedule update in background (fire-and-forget)
    const volunteerId = (updates as ScheduleUpdate)?.volunteer_id || (data as unknown as ScheduleRow)?.volunteer_id
    if (volunteerId) {
      const scheduleData = data as unknown as ScheduleRow
      sendPushToUser(volunteerId, {
        title: 'Schedule Updated',
        body: `${scheduleData?.title || 'Activity'} • ${new Date(scheduleData?.start_time).toLocaleString()} - ${new Date(scheduleData?.end_time).toLocaleString()}`,
        url: '/volunteer/schedules',
      }).catch(err => {
        console.error('Failed to send push notification for schedule update:', err)
      })
    }

    return response
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
