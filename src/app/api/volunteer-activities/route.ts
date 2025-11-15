import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VolunteerActivityCreateSchema = z.object({
  volunteer_user_id: z.string(),
  incident_id: z.string(),
  participated: z.coerce.boolean().optional(),
  notes: z.string().optional()
})

const VolunteerActivityUpdateSchema = z.object({
  activity_id: z.string(),
  participated: z.coerce.boolean().optional(),
  notes: z.string().optional(),
  resolved_at: z.string().optional()
})

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'volunteer-activities:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const volunteer_user_id = searchParams.get('volunteer_user_id')
    const incident_id = searchParams.get('incident_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('volunteeractivities')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (volunteer_user_id) {
      query = query.eq('volunteer_user_id', volunteer_user_id)
    }

    if (incident_id) {
      query = query.eq('incident_id', incident_id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch volunteer activities' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'volunteer-activities:post'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = VolunteerActivityCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('volunteeractivities')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create volunteer activity' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'volunteer-activities:put'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = VolunteerActivityUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { activity_id, ...updateData } = parsed.data

    const { data, error } = await supabase
      .from('volunteeractivities')
      .update(updateData)
      .eq('activity_id', activity_id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to update volunteer activity' }, { status: 500 })
  }
}

