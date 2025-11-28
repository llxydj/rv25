// src/app/api/admin/schedules/attendance/route.ts

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Record attendance for a schedule
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await request.json()
    const { schedule_id, present, notes } = body

    if (!schedule_id || typeof present !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Missing schedule_id or present status' }, { status: 400 })
    }

    // Update attendance - store present status in attendance_notes prefix
    const attendanceNote = present 
      ? `PRESENT${notes ? `: ${notes}` : ''}`
      : `ABSENT${notes ? `: ${notes}` : ''}`
    
    const { data: updated, error } = await supabaseAdmin
      .from('schedules')
      .update({
        attendance_marked: true,
        attendance_notes: attendanceNote,
      })
      .eq('id', schedule_id)
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email
        )
      `)
      .single()

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to record attendance' }, { status: 500 })
  }
}

// Get attendance records
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('schedule_id')
    const volunteerId = searchParams.get('volunteer_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let query = supabaseAdmin
      .from('schedules')
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email
        )
      `)
      .eq('attendance_marked', true)
      .order('start_time', { ascending: false })

    if (scheduleId) query = query.eq('id', scheduleId)
    if (volunteerId) query = query.eq('volunteer_id', volunteerId)
    if (startDate) query = query.gte('start_time', startDate)
    if (endDate) query = query.lte('start_time', endDate)

    const { data, error } = await query

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch attendance' }, { status: 500 })
  }
}

