"use client"

import dynamic from 'next/dynamic'
import React from 'react'
import { TALISAY_CENTER } from "@/lib/geo-utils"

// Define props interface
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

// Define the dynamic import at module scope to keep a stable component identity
const MapWithNoSSR = dynamic(
  () => import('./map-internal'), 
  { 
    ssr: false,
    loading: () => (
      <div style={{ height: '500px', width: "100%" }} 
           className="rounded-lg overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }
)

// Create a wrapper component that doesn't import Leaflet directly
export function MapComponent(props: MapComponentProps) {
  return <MapWithNoSSR {...props} />
}
