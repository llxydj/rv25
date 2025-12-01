"use client"

import type React from "react"
import { useEffect, useState, useRef, useMemo, memo } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle, Circle, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER, isWithinTalisayCity } from "@/lib/geo-utils"

function HeatmapOverlay() {
  const [points, setPoints] = useState<Array<{ lat: number; lng: number; weight: number }>>([])
  const map = useMap()

  useEffect(() => {
    let canceled = false
    
    // Wait for map to be ready before loading data
    const checkMapReady = () => {
      try {
        if (!map || !map.getContainer) return false
        const container = map.getContainer()
        if (!container || !(container as any)._leaflet_id) return false
        const panes = (map as any)._panes
        if (!panes || !panes.mapPane) return false
        return true
      } catch {
        return false
      }
    }
    
    const loadHotspots = async () => {
      try {
        // Load hotspots (last 30 days)
        const res = await fetch('/api/analytics/hotspots?days=30')
        const json = await res.json()
        if (!canceled && res.ok && json.success) {
          const pts = (json.data || []).map((r: any) => ({ 
            lat: r.lat || TALISAY_CENTER[0], 
            lng: r.lng || TALISAY_CENTER[1], 
            weight: r.count || 1 
          }))
          // Cap to first 500 points for rendering performance
          setPoints(pts.slice(0, 500))
        }
      } catch (err) {
        console.error('Failed to fetch hotspots:', err)
      }
    }
    
    if (!checkMapReady()) {
      // Retry after a short delay
      const timeout = setTimeout(() => {
        if (checkMapReady()) {
          loadHotspots()
        }
      }, 200)
      return () => {
        canceled = true
        clearTimeout(timeout)
      }
    }
    
    loadHotspots()
    return () => { canceled = true }
  }, [map])

  // Simple circle-based heat approximation
  return (
    <>
      {points.map((p, idx) => (
        <Circle
          key={idx}
          center={[p.lat, p.lng] as [number, number]}
          radius={Math.min(150 + p.weight * 30, 1000)}
          pathOptions={{ color: 'transparent', fillColor: 'rgba(239,68,68,0.35)', fillOpacity: 0.35 }}
        />
      ))}
    </>
  )
}

import { locationTrackingService, LocationData } from "@/lib/location-tracking"
import { useRealtimeVolunteerLocations } from "@/hooks/use-realtime-volunteer-locations"
import { createCustomIcon, getIncidentColor, createVolunteerIcon, createUserIcon } from "@/lib/map-icons"
import { FitBoundsToMarkers } from "./map-fit-bounds"
import { MapBoundsRestriction } from "./map-bounds-restriction"

// Keep the same props interface
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
}

// Recenter map component
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap()
  
  useEffect(() => {
    // Guard against accessing map when it's not ready
    if (!map || !map.getContainer || !map.setView) return
    
    // Helper to check if map panes are ready
    const isMapReady = () => {
      try {
        const container = map.getContainer()
        if (!container || !(container as any)._leaflet_id) return false
        
        // Check if map panes exist and are ready
        const panes = (map as any)._panes
        if (!panes) return false
        
        // Check if the map pane exists and has the required property
        const mapPane = panes.mapPane
        if (!mapPane) return false
        
        // Check if map is not currently in a transition
        const isTransitioning = (map as any)._zooming || (map as any)._animatingZoom
        if (isTransitioning) return false
        
        return true
      } catch {
        return false
      }
    }
    
    // Use a small delay to ensure map is fully initialized
    // This prevents errors during zoom transitions when DOM elements might not be ready
    let retryTimeout: NodeJS.Timeout | null = null
    const timeout = setTimeout(() => {
      try {
        if (!isMapReady()) {
          // If not ready, retry after a short delay
          retryTimeout = setTimeout(() => {
            try {
              if (isMapReady()) {
                map.setView(center, map.getZoom(), { animate: false })
              }
            } catch (err) {
              // Silently handle errors during map initialization/transitions
            }
          }, 200)
          return
        }
        
        // Use animate: false to prevent conflicts with ongoing transitions
        map.setView(center, map.getZoom(), { animate: false })
      } catch (err) {
        // Silently handle errors during map initialization/transitions
        // This prevents crashes when map is accessing _leaflet_pos during transitions
      }
    }, 150)
    
    return () => {
      clearTimeout(timeout)
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
    }
  }, [center, map])
  
  return null
}

