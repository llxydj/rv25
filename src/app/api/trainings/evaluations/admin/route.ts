import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { z } from 'zod'

// Trainings feature is enabled by default
const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED !== 'false'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const EvaluationSchema = z.object({
  training_id: z.number().int().positive(),
  user_id: z.string().uuid(),
  performance_rating: z.number().int().min(1).max(5),
  skills_assessment: z.record(z.any()).optional(),
  comments: z.string().optional()
})

export async function POST(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = EvaluationSchema.parse(body)

    // Check if training exists and is completed
    const { data: training } = await supabaseAdmin
      .from('trainings')
      .select('id, status')
      .eq('id', validated.training_id)
      .single()

    if (!training) {
      return NextResponse.json(
        { success: false, message: 'Training not found' },
        { status: 404 }
      )
    }

    if (training.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, message: 'Can only evaluate volunteers for completed trainings' },
        { status: 400 }
      )
    }

    // Check if user was enrolled in training
    const { data: enrollment } = await supabaseAdmin
      .from('training_enrollments')
      .select('id')
      .eq('training_id', validated.training_id)
      .eq('user_id', validated.user_id)
      .single()

    if (!enrollment) {
      return NextResponse.json(
        { success: false, message: 'User was not enrolled in this training' },
        { status: 400 }
      )
    }

    // Insert or update evaluation
    const { data, error } = await supabaseAdmin
      .from('training_evaluations_admin')
      .upsert({
        training_id: validated.training_id,
        user_id: validated.user_id,
        evaluated_by: user.id,
        performance_rating: validated.performance_rating,
        skills_assessment: validated.skills_assessment || null,
        comments: validated.comments || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'training_id,user_id,evaluated_by'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Evaluation error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to save evaluation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', errors: e.errors },
        { status: 400 }
      )
    }
    console.error('❌ POST /api/trainings/evaluations/admin error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to save evaluation' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const training_id = searchParams.get('training_id')
    const user_id = searchParams.get('user_id')

    let query = supabaseAdmin
      .from('training_evaluations_admin')
      .select(`
        *,
        users:user_id (
          id,
          first_name,
          last_name,
          email
        ),
        evaluated_by_user:evaluated_by (
          id,
          first_name,
          last_name
        )
      `)

    if (training_id) {
      query = query.eq('training_id', training_id)
    }

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Get evaluations error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to fetch evaluations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    console.error('❌ GET /api/trainings/evaluations/admin error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to fetch evaluations' },
      { status: 500 }
    )
  }
}

