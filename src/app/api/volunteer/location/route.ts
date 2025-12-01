import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { 
  isAccuracyAcceptable, 
  isSignificantMovement, 
  isWithinApproximateBounds,
  GEOLOCATION_CONFIG 
} from '@/lib/geolocation-config'

export const dynamic = 'force-dynamic'

/**
 * Validate location using database function (fail-closed)
 * Note: The database trigger will automatically set is_within_talisay_city column
 * @throws Error if validation fails or RPC call fails
 */
async function validateLocationBounds(supabase: any, lat: number, lng: number): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_within_talisay_city', { check_lat: lat, check_lng: lng })
  
  if (error) {
    console.error('[boundary-validation] RPC call failed:', {
      error: error.message,
      code: error.code,
      lat,
      lng,
      timestamp: new Date().toISOString()
    })
    throw new Error('BOUNDARY_VALIDATION_FAILED')
  }
  
  const isWithin = data === true
  
  console.log('[boundary-validation] Check completed:', {
    lat,
    lng,
    isWithin,
    timestamp: new Date().toISOString()
  })
  
  return isWithin
}

import { locationThrottle } from '@/lib/location-throttle'

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    // Ensure volunteer role
    const { data: urow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (!urow || urow.role !== 'volunteer') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only volunteers can publish locations' }, { status: 403 })
    }

    const { lat, lng, accuracy, speed, heading } = await request.json()
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'lat/lng required' }, { status: 400 })
    }

    // Edge case: Check accuracy threshold
    if (!isAccuracyAcceptable(accuracy)) {
      console.warn('[location-api] Location rejected (poor accuracy):', {
        userId: user.id,
        lat,
        lng,
        accuracy
      })
      return NextResponse.json({ 
        success: false, 
        code: 'ACCURACY_TOO_LOW', 
        message: `Location accuracy is too low (${accuracy}m). Please wait for better GPS signal.` 
      }, { status: 400 })
    }

    // Edge case: Quick bounds check (fail fast before database call)
    if (!isWithinApproximateBounds(lat, lng)) {
      console.warn('[location-api] Location rejected (obviously out of bounds):', {
        userId: user.id,
        lat,
        lng
      })
      return NextResponse.json({ 
        success: false, 
        code: 'OUT_OF_BOUNDS', 
        message: 'Your location is outside Talisay City boundaries. Please ensure you are within the service area.' 
      }, { status: 400 })
    }

    // Edge case: Check if movement is significant enough
    const { data: lastLocation } = await supabase
      .from('volunteer_locations')
      .select('lat, lng')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastLocation && !isSignificantMovement(lastLocation.lat, lastLocation.lng, lat, lng)) {
      console.log('[location-api] Location skipped (insignificant movement):', {
        userId: user.id,
        lat,
        lng
      })
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        message: 'Location unchanged (movement too small)' 
      }, { status: 200 })
    }

    // Validate location is within Talisay City bounds (fail-closed)
    let withinBounds: boolean
    try {
      withinBounds = await validateLocationBounds(supabase, lat, lng)
    } catch (validationError: any) {
      console.error('[location-api] Boundary validation failed for user:', {
        userId: user.id,
        lat,
        lng,
        error: validationError.message
      })
      return NextResponse.json({ 
        success: false, 
        code: 'BOUNDARY_VALIDATION_FAILED', 
        message: 'Unable to verify location boundaries. Please try again later.' 
      }, { status: 502 })
    }

    if (!withinBounds) {
      console.warn('[location-api] Location rejected (out of bounds):', {
        userId: user.id,
        lat,
        lng
      })
      return NextResponse.json({ 
        success: false, 
        code: 'OUT_OF_BOUNDS', 
        message: 'Your location is outside Talisay City boundaries. Please ensure you are within the service area.' 
      }, { status: 400 })
    }

    // Insert location - the database trigger will automatically set is_within_talisay_city
    const { data, error } = await supabase
      .from('volunteer_locations')
      .insert({ 
        user_id: user.id, 
        lat, 
        lng, 
        accuracy: accuracy ?? null, 
        speed: speed ?? null, 
        heading: heading ?? null 
      })
      .select()
      .single()

    if (error) throw error
    
    console.log('[location-api] Location recorded:', {
      userId: user.id,
      locationId: data.id,
      withinCity: data.is_within_talisay_city
    })
    
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('[location-api] Unexpected error:', {
      error: e.message,
      stack: e.stack
    })
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to publish location' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)

    // Volunteers can fetch their recent points
    const { data, error } = await supabase
      .from('volunteer_locations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch locations' }, { status: 500 })
  }
}