// Talisay City boundary component
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

// Map click handler
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    }
  })
  return null
}

// Real-time volunteer locations component - FIXED VERSION
function VolunteerLocations({ showVolunteerLocations }: { showVolunteerLocations?: boolean }) {
  const map = useMap()
  
  // Helper to check if map is ready
  const isMapReady = () => {
    try {
      if (!map || !map.getContainer || !map.getCenter) return false
      const container = map.getContainer()
      if (!container || !(container as any)._leaflet_id) return false
      const panes = (map as any)._panes
      if (!panes || !panes.mapPane) return false
      return true
    } catch {
      return false
    }
  }
  
  // Get map center once and memoize it to prevent infinite re-renders
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    try {
      if (!isMapReady()) return TALISAY_CENTER
      const center = map.getCenter()
      return [center.lat, center.lng]
    } catch (err) {
      console.warn('Failed to get initial map center:', err)
      return TALISAY_CENTER
    }
  })

  // Update map center only when the map moves (not on every render)
  useEffect(() => {
    if (!map || !map.getCenter || !map.on) return
    
    const handleMoveEnd = () => {
      try {
        if (!isMapReady()) return
        const center = map.getCenter()
        setMapCenter([center.lat, center.lng])
      } catch (err) {
        console.warn('Failed to update map center:', err)
      }
    }

    map.on('moveend', handleMoveEnd)
    
    return () => {
      try {
        if (map && map.off) {
          map.off('moveend', handleMoveEnd)
        }
      } catch (err) {
        console.warn('Failed to remove moveend listener:', err)
      }
    }
  }, [map])

  // Use real-time hook with stable center value
  const { volunteers: volunteerLocations, isConnected } = useRealtimeVolunteerLocations({
    center: mapCenter,
    radiusKm: 10,
    enabled: showVolunteerLocations
  })

  if (!showVolunteerLocations) return null

  return (
    <>
      {volunteerLocations.map((volunteer) => (
        <Marker
          key={volunteer.user_id}
          position={[volunteer.latitude, volunteer.longitude]}
          icon={createVolunteerIcon('#10b981')}
        >
          <Popup className="volunteer-popup">
            <div className="p-3 min-w-[200px]">
              <h3 className="font-semibold text-base text-gray-900 mb-2">
                {volunteer.first_name} {volunteer.last_name}
              </h3>
              {volunteer.distance_km && (
                <p className="text-sm text-gray-700 mb-1">
                  📏 Distance: <span className="font-medium">{volunteer.distance_km.toFixed(1)} km</span>
                </p>
              )}
              <p className="text-xs text-gray-600 mb-2">
                🕒 Last seen: {new Date(volunteer.last_seen).toLocaleTimeString()}
              </p>
              {volunteer.phone_number && (
                <p className="text-sm text-blue-600 font-medium">
                  📞 {volunteer.phone_number}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

// Export as default for dynamic import
const MapInternal: React.FC<MapComponentProps> = ({
  center = TALISAY_CENTER,
  zoom = 13,
  markers = [],
  height = "500px",
  onMapClick,
  userLocation = false,
  showBoundary = false,
  showGeofence = false,
  offlineMode = false,
  showVolunteerLocations = false,
  showHeatmap = false,
}) => {
  const [userLocationState, setUserLocationState] = useState<[number, number] | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  // Ref to the container; we avoid dynamic keys to prevent forced remounts
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const [rafReady, setRafReady] = useState(false)

  // Ensure we only render MapContainer after client mount and pre-clean
  useEffect(() => {
    setMounted(true)
    const c = containerRef.current as any
    if (c && (c.querySelector?.('.leaflet-container') || (c as any)._leaflet_id)) {
      try {
        (c as any)._leaflet_id = null
        c.innerHTML = ''
      } catch (err) {
        console.error('Failed to pre-clean leaflet container:', err)
      }
    }
    // Mark ready after pre-clean, in next tick to ensure DOM is flushed
    const t = setTimeout(() => {
      const cc = containerRef.current as any
      if (cc && (cc.querySelector?.('.leaflet-container') || (cc as any)._leaflet_id)) {
        try {
          (cc as any)._leaflet_id = null
          cc.innerHTML = ''
        } catch (err) {
          console.error('Failed to clean leaflet container (defer):', err)
        }
      }
      setContainerReady(true)
    }, 0)
    return () => {
      // Clear any residual leaflet markup on unmount to avoid re-init errors in dev
      if (containerRef.current) {
        containerRef.current.innerHTML = ""
      }
      clearTimeout(t)
    }
  }, [])

  // If a previous Leaflet instance attaches later (HMR), clear it
  useEffect(() => {
    const c = containerRef.current as any
    if (!c) return
    if ((c as any)._leaflet_id || c.querySelector?.('.leaflet-container')) {
      try {
        (c as any)._leaflet_id = null
        c.innerHTML = ''
      } catch (err) {
        console.error('Failed to clean leaflet container (HMR):', err)
      }
    }
  }, [mounted])

  // Defer first render to next animation frame to let any pending cleanups finish
  useEffect(() => {
    let rafId = 0
    if (mounted && containerReady) {
      rafId = requestAnimationFrame(() => setRafReady(true))
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [mounted, containerReady])

  // Fix Leaflet icon issue - ensure default icons work
  useEffect(() => {
    try {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })
      console.log('[MapInternal] Leaflet default icons configured')
    } catch (error) {
      console.error('[MapInternal] Failed to configure Leaflet icons:', error)
    }
  }, [])

  // Get user location
  useEffect(() => {
    if (!userLocation) return

    const getCurrentLocation = () => {
      setIsLoadingLocation(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setUserLocationState([lat, lng])
          setIsLoadingLocation(false)
        },
        (error) => {
          // Better diagnostics and a graceful fallback to city center
          try {
            console.error('Error getting location:', { code: error?.code, message: error?.message })
          } catch {
            console.error('Error getting location (unknown)')
          }
          setUserLocationState(TALISAY_CENTER)
          setIsLoadingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      )
    }

    getCurrentLocation()
  }, [userLocation])

  // Set up real-time location tracking
  useEffect(() => {
    if (!showVolunteerLocations) return

    const handleLocationUpdate = (location: LocationData) => {
      setUserLocationState([location.latitude, location.longitude])
    }

    locationTrackingService.addLocationListener(handleLocationUpdate)

    return () => {
      locationTrackingService.removeLocationListener(handleLocationUpdate)
    }
  }, [showVolunteerLocations])

  // Calculate center based on markers if available
  const calculatedCenter = useMemo(() => {
    if (markers.length > 0) {
      const validMarkers = markers.filter(m => 
        m.position && 
        Array.isArray(m.position) && 
        m.position.length === 2 &&
        !isNaN(m.position[0]) && 
        !isNaN(m.position[1]) &&
        m.position[0] !== 0 && 
        m.position[1] !== 0
      )
      
      if (validMarkers.length > 0) {
        const avgLat = validMarkers.reduce((sum, m) => sum + m.position[0], 0) / validMarkers.length
        const avgLng = validMarkers.reduce((sum, m) => sum + m.position[1], 0) / validMarkers.length
        console.log('[MapInternal] Calculated center from markers:', { avgLat, avgLng, markerCount: validMarkers.length })
        return [avgLat, avgLng] as [number, number]
      }
    }
    return center
  }, [markers, center])

  const mapJsx = useMemo(() => {
    console.log('[MapInternal] Rendering map with:', {
      center: calculatedCenter,
      zoom,
      markerCount: markers.length,
      markers: markers.map(m => ({ id: m.id, position: m.position, status: m.status }))
    })
    
    return (
      <MapContainer
        center={calculatedCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url={offlineMode 
            ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjOTk5Ij5PZmZsaW5lPC90ZXh0Pjwvc3ZnPg=="
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />
        
        {/* Fit bounds to show all markers */}
        <FitBoundsToMarkers markers={markers} />
        
        {/* Recenter map when center changes */}
        <RecenterMap center={calculatedCenter} />
        
        {/* Talisay City boundary */}
        {showBoundary && <TalisayCityBoundary />}
        
        {/* Restrict map bounds to geofence area - better UI/UX */}
        {showBoundary && <MapBoundsRestriction enabled={true} minZoom={11} maxZoom={18} />}
        
        {/* Map click handler */}
        <MapClickHandler onMapClick={onMapClick} />
        
        {/* Incident markers */}
        {markers
          .filter((marker) => {
            // Validate marker position
            if (!marker.position || !Array.isArray(marker.position) || marker.position.length !== 2) {
              console.error('[MapInternal] Invalid marker position:', marker)
              return false
            }
            
            const [lat, lng] = marker.position
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
              console.error('[MapInternal] Invalid marker coordinates:', { marker, lat, lng })
              return false
            }
            
            return true
          })
          .map((marker) => {
            // Debug logging
            if (process.env.NODE_ENV === 'development') {
              console.log('[MapInternal] Rendering marker:', marker.id, marker.position, marker.status)
            }
            
            const [lat, lng] = marker.position as [number, number]
            const color = getIncidentColor(marker.status)
            
            // Use the ABSOLUTE SIMPLEST icon - guaranteed to work
            // Simple colored circle, no transforms, minimal CSS
            const icon = L.divIcon({
              html: `<div style="width:30px;height:30px;background:${color};border:4px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.6);"></div>`,
              className: '',
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              popupAnchor: [0, -15],
            })
            
            console.log('[MapInternal] Created marker icon:', {
              id: marker.id,
              position: [lat, lng],
              color,
              status: marker.status,
              iconCreated: !!icon
            })
            
            // Final validation
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
              console.error('[MapInternal] ❌ Invalid position, skipping:', marker.id, [lat, lng])
              return null
            }
            
            return (
              <Marker
                key={`marker-${marker.id}`}
                position={[Number(lat), Number(lng)] as [number, number]}
                icon={icon}
                eventHandlers={{
                  click: (e: L.LeafletMouseEvent) => {
                    console.log('[MapInternal] Marker clicked:', marker.id)
                    marker.onClick?.(marker.id)
                  },
                  add: () => {
                    console.log('[MapInternal] ✅ Marker ADDED to map:', marker.id, [lat, lng])
                  }
                }}
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
                      📍 {lat.toFixed(6)}, {lng.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        
        {/* User location marker (only when there are no other markers) */}
         {userLocationState && markers.length === 0 && (
          <Marker
            position={userLocationState}
            icon={createUserIcon() as L.DivIcon}
          >
            <Popup className="user-location-popup">
              <div className="p-3 min-w-[180px]">
                <h3 className="font-semibold text-base text-gray-900 mb-1">Your Location</h3>
                <p className="text-sm text-gray-600 mt-2">
                  📍 {userLocationState[0].toFixed(6)}, {userLocationState[1].toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Loading indicator for user location */}
        {isLoadingLocation && (
          <div className="absolute top-4 left-4 bg-white p-2 rounded shadow-md z-[1000]">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-xs text-gray-600">Getting location...</span>
            </div>
          </div>
        )}
        
        {/* Real-time volunteer locations */}
        <VolunteerLocations showVolunteerLocations={showVolunteerLocations} />

        {/* Heatmap overlay (simple density circles from hotspots) */}
        {showHeatmap && <HeatmapOverlay />}
        
        {/* Geofence circle */}
        {showGeofence && (
          <Circle
            center={TALISAY_CENTER}
            radius={5000} // 5km radius
            pathOptions={{
              color: '#ef4444',
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.1
            }}
          />
        )}
      </MapContainer>
    )
  }, [calculatedCenter, zoom, markers, offlineMode, showBoundary, onMapClick, userLocationState, isLoadingLocation, showVolunteerLocations, showGeofence, showHeatmap])

  return (
    <div ref={containerRef} style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md relative z-0">
      {mounted && containerReady && rafReady && mapJsx}
    </div>
  )
}

const MemoizedMapInternal = memo(MapInternal)
MemoizedMapInternal.displayName = 'MapInternal'

export default MemoizedMapInternal