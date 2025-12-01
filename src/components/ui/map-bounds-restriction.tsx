"use client"

import { useEffect, useState } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"

/**
 * MapBoundsRestriction Component
 * 
 * Restricts map view to only show geofenced areas (Talisay City boundary)
 * - Prevents panning outside the boundary
 * - Sets appropriate zoom limits
 * - Provides better UI/UX by focusing on relevant areas
 */
export function MapBoundsRestriction({ 
  enabled = true,
  minZoom = 11,
  maxZoom = 18,
  padding = 50 // Padding in pixels to add around boundary
}: {
  enabled?: boolean
  minZoom?: number
  maxZoom?: number
  padding?: number
}) {
  const map = useMap()
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null)

  useEffect(() => {
    if (!enabled || !map) return

    // Helper to check if map is ready
    const isMapReady = () => {
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

    // Load GeoJSON boundary and calculate bounds
    const loadBoundaryBounds = async () => {
      try {
        if (!isMapReady()) {
          // Retry after a short delay
          setTimeout(loadBoundaryBounds, 100)
          return
        }

        const response = await fetch('/talisay.geojson')
        if (!response.ok) {
          console.warn('[MapBoundsRestriction] Failed to load boundary GeoJSON')
          return
        }

        const data = await response.json()
        
        // Validate GeoJSON
        const isFeatureCollection = data && data.type === 'FeatureCollection' && Array.isArray(data.features)
        const isFeature = data && data.type === 'Feature' && data.geometry
        if (!isFeatureCollection && !isFeature) {
          console.warn('[MapBoundsRestriction] Invalid GeoJSON format')
          return
        }

        // Create temporary GeoJSON layer to calculate bounds
        const geoJsonLayer = L.geoJSON(data)
        const calculatedBounds = geoJsonLayer.getBounds()
        
        if (calculatedBounds && calculatedBounds.isValid()) {
          setBounds(calculatedBounds)
          
          // Set maxBounds to restrict panning
          map.setMaxBounds(calculatedBounds)
          
          // Set zoom limits
          if (map.setMinZoom) {
            map.setMinZoom(minZoom)
          }
          if (map.setMaxZoom) {
            map.setMaxZoom(maxZoom)
          }
          
          // Ensure current view is within bounds
          const currentCenter = map.getCenter()
          if (!calculatedBounds.contains(currentCenter)) {
            // Center is outside bounds, fit to bounds
            map.fitBounds(calculatedBounds, { padding: [padding, padding] })
          }
          
          // Listen for drag events to prevent panning outside bounds
          const handleDrag = () => {
            const center = map.getCenter()
            if (!calculatedBounds.contains(center)) {
              // If center is outside bounds, snap it back
              const snappedLat = Math.max(
                calculatedBounds.getSouth(),
                Math.min(calculatedBounds.getNorth(), center.lat)
              )
              const snappedLng = Math.max(
                calculatedBounds.getWest(),
                Math.min(calculatedBounds.getEast(), center.lng)
              )
              map.setView([snappedLat, snappedLng], map.getZoom(), { animate: false })
            }
          }
          
          map.on('dragend', handleDrag)
          map.on('zoomend', handleDrag)
          
          console.log('[MapBoundsRestriction] Boundary bounds set:', {
            north: calculatedBounds.getNorth(),
            south: calculatedBounds.getSouth(),
            east: calculatedBounds.getEast(),
            west: calculatedBounds.getWest(),
            minZoom,
            maxZoom
          })
          
          return () => {
            map.off('dragend', handleDrag)
            map.off('zoomend', handleDrag)
          }
        }
      } catch (error) {
        console.error('[MapBoundsRestriction] Error loading boundary:', error)
      }
    }

    loadBoundaryBounds()
  }, [map, enabled, minZoom, maxZoom, padding])

  // Cleanup: Remove bounds restriction when component unmounts or disabled
  useEffect(() => {
    if (!enabled && map) {
      map.setMaxBounds(null)
      if (map.setMinZoom) {
        map.setMinZoom(0) // Reset to default
      }
      if (map.setMaxZoom) {
        map.setMaxZoom(Infinity) // Reset to default
      }
    }
  }, [enabled, map])

  return null
}

