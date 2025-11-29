"use client"

import type React from "react"
import { useEffect, useState, useRef, useMemo, memo, useCallback } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle, Circle, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER, isWithinTalisayCity } from "@/lib/geo-utils"
import { useRealtimeVolunteerLocations } from "@/hooks/use-realtime-volunteer-locations"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { createCustomIcon as createSharedIcon, getIncidentColor as getSharedIncidentColor, createVolunteerIcon, createUserIcon, createTeardropPinIcon } from "@/lib/map-icons"

// ------------------------------
// Animated Marker
// ------------------------------
interface AnimatedMarkerProps {
  position: [number, number]
  icon: L.DivIcon
  children?: React.ReactNode
  animate?: boolean
  duration?: number
}

const AnimatedMarker = memo(({ position, icon, children, animate = true, duration = 1000 }: AnimatedMarkerProps) => {
  const markerRef = useRef<L.Marker>(null)

  useEffect(() => {
    if (markerRef.current && animate) {
      const marker = markerRef.current
      const element = marker.getElement()

      if (element) {
        element.style.transition = `transform ${duration}ms ease-out`
        element.style.transform = "scale(1.2)"
        setTimeout(() => {
          element.style.transform = "scale(1)"
        }, 50)
      }
    }
  }, [position, animate, duration])

  return (
    <Marker ref={markerRef} position={position} icon={icon}>
      {children}
    </Marker>
  )
})

AnimatedMarker.displayName = "AnimatedMarker"

// ------------------------------
// Talisay City Boundary Component (GeoJSON)
// ------------------------------
function TalisayCityBoundary() {
  const map = useMap()
  const boundaryLayerRef = useRef<L.GeoJSON<any> | null>(null)
  
  useEffect(() => {
    if (!map || !map.getContainer) return
    
    // Helper to check if map panes are ready
    const isMapReady = () => {
      try {
        const container = map.getContainer()
        if (!container || !(container as any)._leaflet_id) return false
        
        // Check if map panes exist and are ready
        const panes = (map as any)._panes
        if (!panes || !panes.mapPane) return false
        
        return true
      } catch {
        return false
      }
    }
    
    // Wait for map to be ready before loading boundary
    const loadBoundary = () => {
      try {
        if (!isMapReady()) {
          // Map not ready, retry
          setTimeout(loadBoundary, 100)
          return
        }
      } catch (err) {
        return
      }
      
      // Load GeoJSON boundary
      fetch('/talisay.geojson')
        .then(response => response.json())
        .then(data => {
          // Basic validation for GeoJSON
          const isFeatureCollection = data && data.type === 'FeatureCollection' && Array.isArray(data.features)
          const isFeature = data && data.type === 'Feature' && data.geometry
          if (!isFeatureCollection && !isFeature) {
            throw new Error('Loaded file is not valid GeoJSON (Feature/FeatureCollection)')
          }

          // Remove previous boundary layer if any
          if (boundaryLayerRef.current && map.removeLayer) {
            try {
              map.removeLayer(boundaryLayerRef.current)
            } catch (err) {
              // Ignore errors when removing layer
            }
            boundaryLayerRef.current = null
          }

          try {
            const geoJsonLayer = L.geoJSON(data, {
              style: {
                color: '#3b82f6',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.1
              }
            }).addTo(map)

            boundaryLayerRef.current = geoJsonLayer

            // Expose polygon coordinates (lat, lng) globally for guards if available
            try {
              const first = (data.type === 'FeatureCollection' ? data.features?.[0] : data) as any
              const geom = first?.geometry
              if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
                // GeoJSON is [lng, lat]; convert to [lat, lng]
                const ring = geom.coordinates[0]
                  .map((pt: number[]) => [pt[1], pt[0]])
                  .filter((pt: any) => Array.isArray(pt) && pt.length === 2)
                if (ring.length > 3 && typeof window !== 'undefined') {
                  ;(window as any).__TALISAY_POLYGON__ = ring as [number, number][]
                }
              }
            } catch (err) {
              console.error('Failed to expose polygon coordinates:', err)
            }

            // Fit map to boundary bounds once loaded
            try {
              const bounds = geoJsonLayer.getBounds()
              if (bounds && bounds.isValid() && map.fitBounds) {
                map.fitBounds(bounds, { padding: [20, 20] })
              }
            } catch (err) {
              console.error('Failed to fit bounds to boundary:', err)
            }
          } catch (err) {
            console.error('Failed to add boundary layer to map:', err)
          }
        })
        .catch(error => {
          console.error('Error loading boundary:', error)
        })
    }
    
    loadBoundary()
    
    return () => {
      if (boundaryLayerRef.current && map && map.removeLayer) {
        try {
          map.removeLayer(boundaryLayerRef.current)
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      boundaryLayerRef.current = null
    }
  }, [map])
  
  return null
}

// ------------------------------
// Heatmap Overlay
// ------------------------------
function HeatmapOverlay() {
  const [points, setPoints] = useState<Array<{ lat: number; lng: number; weight: number }>>([])
  const map = useMap()

  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch("/api/analytics/hotspots?days=30")
        const json = await res.json()
        if (!canceled && res.ok && json.success) {
          const pts = (json.data || []).map((r: any) => ({
            lat: r.lat || TALISAY_CENTER[0],
            lng: r.lng || TALISAY_CENTER[1],
            weight: r.count || 1
          }))
          setPoints(pts.slice(0, 500))
        }
      } catch (err) {
        console.error("Failed to fetch hotspots:", err)
      }
    })()
    return () => {
      canceled = true
    }
  }, [map])

  return (
    <>
      {points.map((p, idx) => (
        <Circle
          key={idx}
          center={[p.lat, p.lng] as [number, number]}
          radius={Math.min(150 + p.weight * 30, 1000)}
          pathOptions={{
            color: "transparent",
            fillColor: "rgba(239,68,68,0.35)",
            fillOpacity: 0.35
          }}
        />
      ))}
    </>
  )
}

