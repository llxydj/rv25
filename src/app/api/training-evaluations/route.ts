import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { TrainingEvaluationCreateSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true'

export async function GET(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json({ success: false, message: 'Training evaluations disabled' }, { status: 404 })
    }
    
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'training-evals:get'), 60)
    if (!rate.allowed) {
      return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })
    }

    const supabase = await getServerSupabase()
    const { searchParams } = new URL(request.url)
    const trainingId = searchParams.get('training_id')
    const includeUser = searchParams.get('include_user') === 'true'
    
    // Fetch evaluations first
    let query = supabase.from('training_evaluations').select('*').order('created_at', { ascending: false })
    if (trainingId) {
      query = query.eq('training_id', trainingId)
    }
    
    const { data: evaluations, error } = await query
    
    if (error) {
      console.error('Error fetching training evaluations:', error)
      throw error
    }
    
    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }
    
    // If user data is requested, fetch users and trainings separately
    // (since there's no FK relationship defined in the schema)
    let transformedData = evaluations
    
    if (includeUser) {
      // Get unique user IDs and training IDs
      const userIds = [...new Set(evaluations.map((e: any) => e.user_id).filter(Boolean))]
      const trainingIds = [...new Set(evaluations.map((e: any) => e.training_id).filter(Boolean))]
      
      // Fetch users
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', userIds)
      
      // Fetch trainings
      const { data: trainings } = await supabase
        .from('trainings')
        .select('id, title')
        .in('id', trainingIds)
      
      // Create lookup maps
      const userMap = new Map((users || []).map((u: any) => [u.id, u]))
      const trainingMap = new Map((trainings || []).map((t: any) => [t.id, t]))
      
      // Transform data to match expected format
      transformedData = evaluations.map((item: any) => {
        const user = userMap.get(item.user_id)
        const training = trainingMap.get(item.training_id)
        
        return {
          ...item,
          user: user ? {
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email
          } : null,
          training: training ? {
            title: training.title
          } : null
        }
      })
    }
    
    return NextResponse.json({ success: true, data: transformedData })
  } catch (e: any) {
    console.error('GET /api/training-evaluations error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch training evaluations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json({ success: false, message: 'Training evaluations disabled' }, { status: 404 })
    }
    
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'training-evals:post'), 20)
    if (!rate.allowed) {
      return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })
    }

    const supabase = await getServerSupabase()
    const parsed = TrainingEvaluationCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })
    }
    
    const { training_id, user_id, rating, comments } = parsed.data

    const { data, error } = await supabase
      .from('training_evaluations')
      .insert({ training_id, user_id, rating, comments: comments ?? null })
      .select()
      .single()

    if (error) {
      console.error('Error creating training evaluation:', error)
      throw error
    }
    
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('POST /api/training-evaluations error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to create training evaluation' }, { status: 500 })
  }
}


