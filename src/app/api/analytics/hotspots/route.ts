import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10)))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Fetch coordinates AND barangay for incidents in the window
    const { data, error } = await supabase
      .from('incidents')
      .select('location_lat, location_lng, barangay')
      .gte('created_at', since)
    if (error) throw error

    // Guard empty
    const points = (data as Array<{ location_lat: number | null; location_lng: number | null; barangay: string | null }> | null) || []

    // Group by a small coordinate grid to reduce duplicates and produce counts
    const gridSize = 0.001 // ~100m depending on latitude; adjust if needed
    const buckets: Record<string, { lat: number; lng: number; count: number; barangay: string }> = {}

    for (const p of points) {
      if (typeof p.location_lat !== 'number' || typeof p.location_lng !== 'number') continue
      const latBucket = Math.round(p.location_lat / gridSize) * gridSize
      const lngBucket = Math.round(p.location_lng / gridSize) * gridSize
      const key = `${latBucket.toFixed(3)},${lngBucket.toFixed(3)}`
      if (!buckets[key]) {
        buckets[key] = { 
          lat: latBucket, 
          lng: lngBucket, 
          count: 1, 
          barangay: p.barangay || 'Unknown' 
        }
      } else {
        buckets[key].count += 1
        // Keep the first barangay name for the hotspot
        // If you want the most common barangay, you'd need to track all barangays
      }
    }

    const hotspots = Object.values(buckets).sort((a, b) => b.count - a.count)

    return NextResponse.json({ success: true, data: hotspots })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to load hotspots' }, { status: 500 })
  }
}



