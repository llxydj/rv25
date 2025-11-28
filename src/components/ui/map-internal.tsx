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
        if (!container || !container._leaflet_id) return false
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

// Custom marker icons
const createCustomIcon = (color: string, type: 'incident' | 'volunteer' | 'user') => {
  const iconHtml = type === 'volunteer' 
    ? `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
    : `<div style="background-color: ${color}; width: 25px; height: 25px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
  
  return L.divIcon({
    html: iconHtml,
    className: 'custom-marker',
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

// Incident status colors
const getIncidentColor = (status: string) => {
  switch (status) {
    case 'PENDING': return '#ef4444' // red
    case 'ASSIGNED': return '#f59e0b' // amber
    case 'RESPONDING': return '#3b82f6' // blue
    case 'RESOLVED': return '#10b981' // green
    case 'CANCELLED': return '#6b7280' // gray
    default: return '#6b7280'
  }
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
        if (!container || !container._leaflet_id) return false
        
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
        if (!container || !container._leaflet_id) return false
        
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
      if (!container || !container._leaflet_id) return false
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
          icon={createCustomIcon('#10b981', 'volunteer')}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold text-sm">
                {volunteer.first_name} {volunteer.last_name}
              </h3>
              {volunteer.distance_km && (
                <p className="text-xs text-gray-600">
                  Distance: {volunteer.distance_km.toFixed(1)} km
                </p>
              )}
              <p className="text-xs text-gray-500">
                Last seen: {new Date(volunteer.last_seen).toLocaleTimeString()}
              </p>
              {volunteer.phone_number && (
                <p className="text-xs text-blue-600">
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
    if (c && (c.querySelector?.('.leaflet-container') || c._leaflet_id)) {
      try {
        c._leaflet_id = null
        c.innerHTML = ''
      } catch (err) {
        console.error('Failed to pre-clean leaflet container:', err)
      }
    }
    // Mark ready after pre-clean, in next tick to ensure DOM is flushed
    const t = setTimeout(() => {
      const cc = containerRef.current as any
      if (cc && (cc.querySelector?.('.leaflet-container') || cc._leaflet_id)) {
        try {
          cc._leaflet_id = null
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
    if (c._leaflet_id || c.querySelector?.('.leaflet-container')) {
      try {
        c._leaflet_id = null
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

  // Fix Leaflet icon issue
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
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

  const mapJsx = useMemo(() => (
      <MapContainer
        center={center}
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
        
        {/* Recenter map when center changes */}
        <RecenterMap center={center} />
        
        {/* Talisay City boundary */}
        {showBoundary && <TalisayCityBoundary />}
        
        {/* Map click handler */}
        <MapClickHandler onMapClick={onMapClick} />
        
        {/* Incident markers */}
        {markers.map((marker) => (
           <Marker
             key={marker.id}
             position={marker.position}
             icon={createCustomIcon(getIncidentColor(marker.status), 'incident') as L.DivIcon}
             eventHandlers={{
               click: (e: L.LeafletMouseEvent) => marker.onClick?.(marker.id)
             }}
           >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">{marker.title}</h3>
                <p className="text-xs text-gray-600 capitalize">{marker.status.toLowerCase()}</p>
                {marker.description && (
                  <p className="text-xs text-gray-500 mt-1">{marker.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {marker.position[0].toFixed(6)}, {marker.position[1].toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* User location marker (only when there are no other markers) */}
         {userLocationState && markers.length === 0 && (
          <Marker
            position={userLocationState}
            icon={createCustomIcon('#3b82f6', 'user') as L.DivIcon}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">Your Location</h3>
                <p className="text-xs text-gray-500">
                  {userLocationState[0].toFixed(6)}, {userLocationState[1].toFixed(6)}
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
  ), [center, zoom, markers, offlineMode, showBoundary, onMapClick, userLocationState, isLoadingLocation, showVolunteerLocations, showGeofence, showHeatmap])

  return (
    <div ref={containerRef} style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md">
      {mounted && containerReady && rafReady && mapJsx}
    </div>
  )
}

export default memo(MapInternal)