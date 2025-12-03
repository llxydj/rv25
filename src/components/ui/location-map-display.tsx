"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"

// Dynamic import to prevent SSR issues
const LocationMapInternal = dynamic(
  () => import('./location-map-display-internal').then((mod) => mod.LocationMapInternal),
  { 
    ssr: false,
    loading: () => (
      <div className="border rounded-lg bg-gray-100 flex items-center justify-center" style={{ height: "300px" }}>
        <div className="text-center text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    )
  }
)

interface LocationMapDisplayProps {
  address: string
  lat?: number | null
  lng?: number | null
  height?: string
  className?: string
}

export function LocationMapDisplay({ address, lat, lng, height = "300px", className }: LocationMapDisplayProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // If no coordinates, show address only
  if (!lat || !lng) {
    return (
      <div className={`border rounded-lg bg-gray-50 p-4 ${className}`} style={{ height }}>
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700 mb-1">Location</p>
            <p className="text-sm text-gray-900">{address || "No location specified"}</p>
          </div>
        </div>
      </div>
    )
  }

  // Don't render map until client-side
  if (!isClient) {
    return (
      <div className={`border rounded-lg bg-gray-100 flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <LocationMapInternal
      address={address}
      lat={lat}
      lng={lng}
      height={height}
      className={className}
    />
  )
}
