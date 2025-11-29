import { NextResponse } from 'next/server'

// Simple server-side proxy to Nominatim with headers and cache hints
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')
    const zoom = searchParams.get('zoom') || '16'
    const addressdetails = searchParams.get('addressdetails') || '1'

    if (!lat || !lon) {
      return NextResponse.json({ success: false, message: 'lat and lon are required' }, { status: 400 })
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=${encodeURIComponent(zoom)}&addressdetails=${encodeURIComponent(addressdetails)}`

    // PERFORMANCE FIX: Add timeout to prevent hanging on slow mobile networks
    // Nominatim can be very slow, especially on mobile connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for Nominatim

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          // Identify your app per Nominatim usage policy
          'User-Agent': process.env.NEXT_PUBLIC_APP_NAME || 'RVOIS/1.0 (Contact: jlcbelonio.chmsu@gmail.com, janlloydbelonio@gmail.com, https://github.com/llxydj)'
        },
        // Prevent accidental SSR cache; we will set client cache headers instead
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ 
          success: false, 
          message: 'Reverse geocoding timeout - service may be slow. Please try again or enter address manually.' 
        }, { status: 504 }); // Gateway Timeout
      }
      throw fetchError;
    }

    if (!res.ok) {
      return NextResponse.json({ success: false, message: 'Reverse geocoding failed' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        // Allow intermediate/CDN caching for 5 minutes
        'Cache-Control': 'public, max-age=300'
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to reverse geocode' }, { status: 500 })
  }
}
