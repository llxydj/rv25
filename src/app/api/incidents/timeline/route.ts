import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/incidents/timeline
 * Log incident timeline event (server-side to avoid client-side service role key issues)
 */
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()

    const {
      incident_id,
      updated_by,
      previous_status,
      new_status,
      notes,
    } = body

    if (!incident_id) {
      return NextResponse.json({
        success: false,
        message: 'incident_id is required'
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('incident_updates')
      .insert({
        incident_id,
        updated_by: updated_by || null,
        previous_status: previous_status || null,
        new_status: new_status || null,
        notes: notes || null,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Failed to log timeline event:', error)
      return NextResponse.json({
        success: false,
        message: error.message || 'Failed to log timeline event'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Error in timeline API:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

