import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'metrics'

    if (section === 'performance') {
      const { data, error } = await serviceClient.rpc('volunteer_performance_kpis')
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    const [
      activeRes,
      totalActivitiesRes,
      resolvedActivitiesRes,
      participatingRes,
      scheduledRes,
      acceptedRes,
    ] = await Promise.all([
      serviceClient
        .from('volunteer_profiles')
        .select('volunteer_user_id', { count: 'exact', head: true })
        .eq('is_available', true),
      serviceClient
        .from('volunteeractivities')
        .select('id', { count: 'exact', head: true }),
      serviceClient
        .from('volunteeractivities')
        .select('id', { count: 'exact', head: true })
        .not('resolved_at', 'is', null),
      serviceClient
        .from('volunteeractivities')
        .select('id', { count: 'exact', head: true })
        .eq('participated', true)
        .is('resolved_at', null),
      serviceClient
        .from('scheduledactivities')
        .select('schedule_id', { count: 'exact', head: true }),
      serviceClient
        .from('scheduledactivities')
        .select('schedule_id', { count: 'exact', head: true })
        .eq('is_accepted', true),
    ])

    const metrics = {
      active_volunteers: activeRes.count ?? 0,
      total_activities: totalActivitiesRes.count ?? 0,
      completed_activities: resolvedActivitiesRes.count ?? 0,
      participating_activities: participatingRes.count ?? 0,
      scheduled_activities: scheduledRes.count ?? 0,
      accepted_activities: acceptedRes.count ?? 0,
    }

    return NextResponse.json({ success: true, data: metrics })
  } catch (error: any) {
    console.error('Admin volunteer analytics error:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to load volunteer analytics' },
      { status: 500 }
    )
  }
}

