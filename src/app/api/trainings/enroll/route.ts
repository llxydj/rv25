import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true'

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

    const body = await request.json()
    const { training_id } = body

    if (!training_id) {
      return NextResponse.json(
        { success: false, message: 'Training ID is required' },
        { status: 400 }
      )
    }

    // Check if training exists and is enrollable
    const { data: training, error: trainingError } = await supabaseAdmin
      .from('trainings')
      .select('id, status, capacity')
      .eq('id', training_id)
      .single()

    if (trainingError || !training) {
      return NextResponse.json(
        { success: false, message: 'Training not found' },
        { status: 404 }
      )
    }

    if (training.status !== 'SCHEDULED') {
      return NextResponse.json(
        { success: false, message: 'Training is not available for enrollment' },
        { status: 400 }
      )
    }

    // Check capacity
    if (training.capacity) {
      const { count } = await supabaseAdmin
        .from('training_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('training_id', training_id)

      if (count && count >= training.capacity) {
        return NextResponse.json(
          { success: false, message: 'Training is full' },
          { status: 400 }
        )
      }
    }

    // Check if already enrolled
    const { data: existing } = await supabaseAdmin
      .from('training_enrollments')
      .select('id')
      .eq('training_id', training_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Already enrolled in this training' },
        { status: 400 }
      )
    }

    // Enroll
    const { data, error } = await supabaseAdmin
      .from('training_enrollments')
      .insert({
        training_id,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Enrollment error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to enroll' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('❌ POST /api/trainings/enroll error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to enroll' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const training_id = searchParams.get('training_id')

    if (!training_id) {
      return NextResponse.json(
        { success: false, message: 'Training ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('training_enrollments')
      .delete()
      .eq('training_id', training_id)
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ Unenrollment error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to unenroll' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ DELETE /api/trainings/enroll error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to unenroll' },
      { status: 500 }
    )
  }
}

