// src/app/api/admin/analytics/schedules/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'
import { Database } from '@/types/supabase'

type UserRow = Database['public']['Tables']['users']['Row']

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export const runtime = 'nodejs'

let cachedMetrics: any = null
let lastFetched = 0

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
      .maybeSingle<UserRow>()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'metrics'
    const startDate = searchParams.get('start_date') || undefined
    const endDate = searchParams.get('end_date') || undefined
    const volunteerId = searchParams.get('volunteer_id') || undefined

    // Check cache for metrics section (5 minutes)
    const now = Date.now()
    if (section === 'metrics' && cachedMetrics && (now - lastFetched < 300000)) {
      return NextResponse.json({ success: true, data: cachedMetrics })
    }

    let query = serviceClient.from('schedules').select('*', { count: 'exact' })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('start_time', startDate)
    }
    if (endDate) {
      query = query.lte('end_time', endDate)
    }
    if (volunteerId) {
      query = query.eq('volunteer_id', volunteerId)
    }

    const { count: totalSchedules, error: countError } = await query

    if (countError) throw countError

    // Get upcoming schedules (next 7 days)
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    
    const { count: upcomingSchedules, error: upcomingError } = await serviceClient
      .from('schedules')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', new Date().toISOString())
      .lte('start_time', nextWeek.toISOString())

    if (upcomingError) throw upcomingError

    // Get completed schedules
    const { count: completedSchedules, error: completedError } = await serviceClient
      .from('schedules')
      .select('*', { count: 'exact', head: true })
      .lt('end_time', new Date().toISOString())
      .eq('status', 'COMPLETED')

    if (completedError) throw completedError

    // Get schedules by status
    const { data: statusDistribution, error: statusError } = await serviceClient
      .from('schedules')
      .select('status')
      
    if (statusError) throw statusError

    // Group by status
    const statusCounts: Record<string, number> = {}
    statusDistribution.forEach((schedule: any) => {
      const status = schedule.status || 'UNKNOWN'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    // Get schedules by barangay
    const { data: barangayData, error: barangayError } = await serviceClient
      .from('schedules')
      .select('barangay')
      
    if (barangayError) throw barangayError

    // Group by barangay
    const barangayCounts: Record<string, number> = {}
    barangayData.forEach((schedule: any) => {
      const barangay = schedule.barangay || 'Unknown'
      barangayCounts[barangay] = (barangayCounts[barangay] || 0) + 1
    })

    // Get top volunteers by schedule count
    const { data: volunteerSchedules, error: volunteerError } = await serviceClient
      .from('schedules')
      .select(`
        volunteer_id,
        volunteer:users!schedules_volunteer_id_fkey(first_name, last_name)
      `)
      
    if (volunteerError) throw volunteerError

    // Group by volunteer
    const volunteerCounts: Record<string, { name: string; count: number }> = {}
    volunteerSchedules.forEach((schedule: any) => {
      if (schedule.volunteer_id && schedule.volunteer) {
        const volunteerId = schedule.volunteer_id
        const volunteerName = `${schedule.volunteer.first_name} ${schedule.volunteer.last_name}`
        if (!volunteerCounts[volunteerId]) {
          volunteerCounts[volunteerId] = { name: volunteerName, count: 0 }
        }
        volunteerCounts[volunteerId].count++
      }
    })

    // Get top 5 volunteers
    const topVolunteers = Object.entries(volunteerCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([id, data]) => ({ id, name: data.name, count: data.count }))

    const metrics = {
      total_schedules: totalSchedules ?? 0,
      upcoming_schedules: upcomingSchedules ?? 0,
      completed_schedules: completedSchedules ?? 0,
      status_distribution: statusCounts,
      barangay_distribution: barangayCounts,
      top_volunteers: topVolunteers
    }

    // Update cache
    if (section === 'metrics') {
      cachedMetrics = metrics
      lastFetched = now
    }

    return NextResponse.json({ success: true, data: metrics })
  } catch (error: any) {
    console.error('Admin schedule analytics error:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to load schedule analytics' },
      { status: 500 }
    )
  }
}