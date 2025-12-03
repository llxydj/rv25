"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

// Fix for default marker icons in Leaflet (webpack build issue)
// This MUST be done before any map components are rendered
if (typeof window !== 'undefined') {
  // Delete the problematic _getIconUrl method
  delete (L.Icon.Default.prototype as any)._getIconUrl
  
  // Use CDN URLs as fallback (works in all environments)
  // Alternative: Use require() for local files if webpack is configured
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
}

interface LocationMapProps {
  selectedLat: number | null | undefined
  selectedLng: number | null | undefined
  address: string
  onLocationSelect: (lat: number, lng: number) => void
}

// Component to restrict map bounds
function MapBoundsRestriction() {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    
    try {
      const bounds = L.latLngBounds(
        [10.5, 122.7],
        [10.9, 123.1]
      )
      
      if (bounds.isValid()) {
        map.setMaxBounds(bounds)
        map.setMinZoom(11)
        map.setMaxZoom(18)
        
        setTimeout(() => {
          try {
            if (map && typeof map.invalidateSize === 'function') {
              map.invalidateSize()
            }
          } catch (err) {
            console.warn('Error invalidating map size:', err)
          }
        }, 100)
      }
    } catch (err) {
      console.error('Error setting up map bounds:', err)
    }
  }, [map])

  return null
}

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      try {
        const { lat, lng } = e.latlng
        
        const bounds = L.latLngBounds(
          [10.5, 122.7],
          [10.9, 123.1]
        )
        if (bounds.contains([lat, lng])) {
          onLocationSelect(lat, lng)
        }
      } catch (err) {
        console.warn('Error handling map click:', err)
      }
    },
  })
  return null
}

// Component to invalidate map size when dialog opens
function MapSizeInvalidator() {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    
    const timers = [
      setTimeout(() => {
        try {
          if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize()
          }
        } catch (err) {
          console.warn('Error invalidating map size (100ms):', err)
        }
      }, 100),
      setTimeout(() => {
        try {
          if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize()
          }
        } catch (err) {
          console.warn('Error invalidating map size (300ms):', err)
        }
      }, 300),
      setTimeout(() => {
        try {
          if (map && typeof map.invalidateSize === 'function') {
            map.invalidateSize()
          }
        } catch (err) {
          console.warn('Error invalidating map size (500ms):', err)
        }
      }, 500)
    ]

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [map])

  return null
}

// Center of Bacolod City (default fallback)
const DEFAULT_CENTER: [number, number] = [10.6761, 122.9513]
const DEFAULT_ZOOM = 13

export function LocationMap({ selectedLat, selectedLng, address, onLocationSelect }: LocationMapProps) {
  const [mapError, setMapError] = useState<string | null>(null)

  // ===== CRITICAL: VALIDATE PROPS BEFORE USING =====
  
  // Validate and sanitize center coordinates
  const validLat = (selectedLat != null && !isNaN(selectedLat) && isFinite(selectedLat))
    ? selectedLat
    : DEFAULT_CENTER[0]
  
  const validLng = (selectedLng != null && !isNaN(selectedLng) && isFinite(selectedLng))
    ? selectedLng
    : DEFAULT_CENTER[1]
  
  const validCenter: [number, number] = [validLat, validLng]
  const validZoom = DEFAULT_ZOOM

  // Debug logging (remove in production if needed)
  if (process.env.NODE_ENV === 'development') {
    console.log('=== MAP RENDER DEBUG ===')
    console.log('selectedLat:', selectedLat, 'type:', typeof selectedLat)
    console.log('selectedLng:', selectedLng, 'type:', typeof selectedLng)
    console.log('validCenter:', validCenter)
    console.log('validZoom:', validZoom)
    console.log('========================')
  }

  // Handle tile loading errors
  const handleTileError = () => {
    setMapError("Failed to load map tiles. Please check your internet connection.")
  }

  if (mapError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
        <div className="text-center p-6 max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Map Tiles Failed to Load
          </h3>
          <p className="text-sm text-gray-600 mb-4">{mapError}</p>
          <Button
            onClick={() => {
              setMapError(null)
              window.location.reload()
            }}
            variant="default"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <MapContainer
      key={`map-${validLat}-${validLng}`}
      center={validCenter}
      zoom={validZoom}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={true}
      scrollWheelZoom={true}
      attributionControl={true}
      className="z-0"
      whenReady={(map) => {
        setTimeout(() => {
          try {
            if (map?.target && typeof map.target.invalidateSize === 'function') {
              map.target.invalidateSize()
            }
          } catch (err) {
            console.warn('Error in whenReady invalidateSize:', err)
            setMapError("Map initialization failed. Please try again.")
          }
        }, 300)
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        errorTileUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Crect fill='%23ddd' width='256' height='256'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EFailed to load tile%3C/text%3E%3C/svg%3E"
        eventHandlers={{
          tileerror: handleTileError
        }}
      />
      <MapSizeInvalidator />
      <MapBoundsRestriction />
      <MapClickHandler onLocationSelect={onLocationSelect} />
      <Marker position={validCenter}>
        <L.Popup>
          <div className="text-sm">
            <strong>Selected Location</strong>
            <br />
            {address || "Loading address..."}
          </div>
        </L.Popup>
      </Marker>
    </MapContainer>
  )
}

