import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const IncidentUpdateCreateSchema = z.object({
  incident_id: z.string(),
  updated_by: z.string(),
  previous_status: z.enum(['PENDING', 'ASSIGNED', 'RESPONDING', 'RESOLVED', 'CANCELLED']).optional(),
  new_status: z.enum(['PENDING', 'ASSIGNED', 'RESPONDING', 'RESOLVED', 'CANCELLED']).optional(),
  notes: z.string().optional()
})

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'incident-updates:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const incident_id = searchParams.get('incident_id')
    const updated_by = searchParams.get('updated_by')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('incident_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (incident_id) {
      query = query.eq('incident_id', incident_id)
    }

    if (updated_by) {
      query = query.eq('updated_by', updated_by)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch incident updates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'incident-updates:post'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = IncidentUpdateCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('incident_updates')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create incident update' }, { status: 500 })
  }
}

