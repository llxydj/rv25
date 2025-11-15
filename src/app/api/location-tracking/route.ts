import { NextResponse } from 'next/server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase-server'

const LocationTrackingSchema = z.object({
  user_id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  timestamp: z.string().optional()
})

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'location-tracking:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('location_tracking')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch location tracking data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'location-tracking:post'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const supabase = await getServerSupabase()
    const parsed = LocationTrackingSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const payload = parsed.data

    // Enforce user preferences: location tracking must be enabled
    const { data: prefs, error: prefsErr } = await supabase
      .from('location_preferences')
      .select('enabled, user_id')
      .eq('user_id', payload.user_id)
      .single()
    if (prefsErr) {
      return NextResponse.json({ success: false, code: 'PREFERENCES_ERROR', message: 'Unable to verify location preferences' }, { status: 400 })
    }
    if (!prefs?.enabled) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Location tracking disabled by user' }, { status: 403 })
    }

    // Enforce Talisay City bounds via env variables (additive, configurable)
    const minLat = parseFloat(process.env.TALISAY_MIN_LAT || '')
    const maxLat = parseFloat(process.env.TALISAY_MAX_LAT || '')
    const minLng = parseFloat(process.env.TALISAY_MIN_LNG || '')
    const maxLng = parseFloat(process.env.TALISAY_MAX_LNG || '')
    const hasBounds = [minLat, maxLat, minLng, maxLng].every(v => Number.isFinite(v))
    if (hasBounds) {
      const within = payload.latitude >= minLat && payload.latitude <= maxLat && payload.longitude >= minLng && payload.longitude <= maxLng
      if (!within) {
        return NextResponse.json({ success: false, code: 'OUT_OF_BOUNDS', message: 'Location must be within Talisay City' }, { status: 400 })
      }
    }
    // If bounds not set, operate permissively for backward compatibility

    const { data, error } = await supabase
      .from('location_tracking')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to save location tracking data' }, { status: 500 })
  }
}