// ------------------------------
// Helpers and Icon Creation
// ------------------------------
const createCustomIcon = (color: string, type: "incident" | "volunteer" | "user", isActive = false, status?: string) => {
  // For volunteers, keep the enhanced circular design with pulse animation
  if (type === "volunteer") {
    const pulseClass = isActive ? "animate-pulse" : ""
    const size = 32
    const borderWidth = 4
    const shadow = "0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)"
    
    const statusIndicator = status 
      ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; border-radius: 50%; background-color: white; border: 2px solid ${color};"></div>`
      : ""

    const iconHtml = `
      <div class="${pulseClass}" style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${borderWidth}px solid white; box-shadow: ${shadow}; position: relative; z-index: 1000;">
        ${statusIndicator}
        ${
          isActive
            ? `<div style="position: absolute; top: -8px; left: -8px; width: 48px; height: 48px; border-radius: 50%; background-color: ${color}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: -1;"></div>`
            : ""
        }
      </div>
    `

    return L.divIcon({
      html: iconHtml,
      className: "custom-marker",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    })
  }

  // For incidents and user, use the shared teardrop pin
  return createSharedIcon(color, type, status)
}

const getIncidentColor = getSharedIncidentColor

// Get volunteer color based on status
const getVolunteerColor = (status?: string): string => {
  if (!status) return "#10b981" // Default green for available
  switch (status.toLowerCase()) {
    case "available":
      return "#22c55e" // Bright green
    case "on_task":
      return "#3b82f6" // Bright blue
    case "offline":
      return "#9ca3af" // Gray
    case "unavailable":
      return "#ef4444" // Red
    default:
      return "#10b981" // Default green
  }
}

