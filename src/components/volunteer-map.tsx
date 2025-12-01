"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polygon } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER, pointInPolygon } from "@/lib/geo-utils"
import { MapBoundsRestriction } from "@/components/ui/map-bounds-restriction"
import { supabase } from "@/lib/supabase"

// Isolated, additive VolunteerMap feature
// - Does not change routing, auth, or other components
// - Gracefully handles empty DB and network failures
// - Uses talisay.geojson polygon to keep only volunteers inside Talisay City
// - Reverse geocodes addresses asynchronously, updating popups progressively
// - Works offline if talisay.geojson is cached by your existing SW

// Basic volunteer shape for this component
export type VolunteerPoint = {
  id?: string
  name: string
  role: string
  lat: number
  lng: number
}

// Mock volunteers (must be inside Talisay boundaries)
const mockVolunteers: VolunteerPoint[] = [
  { name: "Juan Dela Cruz", role: "Responder", lat: 10.7306, lng: 122.9479 },
  { name: "Maria Santos", role: "Coordinator", lat: 10.7321, lng: 122.9437 },
  { name: "Pedro Reyes", role: "Medic", lat: 10.7289, lng: 122.9491 },
  { name: "Ana Lopez", role: "Dispatcher", lat: 10.7298, lng: 122.9441 },
  { name: "Ramon Diaz", role: "Support", lat: 10.7315, lng: 122.9462 },
]

