import { NextResponse } from 'next/server'
import { IncidentHandoffCreateSchema, IncidentHandoffUpdateSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { getServerSupabase } from '@/lib/supabase-server'

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_INTER_LGU_ENABLED === 'true'

const getClient = async () => await getServerSupabase()

export async function GET(request: Request) {
  try {
    const supabase = await getClient()
    if (!FEATURE_ENABLED) return NextResponse.json({ success: false, code: 'FEATURE_DISABLED', message: 'Inter-LGU disabled' }, { status: 404 })
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'handoffs:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const incidentId = searchParams.get('incident_id')
    let query = supabase.from('incident_handoffs').select('*').order('created_at', { ascending: false })
    if (incidentId) query = query.eq('incident_id', incidentId)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch handoffs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getClient()
    if (!FEATURE_ENABLED) return NextResponse.json({ success: false, message: 'Inter-LGU disabled' }, { status: 404 })
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'handoffs:post'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = IncidentHandoffCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })
    const { incident_id, from_lgu, to_lgu, notes, created_by } = parsed.data

    const { data, error } = await supabase
      .from('incident_handoffs')
      .insert({ incident_id, from_lgu, to_lgu, status: 'PENDING', notes: notes ?? null, created_by: created_by ?? null })
      .select()
      .single()

    if (error) throw error
    // record notification for target LGU admins
    try {
      const { notificationService } = await import('@/lib/notification-service')
      await notificationService.notifyAdmins({
        title: '🤝 Handoff Requested',
        body: `Incident ${incident_id} from ${from_lgu} to ${to_lgu}`,
        type: 'handoff_request',
        data: { incident_id, handoff_id: data.id, from_lgu, to_lgu, url: `/admin/handoffs/${data.id}` }
      })
    } catch (err) {
      console.error('Failed to enqueue handoff request notification:', err)
    }
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to create handoff' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getClient()
    if (!FEATURE_ENABLED) return NextResponse.json({ success: false, message: 'Inter-LGU disabled' }, { status: 404 })
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'handoffs:patch'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = IncidentHandoffUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })
    }
    const { id, status, notes } = parsed.data

    const { data: existing, error: readErr } = await supabase.from('incident_handoffs').select('*').eq('id', id).single()
    if (readErr) throw readErr

    const { data, error } = await supabase
      .from('incident_handoffs')
      .update({ status, notes: typeof notes === 'string' ? notes : existing?.notes })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // record notification for both sides
    try {
      const { notificationService } = await import('@/lib/notification-service')
      const title = status === 'ACCEPTED' ? '✅ Handoff Accepted'
        : status === 'REJECTED' ? '❌ Handoff Rejected'
        : status === 'COMPLETED' ? '🏁 Handoff Completed' : 'ℹ️ Handoff Updated'
      await notificationService.notifyAdmins({
        title,
        body: `Incident ${existing.incident_id}: ${existing.from_lgu} → ${existing.to_lgu} (${status})`,
        type: 'handoff_update',
        data: { incident_id: existing.incident_id, handoff_id: id, status, url: `/admin/handoffs/${id}` }
      })
    } catch (err) {
      console.error('Failed to enqueue handoff update notification:', err)
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to update handoff' }, { status: 500 })
  }
}


