"use client"

import { MapContainer, TileLayer, Circle, Popup, Rectangle } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER, TALISAY_BOUNDARIES } from "@/lib/geo-utils"
import { Badge } from "@/components/ui/badge"
import { useEffect } from "react"

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
        
        {/* City Boundary */}
        <Rectangle
          bounds={[
            [TALISAY_BOUNDARIES[2][0], TALISAY_BOUNDARIES[2][1]],
            [TALISAY_BOUNDARIES[0][0], TALISAY_BOUNDARIES[0][1]]
          ]}
          pathOptions={{
            color: '#3b82f6',
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 3,
            dashArray: '10, 5'
          }}
        />

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

