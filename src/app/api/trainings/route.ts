import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TrainingCreateSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    if (!FEATURE_ENABLED) return NextResponse.json({ success: false, message: 'Trainings disabled' }, { status: 404 })
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'trainings:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { data, error } = await supabase.from('trainings').select('*').order('start_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch trainings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!FEATURE_ENABLED) return NextResponse.json({ success: false, message: 'Trainings disabled' }, { status: 404 })
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'trainings:post'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = TrainingCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })
    const { title, description, start_at, end_at, location, created_by } = parsed.data

    const { data, error } = await supabase
      .from('trainings')
      .insert({ title, description: description ?? null, start_at, end_at: end_at ?? null, location: location ?? null, created_by: created_by ?? null })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create training' }, { status: 500 })
  }
}


