import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/volunteer/location/route
 * Returns a volunteer's location history (route) for path visualization
 * Query params:
 *   - user_id: UUID of the volunteer (required for admins)
 *   - since: Minutes to look back (default: 180, max: 1440)
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

    const url = new URL(request.url)
    const requestedUserId = url.searchParams.get('user_id')
    const sinceMinutes = Math.min(
      parseInt(url.searchParams.get('since') || '180', 10), 
      1440 // Max 24 hours
    )

    // Check permissions
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const userRole = (userRow as any)?.role
    const isAdmin = userRole === 'admin' || userRole === 'barangay'
    const targetUserId = isAdmin && requestedUserId ? requestedUserId : user.id

    // If non-admin requests someone else's route, deny
    if (!isAdmin && requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'You can only view your own route' 
      }, { status: 403 })
    }

    // Fetch location history ordered by time
    const { data: locations, error } = await supabase
      .from('volunteer_locations')
      .select('id, lat, lng, accuracy, speed, heading, created_at, is_within_talisay_city')
      .eq('user_id', targetUserId)
      .gte('created_at', new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(1000) // Prevent excessive data

    if (error) throw error

    // Simplify route if too many points (basic decimation)
    const simplifiedRoute = simplifyRoute(locations || [], 500)

    return NextResponse.json({ 
      success: true, 
      data: {
        userId: targetUserId,
        sinceMinutes,
        pointCount: locations?.length || 0,
        simplifiedPointCount: simplifiedRoute.length,
        route: simplifiedRoute
      }
    })
  } catch (e: any) {
    console.error('[route-api] Error fetching route:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch route' 
    }, { status: 500 })
  }
}

/**
 * Simple route simplification using distance threshold
 * Keeps first, last, and points that are far enough apart
 */
function simplifyRoute(
  points: Array<{ lat: number; lng: number; created_at: string; [key: string]: any }>, 
  maxPoints: number
): Array<{ lat: number; lng: number; created_at: string; [key: string]: any }> {
  if (points.length <= maxPoints) return points

  const result = [points[0]] // Always keep first point
  const minDistance = 0.0001 // ~11 meters (basic threshold)

  for (let i = 1; i < points.length - 1; i++) {
    const lastKept = result[result.length - 1]
    const current = points[i]
    
    const distance = Math.sqrt(
      Math.pow(current.lat - lastKept.lat, 2) + 
      Math.pow(current.lng - lastKept.lng, 2)
    )
    
    if (distance >= minDistance) {
      result.push(current)
    }
    
    // Stop if we've reached max points
    if (result.length >= maxPoints - 1) break
  }

  result.push(points[points.length - 1]) // Always keep last point

  return result
}
