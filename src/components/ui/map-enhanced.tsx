"use client"

import type React from "react"
import { useEffect, useState, useRef, useMemo, memo, useCallback } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle, Circle, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER, isWithinTalisayCity } from "@/lib/geo-utils"
import { useRealtimeVolunteerLocations } from "@/hooks/use-realtime-volunteer-locations"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { MapPin } from "lucide-react"

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
const createCustomIcon = (color: string, type: "incident" | "volunteer" | "user", isActive = false, status?: string) => {
  const pulseClass = isActive ? "animate-pulse" : ""
  
  // Larger, more visible sizes - make volunteers even bigger for better visibility
  const size = type === "volunteer" ? "36px" : type === "user" ? "28px" : "30px"
  const borderWidth = type === "volunteer" ? "5px" : "3px"
  
  // Enhanced shadow for better visibility
  const shadow = "0 6px 16px rgba(0,0,0,0.5), 0 3px 6px rgba(0,0,0,0.4)"
  
  // Status-based icon shape and indicator for volunteers
  let statusIcon = ""
  let statusShape = "50%" // Default circle
  
  if (type === "volunteer" && status) {
    const statusLower = status.toLowerCase()
    // Different shapes for different statuses
    if (statusLower === "available") {
      statusShape = "50%" // Circle
      statusIcon = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; border-radius: 50%; background-color: white; border: 3px solid ${color};"></div>`
    } else if (statusLower === "on_task") {
      statusShape = "20% 20% 20% 20%" // Rounded square
      statusIcon = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(45deg); width: 18px; height: 18px; background-color: white; border: 2px solid ${color};"></div>`
    } else if (statusLower === "offline") {
      statusShape = "50%" // Circle with X
      statusIcon = `<div style="position: absolute; top: 50%; left: 50%; width: 18px; height: 2px; background-color: white; transform: translate(-50%, -50%) rotate(45deg);"></div><div style="position: absolute; top: 50%; left: 50%; width: 18px; height: 2px; background-color: white; transform: translate(-50%, -50%) rotate(-45deg);"></div>`
    } else if (statusLower === "unavailable") {
      statusShape = "50%" // Circle with minus
      statusIcon = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 3px; background-color: white; border-radius: 2px;"></div>`
    }
  }

  const iconHtml =
    type === "volunteer"
      ? `<div class="${pulseClass}" style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: ${statusShape}; border: ${borderWidth} solid white; box-shadow: ${shadow}; position: relative; z-index: 1000;">
           ${statusIcon}
           ${
             isActive
               ? '<div style="position: absolute; top: -10px; left: -10px; width: 56px; height: 56px; border-radius: 50%; background-color: ' +
                 color +
                 '; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: -1;"></div>'
               : ""
           }
         </div>`
      : type === "user"
      ? `<div class="${pulseClass}" style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: 50%; border: ${borderWidth} solid white; box-shadow: ${shadow}; position: relative; z-index: 1000;">
           <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 50%; background-color: white;"></div>
         </div>`
      : `<div class="${pulseClass}" style="background-color: ${color}; width: ${size}; height: ${size}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: ${borderWidth} solid white; box-shadow: ${shadow}; position: relative; z-index: 1000;"></div>`

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker",
    iconSize: type === "volunteer" ? [40, 40] : type === "user" ? [36, 36] : [34, 34],
    iconAnchor: type === "volunteer" ? [20, 20] : type === "user" ? [18, 18] : [17, 17],
    popupAnchor: type === "volunteer" ? [0, -20] : [0, -18]
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
        const volunteerStatus = (volunteer as any).status || (volunteer as any).realtime_status || (volunteer as any).volunteer_status || 'offline'
        const volunteerColor = getVolunteerColor(volunteerStatus)
        
        // Debug logging to verify status is being passed
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Map] Volunteer ${volunteer.user_id}: status=${volunteerStatus}, color=${volunteerColor}`)
        }

        return (
          <AnimatedMarker
            key={volunteer.user_id}
            position={[volunteer.latitude, volunteer.longitude]}
            icon={createCustomIcon(volunteerColor, "volunteer", isNewOrMoved, volunteerStatus)}
            animate={isNewOrMoved}
            duration={800}
          >
            <Popup>
              <div className="p-3 bg-white shadow-lg min-w-[240px]">
                <h3 className="font-bold text-base text-gray-900 mb-2">
                  {volunteer.first_name} {volunteer.last_name}
                </h3>

                {/* Status Badge */}
                <div className="mb-3">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                    volunteerStatus === 'available' ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                    volunteerStatus === 'on_task' ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' :
                    volunteerStatus === 'offline' ? 'bg-gray-100 text-gray-800 border-2 border-gray-300' :
                    'bg-red-100 text-red-800 border-2 border-red-300'
                  }`}>
                    Status: {volunteerStatus === 'available' ? 'Available' :
                            volunteerStatus === 'on_task' ? 'On Task' :
                            volunteerStatus === 'offline' ? 'Offline' :
                            'Unavailable'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {volunteer.distance_km && (
                    <div className="flex items-center gap-2 text-sm text-gray-800 font-medium">
                      <MapPin className="h-4 w-4 text-gray-700 flex-shrink-0" />
                      <span>Distance: <span className="font-semibold text-gray-900">{volunteer.distance_km.toFixed(1)} km</span></span>
                    </div>
                  )}

                  <p className="text-sm text-gray-800 font-medium">
                    🕒 Last seen: <span className="font-semibold text-gray-900">{new Date(volunteer.last_seen).toLocaleTimeString()}</span>
                  </p>

                  {volunteer.phone_number && (
                    <p className="text-sm text-blue-700 font-medium">
                      📞 <span className="font-semibold">{volunteer.phone_number}</span>
                    </p>
                  )}

                  {volunteer.accuracy && (
                    <p className="text-sm text-gray-800 font-medium">
                      🎯 Accuracy: <span className="font-semibold text-gray-900">±{volunteer.accuracy.toFixed(0)}m</span>
                    </p>
                  )}

                  {volunteer.speed && volunteer.speed > 0 && (
                    <p className="text-sm text-green-700 font-medium">
                      🚗 Speed: <span className="font-semibold">{(volunteer.speed * 3.6).toFixed(1)} km/h</span>
                    </p>
                  )}
                </div>
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
        <div className="p-3 bg-white shadow-lg min-w-[220px]">
          <h3 className="font-bold text-base text-gray-900 mb-2">Your Location</h3>
          <div className="flex items-start gap-2 bg-gray-50 p-2.5 rounded border border-gray-200">
            <MapPin className="h-4 w-4 text-gray-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 mb-1">Coordinates</p>
              <p className="text-xs font-mono text-gray-900 break-all font-semibold">
                {userPosition[0].toFixed(6)}, {userPosition[1].toFixed(6)}
              </p>
            </div>
          </div>
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
              <Popup>
                <div className="p-3 bg-white shadow-lg min-w-[240px]">
                  <h3 className="font-bold text-base text-gray-900 mb-2">{marker.title}</h3>
                  
                  {/* Status display - handle both volunteer and incident statuses */}
                  {isVolunteerMarker ? (
                    <div className="mb-3">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                        marker.status?.toLowerCase() === 'available' ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                        marker.status?.toLowerCase() === 'on_task' ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' :
                        marker.status?.toLowerCase() === 'offline' ? 'bg-gray-100 text-gray-800 border-2 border-gray-300' :
                        'bg-red-100 text-red-800 border-2 border-red-300'
                      }`}>
                        Status: {marker.status === 'available' ? 'Available' :
                                marker.status === 'on_task' ? 'On Task' :
                                marker.status === 'offline' ? 'Offline' :
                                marker.status === 'unavailable' ? 'Unavailable' : marker.status}
                      </span>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                        marker.status === "RESOLVED"
                          ? "bg-green-100 text-green-800 border-2 border-green-300"
                          : marker.status === "RESPONDING"
                          ? "bg-blue-100 text-blue-800 border-2 border-blue-300"
                          : marker.status === "ASSIGNED"
                          ? "bg-amber-100 text-amber-800 border-2 border-amber-300"
                          : marker.status === "PENDING"
                          ? "bg-red-100 text-red-800 border-2 border-red-300"
                          : "bg-gray-100 text-gray-800 border-2 border-gray-300"
                      }`}>
                        {marker.status}
                      </span>
                    </div>
                  )}
                  
                  {marker.description && (() => {
                    // Clean up description: remove excessive newlines, normalize whitespace, remove coordinates
                    const cleanedDescription = marker.description
                      .trim()
                      .replace(/\n+/g, ' ')
                      .replace(/\s+/g, ' ')
                      .replace(/\b\d+\.\d{6,}\b/g, '')
                      .trim()
                    
                    return cleanedDescription ? (
                      <p className="text-sm text-gray-800 mt-2 leading-relaxed whitespace-normal break-words">
                        {cleanedDescription}
                      </p>
                    ) : null
                  })()}
                  <div className="mt-3 flex items-start gap-2 bg-gray-50 p-2.5 rounded border border-gray-200">
                    <MapPin className="h-4 w-4 text-gray-700 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Location</p>
                      <p className="text-xs font-mono text-gray-900 break-all font-semibold">
                        {marker.position[0].toFixed(6)}, {marker.position[1].toFixed(6)}
                      </p>
                    </div>
                  </div>
                  {marker.onClick && (
                    <button
                      onClick={() => marker.onClick?.(marker.id)}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors shadow-sm"
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