// Lightweight address cache in-memory for this component instance
const addressCache = new Map<string, string>()

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
  if (addressCache.has(key)) return addressCache.get(key) as string
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        // Friendly UA per Nominatim etiquette
        "User-Agent": "rvois/1.0 (https://rvois.example; admin@rvois.example)",
        "Accept": "application/json"
      }
    })
    if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`)
    const data = await res.json()
    const display = data?.display_name as string | undefined
    const out = display || "Address unavailable"
    addressCache.set(key, out)
    return out
  } catch (e) {
    console.warn("Reverse geocoding error", e)
    return "Address unavailable"
  }
}

function useTalisayPolygon() {
  const [polygon, setPolygon] = useState<[number, number][]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch("/talisay.geojson", { cache: "force-cache" })
        if (!res.ok) throw new Error(`Failed to load talisay.geojson: ${res.status}`)
        const gj = await res.json()
        const rawCoords = gj?.features?.[0]?.geometry?.coordinates?.[0] as [number, number][] | undefined
        if (rawCoords && Array.isArray(rawCoords)) {
          // Convert [lng, lat] -> [lat, lng]
          const poly = rawCoords.map(([lng, lat]) => [lat, lng] as [number, number])
          if (!canceled) setPolygon(poly)
        } else {
          console.warn("talisay.geojson missing polygon coordinates; boundary overlay disabled")
        }
      } catch (e) {
        console.warn("Error loading talisay.geojson", e)
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [])
  return { polygon, loading }
}

// Render the Talisay boundary using Leaflet vector layer
// (Removed imperative boundary layer; we use react-leaflet <Polygon /> directly)

// Fix Leaflet default icon paths in many bundlers
function fixLeafletIcons() {
  // Avoid re-running
  // @ts-expect-error
  if (window.__leaflet_fixed__) return
  // @ts-expect-error
  window.__leaflet_fixed__ = true
  // @ts-expect-error
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })
}

export interface VolunteerMapProps {
  height?: string
  // Optionally limit how many volunteers to show (after filtering)
  limit?: number
}

export function VolunteerMap({ height = "420px", limit = 100 }: VolunteerMapProps) {
  const [volunteers, setVolunteers] = useState<VolunteerPoint[]>([])
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { polygon, loading: polyLoading } = useTalisayPolygon()

  // Fetch volunteers from Supabase (RLS must allow reading public volunteer locations)
  useEffect(() => {
    fixLeafletIcons()

    let canceled = false
    ;(async () => {
      try {
        setLoading(true)
        // Attempt 1: read from a volunteer_locations table if it exists
        // Columns expected: id, name, role, lat, lng
        // If it fails (table missing or RLS), fall back to volunteer_profiles or mock data
        let points: VolunteerPoint[] | null = null
        try {
          const { data, error } = await supabase
            .from("volunteer_locations")
            .select("id, name, role, lat, lng")
            .limit(limit)
          if (error) throw error
          if (Array.isArray(data)) {
            points = data
              .filter(v => typeof v.lat === 'number' && typeof v.lng === 'number') as VolunteerPoint[]
          }
        } catch (_) {
          // Attempt 2: try volunteer_profiles if it exposes last known coordinates
          try {
            const { data, error } = await supabase
              .from("volunteer_profiles")
              .select("volunteer_user_id, last_lat, last_lng, status")
              .eq("status", "ACTIVE")
              .limit(limit)
            if (error) throw error
            if (Array.isArray(data)) {
              points = data
                .filter(v => typeof v.last_lat === 'number' && typeof v.last_lng === 'number')
                .map(v => ({
                  id: v.volunteer_user_id,
                  name: v.volunteer_user_id,
                  role: "Volunteer",
                  lat: v.last_lat as number,
                  lng: v.last_lng as number,
                })) as VolunteerPoint[]
            }
          } catch {
            // Swallow; we'll fall back to mocks
          }
        }

        if (!points || points.length === 0) {
          console.info("VolunteerMap: using mock volunteers (empty DB or RLS)")
          points = mockVolunteers
        }

        if (canceled) return

        // Filter by Talisay polygon if available; else accept all
        let filtered = points
        if (polygon && polygon.length > 3) {
          filtered = points.filter(p => pointInPolygon([p.lat, p.lng], polygon))
        }

        setVolunteers(filtered.slice(0, limit))
        setError(null)
      } catch (e: any) {
        console.error("VolunteerMap fetch error:", e)
        // Fall back to mocks on any error
        setVolunteers(mockVolunteers.slice(0, limit))
        setError(e?.message || "Failed to load volunteers")
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [limit, polygon])

  // Progressive reverse geocoding for visible volunteers
  useEffect(() => {
    let canceled = false
    ;(async () => {
      for (const v of volunteers) {
        const key = v.id ? v.id : `${v.lat},${v.lng}`
        if (canceled) break
        if (addresses[key]) continue
        const human = await reverseGeocode(v.lat, v.lng)
        if (canceled) break
        setAddresses(prev => ({ ...prev, [key]: human }))
      }
    })()
    return () => { canceled = true }
  }, [volunteers])

  const statusMessage = useMemo(() => {
    if (loading || polyLoading) return "Loading map…"
    if (error && volunteers.length === 0) return "No volunteers nearby"
    if (volunteers.length === 0) return "No volunteers nearby"
    return null
  }, [loading, polyLoading, error, volunteers])

  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md relative z-0">
      <MapContainer
        center={TALISAY_CENTER}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Draw talisay.geojson polygon as a vector layer */}
        {polygon.length > 3 && (
          <Polygon positions={polygon as any} pathOptions={{ color: "#2563eb", weight: 2, opacity: 0.9, fillOpacity: 0.08 }} />
        )}

        {/* Restrict map bounds to geofence area - better UI/UX */}
        {polygon.length > 3 && <MapBoundsRestriction enabled={true} minZoom={11} maxZoom={18} />}

        {/* Volunteer markers */}
        {volunteers.map((v) => {
          const key = v.id ? v.id : `${v.lat},${v.lng}`
          const addr = addresses[key]
          return (
            <Marker key={key} position={[v.lat, v.lng]} icon={createVolunteerIcon()}>
              <Popup>
                <div className="p-1 text-sm">
                  <div className="font-semibold">{v.name}</div>
                  <div className="text-gray-600">{v.role}</div>
                  <div className="text-gray-500 mt-1">
                    {addr || "Resolving address…"}
                  </div>
                  <div className="text-gray-400 mt-1">
                    {v.lat.toFixed(6)}, {v.lng.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Placeholder message overlay */}
      {statusMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-3 py-1.5 rounded shadow text-sm text-gray-700">
          {statusMessage}
        </div>
      )}
    </div>
  )
}

// (Removed PolygonOverlay in favor of declarative <Polygon />)

function createVolunteerIcon() {
  const html = `<div style="background:#10b981;width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.25)"></div>`
  return L.divIcon({
    html,
    className: "volunteer-marker",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  })
}
