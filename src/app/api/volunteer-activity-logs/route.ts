import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'activity-logs:get'), 60)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMITED', message: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any }
      )
    }

    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const volunteerId = searchParams.get('volunteer_id') || userRes.user.id
    const activityType = searchParams.get('activity_type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Check if user has permission to view these logs
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .single()

    const isAdmin = userData?.role === 'admin'
    const isOwnProfile = volunteerId === userRes.user.id

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to view these activity logs' },
        { status: 403 }
      )
    }

    let query = supabase
      .from('volunteer_activity_logs')
      .select('*, created_by_user:created_by(first_name, last_name)')
      .eq('volunteer_id', volunteerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (activityType) {
      query = query.eq('activity_type', activityType)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('Activity logs fetch error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to fetch activity logs' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'activity-logs:post'), 30)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMITED', message: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any }
      )
    }

    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { volunteer_id, activity_type, title, description, metadata } = body

    // Validate required fields
    if (!volunteer_id || !activity_type || !title) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: volunteer_id, activity_type, title' },
        { status: 400 }
      )
    }

    // Check if user has permission to create logs
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .single()

    const isAdmin = userData?.role === 'admin'
    const isOwnProfile = volunteer_id === userRes.user.id

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized to create activity logs for this volunteer' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('volunteer_activity_logs')
      .insert({
        volunteer_id,
        activity_type,
        title,
        description,
        metadata: metadata || {},
        created_by: userRes.user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('Activity log creation error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to create activity log' },
      { status: 500 }
    )
  }
}
