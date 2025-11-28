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
    const { data: userRow, error: roleError } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (roleError) {
      console.error('[admin-locations] Error fetching user role:', roleError)
      return NextResponse.json({ 
        success: false, 
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify user role' 
      }, { status: 500 })
    }

    const userRole = (userRow as any)?.role
    const userStatus = (userRow as any)?.status
    
    if (!userRow) {
      console.warn('[admin-locations] User not found in database:', user.id)
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'User not found' 
      }, { status: 403 })
    }

    if (!userRole || !['admin', 'barangay'].includes(userRole)) {
      console.warn('[admin-locations] Access denied - invalid role:', { userId: user.id, role: userRole })
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: `Admin access required. Current role: ${userRole || 'none'}` 
      }, { status: 403 })
    }

    if (userStatus === 'inactive') {
      console.warn('[admin-locations] Access denied - user inactive:', user.id)
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Account is deactivated' 
      }, { status: 403 })
    }

    // Try the view first, but also query directly if view is empty or has issues
    let locations: any[] = []
    let error: any = null

    // First, try the view
    const { data: viewData, error: viewError } = await supabase
      .from('active_volunteers_with_location')
      .select('*')
      .order('last_location_update', { ascending: false })

    if (viewError) {
      console.warn('[admin-locations] View query error (will try direct query):', viewError)
    } else {
      locations = viewData || []
      console.log(`[admin-locations] View returned ${locations.length} volunteers`)
    }

    // If view returns no results, try direct query with longer time window (24 hours)
    if (locations.length === 0) {
      console.log('[admin-locations] View returned no results, trying direct query...')
      
      // Query locations first
      const { data: directData, error: directError } = await supabase
        .from('volunteer_locations')
        .select(`
          user_id,
          lat,
          lng,
          accuracy,
          created_at,
          users!volunteer_locations_user_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone_number
          )
        `)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })

      if (directError) {
        console.error('[admin-locations] Direct query error:', directError)
        error = directError
      } else if (directData && directData.length > 0) {
        // Get unique user IDs
        const userIds = [...new Set(directData.map((loc: any) => loc.user_id))]
        
        // Query volunteer profiles separately to avoid relationship ambiguity
        const { data: profiles } = await supabase
          .from('volunteer_profiles')
          .select('volunteer_user_id, is_available, skills, assigned_barangays')
          .in('volunteer_user_id', userIds)

        // Create a map of profiles by user_id
        const profileMap = new Map<string, any>()
        profiles?.forEach((profile: any) => {
          profileMap.set(profile.volunteer_user_id, profile)
        })

        // Get unique volunteers (most recent location per volunteer)
        const volunteerMap = new Map<string, any>()
        directData.forEach((loc: any) => {
          if (!volunteerMap.has(loc.user_id)) {
            const profile = profileMap.get(loc.user_id)
            volunteerMap.set(loc.user_id, {
              id: loc.user_id,
              user_id: loc.user_id,
              latitude: loc.lat,
              longitude: loc.lng,
              accuracy: loc.accuracy,
              last_location_update: loc.created_at,
              first_name: loc.users?.first_name || '',
              last_name: loc.users?.last_name || '',
              email: loc.users?.email || '',
              phone_number: loc.users?.phone_number || '',
              is_available: profile?.is_available || false,
              skills: profile?.skills || [],
              assigned_barangays: profile?.assigned_barangays || [],
              realtime_status: profile?.is_available ? 'available' : 'offline' // Default status
            })
          }
        })
        locations = Array.from(volunteerMap.values())
        console.log(`[admin-locations] Direct query returned ${locations.length} unique volunteers`)
      } else {
        console.log('[admin-locations] Direct query returned no data')
      }
    }

    if (error) {
      console.error('[admin-locations] Final query error:', error)
      throw error
    }

    // Transform to expected format
    const formattedLocations = (locations || []).map((loc: any) => {
      // Handle both view format and direct query format
      const userId = loc.id || loc.user_id
      const lat = loc.latitude || loc.lat
      const lng = loc.longitude || loc.lng
      const createdAt = loc.last_location_update || loc.created_at
      const status = loc.realtime_status || loc.status || (loc.is_available ? 'available' : 'offline')
      
      return {
        id: `${userId}_${createdAt}`, // Unique ID for each update
        user_id: userId,
        lat: lat,
        lng: lng,
        accuracy: loc.accuracy,
        speed: null, // Not in view, could be added
        heading: null, // Not in view, could be added
        created_at: createdAt,
        is_within_talisay_city: true, // View filters for this
        first_name: loc.first_name || '',
        last_name: loc.last_name || '',
        email: loc.email || '',
        phone_number: loc.phone_number || '',
        status: status,
        is_available: loc.is_available || false,
        skills: loc.skills || [],
        assigned_barangays: loc.assigned_barangays || []
      }
    })
    
    console.log(`[admin-locations] Formatted ${formattedLocations.length} locations`)
    if (formattedLocations.length > 0) {
      console.log('[admin-locations] Sample location:', {
        user_id: formattedLocations[0].user_id,
        name: `${formattedLocations[0].first_name} ${formattedLocations[0].last_name}`,
        lat: formattedLocations[0].lat,
        lng: formattedLocations[0].lng,
        status: formattedLocations[0].status
      })
    }

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
