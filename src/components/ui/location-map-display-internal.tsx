"use client"

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPin } from "lucide-react"

// Fix for default marker icons in Leaflet (webpack build issue)
// This MUST be done before any map components are rendered
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
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

interface LocationMapDisplayInternalProps {
  address: string
  lat: number
  lng: number
  height: string
  className?: string
}

// Default center (Bacolod City)
const DEFAULT_DISPLAY_CENTER: [number, number] = [10.6761, 122.9513]
const DEFAULT_DISPLAY_ZOOM = 15

export function LocationMapInternal({ address, lat, lng, height, className }: LocationMapDisplayInternalProps) {
  // ===== CRITICAL: VALIDATE PROPS BEFORE USING =====
  
  // Validate coordinates
  const validLat = (lat != null && !isNaN(lat) && isFinite(lat)) ? lat : DEFAULT_DISPLAY_CENTER[0]
  const validLng = (lng != null && !isNaN(lng) && isFinite(lng)) ? lng : DEFAULT_DISPLAY_CENTER[1]
  const validCenter: [number, number] = [validLat, validLng]
  const validZoom = DEFAULT_DISPLAY_ZOOM

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('=== LOCATION MAP DISPLAY DEBUG ===')
    console.log('lat:', lat, 'lng:', lng)
    console.log('validCenter:', validCenter)
    console.log('==================================')
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`} style={{ height }}>
      <MapContainer
        center={validCenter}
        zoom={validZoom}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoomControl={true}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={validCenter}>
          <Popup>
            <div className="text-sm">
              <strong>Location</strong>
              <br />
              {address}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      <div className="p-3 bg-white border-t">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 mb-1">Address</p>
            <p className="text-xs text-gray-900 break-words">{address}</p>
            <p className="text-xs text-gray-500 mt-1">
              Coordinates: {validLat.toFixed(6)}, {validLng.toFixed(6)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

