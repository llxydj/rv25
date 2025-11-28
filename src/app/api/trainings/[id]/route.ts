import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { status } = body

    if (!status || !['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('trainings')
      .update({ status })
      .eq('id', parseInt(params.id))
      .select()
      .single()

    if (error) {
      console.error('❌ Update training error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to update training' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('❌ PATCH /api/trainings/[id] error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to update training' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('trainings')
      .select('*')
      .eq('id', parseInt(params.id))
      .single()

    if (error) {
      console.error('❌ Get training error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Training not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('❌ GET /api/trainings/[id] error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to fetch training' },
      { status: 500 }
    )
  }
}

