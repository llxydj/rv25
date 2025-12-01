"use client"

import { MapContainer, TileLayer, Circle, Popup, Rectangle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER, TALISAY_BOUNDARIES } from "@/lib/geo-utils"
import { Badge } from "@/components/ui/badge"
import { useEffect, useRef } from "react"
import { MapBoundsRestriction } from "@/components/ui/map-bounds-restriction"

// Fix for default marker icons
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })
}

export interface AreaData {
  barangay: string
  count: number
  lat: number
  lng: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  top_incident_type: string
  top_type_count: number
  status_breakdown: Record<string, number>
}

const RISK_COLORS = {
  LOW: '#10b981',      // green
  MEDIUM: '#f59e0b',   // yellow/amber
  HIGH: '#ef4444',     // red
  CRITICAL: '#7c2d12'  // dark red
}

const RISK_LABELS = {
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
  CRITICAL: 'Critical Risk'
}

interface AreaMapInternalProps {
  areas: AreaData[]
}

const getCircleRadius = (count: number) => {
  // Base radius on count, with min/max bounds
  return Math.min(Math.max(count * 50, 200), 2000)
}

const getCircleOpacity = (riskLevel: string) => {
  switch (riskLevel) {
    case 'CRITICAL': return 0.6
    case 'HIGH': return 0.5
    case 'MEDIUM': return 0.4
    case 'LOW': return 0.3
    default: return 0.3
  }
}

// Talisay City Boundary Component (GeoJSON) - same as map-internal.tsx
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

export default function AreaMapInternal({ areas }: AreaMapInternalProps) {
  // Fix Leaflet icon issue on mount
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
  }, [])

  return (
    <div className="h-[600px] w-full relative">
      <MapContainer
        center={TALISAY_CENTER}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* City Boundary - using GeoJSON like other maps */}
        <TalisayCityBoundary />
        
        {/* Restrict map bounds to geofence area - better UI/UX */}
        <MapBoundsRestriction enabled={true} minZoom={11} maxZoom={18} />

        {/* Area Circles */}
        {areas.map((area, idx) => (
          <Circle
            key={idx}
            center={[area.lat, area.lng]}
            radius={getCircleRadius(area.count)}
            pathOptions={{
              color: RISK_COLORS[area.risk_level],
              fillColor: RISK_COLORS[area.risk_level],
              fillOpacity: getCircleOpacity(area.risk_level),
              weight: 2
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-bold text-lg mb-2">{area.barangay}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Incidents:</span>
                    <span className="font-semibold">{area.count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Risk Level:</span>
                    <Badge
                      style={{
                        backgroundColor: RISK_COLORS[area.risk_level],
                        color: 'white'
                      }}
                    >
                      {RISK_LABELS[area.risk_level]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Top Type:</span>
                    <span className="font-medium">{area.top_incident_type} ({area.top_type_count})</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  )
}

