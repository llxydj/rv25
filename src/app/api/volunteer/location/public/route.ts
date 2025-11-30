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
 * GET /api/volunteer/location/public
 * Public endpoint for residents to view available volunteer locations
 * Shows only volunteers who are currently available and sharing location
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

    // Verify user is resident
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!me || me.role !== 'resident') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Residents only' 
      }, { status: 403 })
    }

    const url = new URL(request.url)
    const sinceMin = parseInt(url.searchParams.get('since') || '30', 10) // default 30 min
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200)

    const sinceIso = new Date(Date.now() - sinceMin * 60 * 1000).toISOString()

    // Fetch recent volunteer locations with user info
    // Only show volunteers who are available and have shared location recently
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
        users!volunteer_locations_user_id_fkey (
          id,
          first_name,
          last_name,
          phone_number,
          volunteer_profiles!volunteer_profiles_volunteer_user_id_fkey (
            status,
            is_available
          )
        )
      `)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Filter to only available volunteers and get latest location per volunteer
    const uniqueVolunteers = new Map<string, any>()
    locations?.forEach((loc: any) => {
      const isAvailable = loc.users?.volunteer_profiles?.[0]?.is_available === true ||
                          loc.users?.volunteer_profiles?.[0]?.status === 'active'
      
      if (isAvailable && !uniqueVolunteers.has(loc.user_id)) {
        uniqueVolunteers.set(loc.user_id, {
          id: loc.id,
          user_id: loc.user_id,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          speed: loc.speed,
          heading: loc.heading,
          created_at: loc.created_at,
          first_name: loc.users?.first_name,
          last_name: loc.users?.last_name,
          phone_number: loc.users?.phone_number
        })
      }
    })

    return NextResponse.json({ 
      success: true, 
      data: Array.from(uniqueVolunteers.values()),
      count: uniqueVolunteers.size
    })
  } catch (e: any) {
    console.error('[public-volunteer-locations] Error:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch volunteer locations' 
    }, { status: 500 })
  }
}

