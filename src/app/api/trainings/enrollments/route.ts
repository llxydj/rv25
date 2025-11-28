import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic'

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

export async function GET(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const training_id = searchParams.get('training_id')

    let query = supabaseAdmin
      .from('training_enrollments')
      .select(`
        *,
        users:user_id (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          barangay
        )
      `)

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    if (training_id) {
      query = query.eq('training_id', training_id)
    }

    const { data, error } = await query.order('enrolled_at', { ascending: false })

    if (error) {
      console.error('❌ Get enrollments error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to fetch enrollments' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    console.error('❌ GET /api/trainings/enrollments error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to fetch enrollments' },
      { status: 500 }
    )
  }
}

