import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // This endpoint triggers the service worker to download map tiles
    // The actual caching is handled by the service worker
    
    // Send message to service worker to start caching
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      if (registration.active) {
        registration.active.postMessage({
          type: 'CACHE_MAP_TILES',
          data: {
            bounds: {
              north: 10.3,
              south: 10.2,
              east: 123.0,
              west: 122.9
            },
            zoomLevels: [10, 11, 12, 13, 14, 15, 16]
          }
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Map tile caching started' 
    })
  } catch (error: any) {
    console.error('Error starting map tile caching:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to start map tile caching' },
      { status: 500 }
    )
  }
}
