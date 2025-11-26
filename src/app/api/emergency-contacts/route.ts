import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EmergencyContactCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  number: z.string().min(1, 'Number is required'),
  type: z.enum(['emergency', 'fire', 'police', 'medical', 'disaster', 'admin', 'utility']),
  priority: z.number().min(1).max(10).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional()
})

const EmergencyContactUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  number: z.string().min(1).optional(),
  type: z.enum(['emergency', 'fire', 'police', 'medical', 'disaster', 'admin', 'utility']).optional(),
  priority: z.number().min(1).max(10).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional()
})

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'emergency-contacts:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const is_active = searchParams.get('is_active')

    let query = supabase.from('emergency_contacts').select('*').order('priority', { ascending: true })

    if (type) {
      query = query.eq('type', type)
    }

    if (is_active !== null) {
      query = query.eq('is_active', is_active === 'true')
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch emergency contacts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'emergency-contacts:post'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = EmergencyContactCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create emergency contact' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'emergency-contacts:put'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = EmergencyContactUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { id, ...updateData } = parsed.data

    const { data, error } = await supabase
      .from('emergency_contacts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to update emergency contact' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'emergency-contacts:delete'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 })

    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to delete emergency contact' }, { status: 500 })
  }
}

