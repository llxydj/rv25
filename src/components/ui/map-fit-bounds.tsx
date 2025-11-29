"use client"

import { useEffect } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"

interface FitBoundsToMarkersProps {
  markers: Array<{ position: [number, number] }>
}

export function FitBoundsToMarkers({ markers }: FitBoundsToMarkersProps) {
  const map = useMap()
  
  useEffect(() => {
    if (markers.length === 0 || !map) return
    
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
      // Wait for markers to render
      const timeout = setTimeout(() => {
        try {
          const bounds = L.latLngBounds(
            validMarkers.map(m => m.position as [number, number])
          )
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
          console.log('[FitBoundsToMarkers] ✅ Fitted bounds to', validMarkers.length, 'markers')
        } catch (error) {
          console.error('[FitBoundsToMarkers] Error fitting bounds:', error)
        }
      }, 1500) // Wait 1.5 seconds for markers to fully render
      
      return () => clearTimeout(timeout)
    }
  }, [markers, map])
  
  return null
}

