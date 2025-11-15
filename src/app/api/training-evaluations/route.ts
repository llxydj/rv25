import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TrainingEvaluationCreateSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    if (!FEATURE_ENABLED) return NextResponse.json({ success: false, message: 'Training evaluations disabled' }, { status: 404 })
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'training-evals:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const trainingId = searchParams.get('training_id')
    const includeUser = searchParams.get('include_user') === 'true'
    
    // Build query with optional user join
    let selectQuery = '*'
    if (includeUser) {
      selectQuery = '*, user:users!user_id(first_name, last_name, email), training:trainings!training_id(title)'
    }
    
    let query = supabase.from('training_evaluations').select(selectQuery).order('created_at', { ascending: false })
    if (trainingId) query = query.eq('training_id', trainingId)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch training evaluations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!FEATURE_ENABLED) return NextResponse.json({ success: false, message: 'Training evaluations disabled' }, { status: 404 })
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'training-evals:post'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = TrainingEvaluationCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })
    const { training_id, user_id, rating, comments } = parsed.data

    const { data, error } = await supabase
      .from('training_evaluations')
      .insert({ training_id, user_id, rating, comments: comments ?? null })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create training evaluation' }, { status: 500 })
  }
}


