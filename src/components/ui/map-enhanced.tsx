"use client"

import type React from "react"
import { useEffect, useState, useRef, useMemo, memo, useCallback } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle, Circle, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER, isWithinTalisayCity } from "@/lib/geo-utils"
import { useRealtimeVolunteerLocations } from "@/hooks/use-realtime-volunteer-locations"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"

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
const createCustomIcon = (color: string, type: "incident" | "volunteer" | "user", isActive = false) => {
  const pulseClass = isActive ? "animate-pulse" : ""
  const size = type === "volunteer" ? "20px" : "25px"

  const iconHtml =
    type === "volunteer"
      ? `<div class="${pulseClass}" style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); position: relative;">
           ${
             isActive
               ? '<div style="position: absolute; top: -5px; left: -5px; width: 30px; height: 30px; border-radius: 50%; background-color: ' +
                 color +
                 '; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
               : ""
           }
         </div>`
      : `<div class="${pulseClass}" style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker",
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

const getIncidentColor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "#ef4444"
    case "ASSIGNED":
      return "#f59e0b"
    case "RESPONDING":
      return "#3b82f6"
    case "RESOLVED":
      return "#10b981"
    case "CANCELLED":
      return "#6b7280"
    default:
      return "#6b7280"
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
    radiusKm: 10,
    enabled: showVolunteerLocations
  })

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
      {volunteerLocations.map((volunteer) => {
        const prev = previousVolunteers.get(volunteer.user_id)
        const isNewOrMoved = !prev || prev.latitude !== volunteer.latitude || prev.longitude !== volunteer.longitude

        return (
          <AnimatedMarker
            key={volunteer.user_id}
            position={[volunteer.latitude, volunteer.longitude]}
            icon={createCustomIcon("#10b981", "volunteer", isNewOrMoved)}
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
    <AnimatedMarker position={userPosition} icon={createCustomIcon("#3b82f6", "user")} animate duration={600}>
      <Popup>
        <div className="p-2">
          <h3 className="font-semibold text-sm">Your Location</h3>
          <p className="text-xs text-gray-600">
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
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md">
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} ref={mapRef}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <RecenterMap center={center} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* City boundary */}
        {showBoundary && (
          <Rectangle
            bounds={[
              [10.6, 122.8],
              [10.8, 123.0]
            ]}
            pathOptions={{
              color: "#3b82f6",
              weight: 2,
              fillColor: "transparent",
              fillOpacity: 0
            }}
          />
        )}

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
        {memoizedMarkers.map((marker) => (
          <AnimatedMarker
            key={marker.id}
            position={marker.position}
            icon={createCustomIcon(getIncidentColor(marker.status), "incident")}
            animate
            duration={500}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-sm text-gray-900">{marker.title}</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Status:{" "}
                  <span
                    className={`font-medium ${
                      marker.status === "RESOLVED"
                        ? "text-green-600"
                        : marker.status === "RESPONDING"
                        ? "text-blue-600"
                        : marker.status === "ASSIGNED"
                        ? "text-yellow-600"
                        : marker.status === "PENDING"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {marker.status}
                  </span>
                </p>
                {marker.description && (
                  <p className="text-xs text-gray-500 mt-1">{marker.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
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
        ))}

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
