"use client"

import React, { useMemo } from "react"
import { MapComponent } from "@/components/ui/map-component"
import type { Incident } from "@/lib/incidents"
import { TALISAY_CENTER } from "@/lib/geo-utils"

export type UserRole = "ADMIN" | "BARANGAY" | "VOLUNTEER" | "RESIDENT"

export interface RoleMapProps {
  incidents: Incident[]
  userRole: UserRole
  height?: string
  // When residents pick a point on the map
  captureLocation?: boolean
  onLocationSelect?: (lat: number, lng: number) => void
  // Volunteers can optionally show their own live location
  showUserLocation?: boolean
}

// Adapter from incidents -> MapComponent markers based on role
export function RoleMap({
  incidents,
  userRole,
  height = "300px",
  captureLocation = false,
  onLocationSelect,
  showUserLocation = false,
}: RoleMapProps) {
  // For Resident role, suppress markers; for others show markers provided by backend (already filtered)
  const markers = useMemo(() => {
    if (userRole === "RESIDENT") return []
    return (incidents || []).map((i) => ({
      id: i.id,
      position: [i.location_lat, i.location_lng] as [number, number],
      status: i.status,
      title: i.incident_type,
      description: i.description,
      onClick: (id: string) => {
        // Leave navigation handling to parent pages (admin/volunteer/barangay) if they want to
        // This adapter only adapts markers shape
      },
    }))
  }, [incidents, userRole])

  return (
    <MapComponent
      center={TALISAY_CENTER}
      markers={markers}
      height={height}
      onMapClick={captureLocation ? onLocationSelect : undefined}
      userLocation={showUserLocation}
      // Boundary/Geofence overlays remain controlled by parent pages if desired
      // showBoundary
      // showGeofence
    />
  )
}
