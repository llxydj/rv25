import { NextResponse } from 'next/server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase-server'

// Supabase client is created per-request in handlers using getServerSupabase()

const ScheduledActivityCreateSchema = z.object({
  volunteer_user_id: z.string(),
  created_by: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  date: z.string(),
  time: z.string().optional(),
  location: z.string().optional()
})

const ScheduledActivityUpdateSchema = z.object({
  schedule_id: z.string(),
  is_accepted: z.coerce.boolean().optional(),
  response_at: z.string().optional()
})

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'scheduled-activities:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const { searchParams } = new URL(request.url)
    const volunteer_user_id = searchParams.get('volunteer_user_id')
    const created_by = searchParams.get('created_by')
    const is_accepted = searchParams.get('is_accepted')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('scheduledactivities')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (volunteer_user_id) {
      query = query.eq('volunteer_user_id', volunteer_user_id)
    }

    if (created_by) {
      query = query.eq('created_by', created_by)
    }

    if (is_accepted !== null) {
      query = query.eq('is_accepted', is_accepted === 'true')
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch scheduled activities' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'scheduled-activities:post'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const parsed = ScheduledActivityCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const payload = parsed.data

    // Basic conflict detection: same volunteer & same date and time
    if (payload.date) {
      let conflictQuery = supabase
        .from('scheduledactivities')
        .select('schedule_id')
        .eq('volunteer_user_id', payload.volunteer_user_id)
        .eq('date', payload.date)

      if (payload.time) {
        conflictQuery = conflictQuery.eq('time', payload.time)
      }

      const { data: conflicts, error: conflictErr } = await conflictQuery.limit(1)
      if (conflictErr) throw conflictErr
      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({ success: false, code: 'SCHEDULE_CONFLICT', message: 'Schedule conflicts with an existing entry' }, { status: 409 })
      }
    }

    const { data, error } = await supabase
      .from('scheduledactivities')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    // Fire-and-forget notification for the volunteer (best-effort)
    try {
      const { shouldNotify } = await import('@/lib/notifications-server')
      const notifyType = 'schedule_created'
      if (await shouldNotify(supabase as any, payload.volunteer_user_id, notifyType)) {
        await supabase
          .from('notifications')
          .insert({
            user_id: payload.volunteer_user_id,
            title: 'New Schedule Assigned',
            body: `${payload.title} on ${payload.date}${payload.time ? ' at ' + payload.time : ''}`,
            type: notifyType,
            data: { schedule_id: (data as any)?.schedule_id }
          })
      }
      // Also notify creator if different
      if (payload.created_by && payload.created_by !== payload.volunteer_user_id) {
        if (await shouldNotify(supabase as any, payload.created_by, notifyType)) {
          await supabase
            .from('notifications')
            .insert({
              user_id: payload.created_by,
              title: 'Schedule Created',
              body: `Created schedule for volunteer on ${payload.date}${payload.time ? ' at ' + payload.time : ''}`,
              type: notifyType,
              data: { schedule_id: (data as any)?.schedule_id }
            })
        }
      }
    } catch { /* ignore notification errors */ }
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create scheduled activity' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'scheduled-activities:put'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const parsed = ScheduledActivityUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { schedule_id, ...updateData } = parsed.data

    const { data, error } = await supabase
      .from('scheduledactivities')
      .update(updateData)
      .eq('schedule_id', schedule_id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to update scheduled activity' }, { status: 500 })
  }
}

