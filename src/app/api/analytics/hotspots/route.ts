import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a server client with timeout configuration
const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (input, init) => {
          // Set a reasonable timeout (30 seconds)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)
          
          return fetch(input, {
            ...init,
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId))
        }
      }
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    // Use server client instead of browser client
    const supabase = createServerClient()
    
    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10)))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Fetch coordinates for incidents in the window
    const { data, error } = await supabase
      .from('incidents')
      .select('location_lat, location_lng')
      .gte('created_at', since)
    if (error) throw error

    // Guard empty
    const points = (data as Array<{ location_lat: number | null; location_lng: number | null }> | null) || []

    // Group by a small coordinate grid to reduce duplicates and produce counts
    const gridSize = 0.001 // ~100m depending on latitude; adjust if needed
    const buckets: Record<string, { lat: number; lng: number; count: number }> = {}

    for (const p of points) {
      if (typeof p.location_lat !== 'number' || typeof p.location_lng !== 'number') continue
      const latBucket = Math.round(p.location_lat / gridSize) * gridSize
      const lngBucket = Math.round(p.location_lng / gridSize) * gridSize
      const key = `${latBucket.toFixed(3)},${lngBucket.toFixed(3)}`
      if (!buckets[key]) {
        buckets[key] = { lat: latBucket, lng: lngBucket, count: 1 }
      } else {
        buckets[key].count += 1
      }
    }

    const hotspots = Object.values(buckets).sort((a, b) => b.count - a.count)

    return NextResponse.json({ success: true, data: hotspots })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to load hotspots' }, { status: 500 })
  }
}