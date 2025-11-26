import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/volunteers/locations
 * Returns active volunteer locations with status and user info
 * Admin-only endpoint for map visualization
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

    // Verify admin/barangay role
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const userRole = (userRow as any)?.role
    if (!userRow || !userRole || !['admin', 'barangay'].includes(userRole)) {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    // Use the pre-built view for efficient querying
    const { data: locations, error } = await supabase
      .from('active_volunteers_with_location')
      .select('*')
      .order('last_location_update', { ascending: false })

    if (error) {
      console.error('[admin-locations] Query error:', error)
      throw error
    }

    // Transform to expected format
    const formattedLocations = (locations || []).map((loc: any) => ({
      id: `${loc.id}_${loc.last_location_update}`, // Unique ID for each update
      user_id: loc.id,
      lat: loc.latitude,
      lng: loc.longitude,
      accuracy: loc.accuracy,
      speed: null, // Not in view, could be added
      heading: null, // Not in view, could be added
      created_at: loc.last_location_update,
      is_within_talisay_city: true, // View filters for this
      first_name: loc.first_name,
      last_name: loc.last_name,
      status: loc.realtime_status || 'offline',
      is_available: loc.is_available,
      skills: loc.skills,
      assigned_barangays: loc.assigned_barangays
    }))

    return NextResponse.json({ 
      success: true, 
      data: formattedLocations,
      count: formattedLocations.length
    })
  } catch (e: any) {
    console.error('[admin-locations] Error:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch volunteer locations' 
    }, { status: 500 })
  }
}
