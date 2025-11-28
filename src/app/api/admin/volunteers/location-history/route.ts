import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

/**
 * GET /api/admin/volunteers/location-history
 * Returns last known location for each volunteer (past positions)
 * Query params:
 *   - hours: Hours to look back (default: 24, max: 168)
 *   - limit: Max records per volunteer (default: 1, max: 10)
 */
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    
    if (!user?.id) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED' 
      }, { status: 401 })
    }

    // Verify admin role
    const { data: userRow, error: roleError } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (roleError || !userRow) {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Failed to verify user role' 
      }, { status: 403 })
    }

    const userRole = (userRow as any)?.role
    const userStatus = (userRow as any)?.status
    
    if (!['admin', 'barangay'].includes(userRole)) {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    if (userStatus === 'inactive') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Account is deactivated' 
      }, { status: 403 })
    }

    const url = new URL(request.url)
    const hoursBack = Math.min(parseInt(url.searchParams.get('hours') || '24', 10), 168) // Max 7 days
    const limitPerVolunteer = Math.min(parseInt(url.searchParams.get('limit') || '1', 10), 10)

    const sinceDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

    // Get last known location for each volunteer
    // Using window function to get the most recent location per volunteer
    const { data: locations, error } = await supabaseAdmin
      .from('volunteer_locations')
      .select(`
        id,
        user_id,
        lat,
        lng,
        accuracy,
        speed,
        heading,
        created_at,
        is_within_talisay_city,
        users!volunteer_locations_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number
        )
      `)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[location-history] Query error:', error)
      throw error
    }

    // Group by user_id and get the most recent location(s) per volunteer
    const locationMap = new Map<string, any[]>()
    
    for (const loc of locations || []) {
      const userId = loc.user_id
      if (!locationMap.has(userId)) {
        locationMap.set(userId, [])
      }
      const userLocs = locationMap.get(userId)!
      if (userLocs.length < limitPerVolunteer) {
        userLocs.push(loc)
      }
    }

    // Get volunteer profiles separately to avoid relationship ambiguity
    const userIds = Array.from(locationMap.keys())
    const { data: profiles } = await supabaseAdmin
      .from('volunteer_profiles')
      .select('volunteer_user_id, status, is_available, last_active_at')
      .in('volunteer_user_id', userIds)

    const profileMap = new Map<string, any>()
    profiles?.forEach((profile: any) => {
      profileMap.set(profile.volunteer_user_id, profile)
    })

    // Transform to expected format
    const formattedLocations: any[] = []
    
    for (const [userId, userLocs] of locationMap.entries()) {
      for (const loc of userLocs) {
        const user = loc.users
        const profile = profileMap.get(userId)
        formattedLocations.push({
          id: loc.id,
          user_id: userId,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          speed: loc.speed,
          heading: loc.heading,
          created_at: loc.created_at,
          is_within_talisay_city: loc.is_within_talisay_city,
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
          email: user?.email || '',
          phone_number: user?.phone_number || '',
          status: profile?.status || 'offline',
          is_available: profile?.is_available || false,
          last_active_at: profile?.last_active_at
        })
      }
    }

    // Sort by created_at descending (most recent first)
    formattedLocations.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({ 
      success: true, 
      data: formattedLocations,
      count: formattedLocations.length,
      hours_back: hoursBack
    })
  } catch (e: any) {
    console.error('[location-history] Error:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch location history' 
    }, { status: 500 })
  }
}

