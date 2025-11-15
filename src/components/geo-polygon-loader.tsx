"use client"

import { useEffect } from "react"

export default function GeoPolygonLoader() {
  useEffect(() => {
    const enabled = process.env.NEXT_PUBLIC_FEATURE_GEO_POLYGON_GUARD === 'true'
    if (!enabled) return
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch('/talisay.geojson', { cache: 'force-cache' })
        if (!res.ok) return
        const gj = await res.json()
        const coords = gj?.features?.[0]?.geometry?.coordinates?.[0]
        if (coords && Array.isArray(coords) && !canceled) {
          // coords are [lng, lat]; convert to [lat, lng]
          const polygon = coords.map((c: [number, number]) => [c[1], c[0]])
          ;(window as any).__TALISAY_POLYGON__ = polygon
        }
      } catch { void 0 }
    })()
    return () => {
      canceled = true
    }
  }, [])
  return null
}