// ------------------------------
// Map Helpers
// ------------------------------
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])

  return null
}

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e: L.LeafletMouseEvent) => {
      onMapClick?.(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

// ------------------------------
// Volunteer Locations (FIXED)
// ------------------------------
function VolunteerLocations({
  showVolunteerLocations,
  showRealtimeStatus
}: {
  showVolunteerLocations?: boolean
  showRealtimeStatus?: boolean
}) {
  const map = useMap()
  const center = map.getCenter()
  const [previousVolunteers, setPreviousVolunteers] = useState<Map<string, any>>(new Map())

  const {
    volunteers: volunteerLocations,
    isConnected,
    connectionStatus,
    error
  } = useRealtimeVolunteerLocations({
    center: [center.lat, center.lng],
    radiusKm: 50, // Increased radius to show all volunteers
    enabled: showVolunteerLocations
  })

  // Debug logging
  useEffect(() => {
    if (showVolunteerLocations) {
      console.log('[Map] Real-time volunteer locations:', {
        count: volunteerLocations.length,
        isConnected,
        connectionStatus,
        error,
        volunteers: volunteerLocations.map(v => ({
          id: v.user_id,
          name: `${v.first_name} ${v.last_name}`,
          position: [v.latitude, v.longitude]
        }))
      })
    }
  }, [volunteerLocations, isConnected, connectionStatus, error, showVolunteerLocations])

  // ✅ FIXED EFFECT - prevents infinite re-renders
  useEffect(() => {
    setPreviousVolunteers((prev) => {
      const current = new Map()
      volunteerLocations.forEach((v) => current.set(v.user_id, v))

      const hasChanges =
        volunteerLocations.length !== prev.size ||
        volunteerLocations.some((v) => {
          const p = prev.get(v.user_id)
          return !p || p.latitude !== v.latitude || p.longitude !== v.longitude
        })

      return hasChanges ? current : prev
    })
  }, [volunteerLocations])

  return (
    <>
      {/* Realtime Status Indicator */}
      {showRealtimeStatus && (
        <div className="absolute top-4 right-4 z-[1000]">
          <RealtimeStatusIndicator status={connectionStatus} size="sm" />
        </div>
      )}

      {/* Volunteer Markers */}
      {volunteerLocations.length === 0 && showVolunteerLocations && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-yellow-100 border border-yellow-300 rounded-lg p-3 max-w-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-yellow-700">No real-time locations found</span>
          </div>
          <p className="text-xs text-yellow-600 mt-1">
            Status: {connectionStatus} | Connected: {isConnected ? 'Yes' : 'No'}
            {error && ` | Error: ${error}`}
          </p>
        </div>
      )}
      {volunteerLocations.map((volunteer) => {
        const prev = previousVolunteers.get(volunteer.user_id)
        const isNewOrMoved = !prev || prev.latitude !== volunteer.latitude || prev.longitude !== volunteer.longitude
        
        // Get status from volunteer data (check multiple possible fields)
        const volunteerStatus = (volunteer as any).status || (volunteer as any).volunteer_status || 'available'
        const volunteerColor = getVolunteerColor(volunteerStatus)

        return (
          <AnimatedMarker
            key={volunteer.user_id}
            position={[volunteer.latitude, volunteer.longitude]}
            icon={createCustomIcon(volunteerColor, "volunteer", isNewOrMoved, volunteerStatus)}
            animate={isNewOrMoved}
            duration={800}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-sm text-gray-900">
                  {volunteer.first_name} {volunteer.last_name}
                </h3>

                {volunteer.distance_km && (
                  <p className="text-xs text-gray-600 mt-1">
                    📍 Distance: {volunteer.distance_km.toFixed(1)} km
                  </p>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  🕒 Last seen: {new Date(volunteer.last_seen).toLocaleTimeString()}
                </p>

                {volunteer.phone_number && (
                  <p className="text-xs text-blue-600 mt-1">📞 {volunteer.phone_number}</p>
                )}

                {volunteer.accuracy && (
                  <p className="text-xs text-gray-500 mt-1">🎯 Accuracy: ±{volunteer.accuracy.toFixed(0)}m</p>
                )}

                {volunteer.speed && volunteer.speed > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    🚗 Speed: {(volunteer.speed * 3.6).toFixed(1)} km/h
                  </p>
                )}
              </div>
            </Popup>
          </AnimatedMarker>
        )
      })}

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-red-100 border border-red-300 rounded-lg p-3 max-w-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-red-500 rounded-full"></div>
            <span className="text-sm text-red-700">Connection Error</span>
          </div>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      )}
    </>
  )
}

// ------------------------------
// User Location
// ------------------------------
function UserLocation({ showUserLocation }: { showUserLocation?: boolean }) {
  const map = useMap()
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!showUserLocation || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        if (isWithinTalisayCity(latitude, longitude)) {
          setUserPosition([latitude, longitude])
        }
      },
      (error) => console.warn("Geolocation error:", error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [showUserLocation])

  if (!userPosition) return null

  return (
    <AnimatedMarker position={userPosition} icon={createUserIcon()} animate duration={600}>
      <Popup className="user-location-popup">
        <div className="p-3 min-w-[180px]">
          <h3 className="font-semibold text-base text-gray-900 mb-1">Your Location</h3>
          <p className="text-sm text-gray-600 mt-2">
            📍 {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}
          </p>
        </div>
      </Popup>
    </AnimatedMarker>
  )
}

// ------------------------------
// Main Map Component
// ------------------------------
interface MapComponentProps {
  center?: [number, number]
  zoom?: number
  markers?: Array<{
    id: string
    position: [number, number]
    status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
    title: string
    description?: string
    onClick?: (id: string) => void
  }>
  height?: string
  onMapClick?: (lat: number, lng: number) => void
  userLocation?: boolean
  showBoundary?: boolean
  showGeofence?: boolean
  offlineMode?: boolean
  showVolunteerLocations?: boolean
  showHeatmap?: boolean
  showRealtimeStatus?: boolean
}

const MapInternal: React.FC<MapComponentProps> = ({
  center = TALISAY_CENTER,
  zoom = 13,
  markers = [],
  height = "500px",
  onMapClick,
  userLocation = false,
  showBoundary = true,
  showGeofence = false,
  showVolunteerLocations = false,
  showHeatmap = false,
  showRealtimeStatus = true
}) => {
  const mapRef = useRef<L.Map>(null)
  const memoizedMarkers = useMemo(() => markers, [markers])

  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md relative z-0">
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} ref={mapRef}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <RecenterMap center={center} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* City boundary - using GeoJSON like map-internal.tsx */}
        {showBoundary && <TalisayCityBoundary />}

        {/* Geofence circles */}
        {showGeofence && (
          <>
            <Circle
              center={TALISAY_CENTER}
              radius={5000}
              pathOptions={{
                color: "#10b981",
                weight: 2,
                fillColor: "transparent",
                fillOpacity: 0
              }}
            />
            <Circle
              center={TALISAY_CENTER}
              radius={10000}
              pathOptions={{
                color: "#f59e0b",
                weight: 2,
                fillColor: "transparent",
                fillOpacity: 0
              }}
            />
          </>
        )}

        {/* Heatmap */}
        {showHeatmap && <HeatmapOverlay />}

        {/* Incident markers */}
        {memoizedMarkers.map((marker) => {
          // Check if this is a volunteer marker (from fallback) or incident marker
          const isVolunteerMarker = marker.id?.startsWith('volunteer_') || marker.id?.startsWith('history_')
          const markerColor = isVolunteerMarker 
            ? getVolunteerColor(marker.status?.toLowerCase() || 'available')
            : getIncidentColor(marker.status)
          const markerType = isVolunteerMarker ? "volunteer" : "incident"
          
          return (
            <AnimatedMarker
              key={marker.id}
              position={marker.position}
              icon={createCustomIcon(markerColor, markerType, false, marker.status?.toLowerCase())}
              animate
              duration={500}
            >
              <Popup className="incident-popup">
                <div className="p-3 min-w-[200px]">
                  <h3 className="font-semibold text-base text-gray-900 mb-1">{marker.title}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      marker.status === 'PENDING' ? 'bg-red-100 text-red-800' :
                      marker.status === 'ASSIGNED' ? 'bg-amber-100 text-amber-800' :
                      marker.status === 'RESPONDING' ? 'bg-blue-100 text-blue-800' :
                      marker.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {marker.status}
                    </span>
                  </div>
                  {marker.description && (
                    <p className="text-sm text-gray-700 mt-2 mb-2 leading-relaxed">{marker.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                    📍 {marker.position[0].toFixed(6)}, {marker.position[1].toFixed(6)}
                  </p>
                  {marker.onClick && (
                    <button
                      onClick={() => marker.onClick?.(marker.id)}
                      className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </Popup>
            </AnimatedMarker>
          )
        })}

        {/* User and Volunteer Locations */}
        <UserLocation showUserLocation={userLocation} />
        <VolunteerLocations
          showVolunteerLocations={showVolunteerLocations}
          showRealtimeStatus={showRealtimeStatus}
        />
      </MapContainer>
    </div>
  )
}

export default memo(MapInternal)
