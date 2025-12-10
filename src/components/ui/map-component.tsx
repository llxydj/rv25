"use client"

import dynamic from 'next/dynamic'
import React, { useState, useEffect } from 'react'
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

// Error boundary component for chunk loading failures
function MapErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ height: '500px', width: "100%" }} 
         className="rounded-lg overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
      <div className="text-center p-6">
        <div className="text-red-500 mb-4">
          <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium mb-2">Failed to load map</p>
        <p className="text-sm text-gray-500 mb-4">Please try refreshing the page</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// Define the dynamic import with error handling
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

// Create a wrapper component that handles chunk loading errors
export function MapComponent(props: MapComponentProps) {
  const [hasError, setHasError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Listen for chunk loading errors
    const handleChunkError = (event: ErrorEvent) => {
      if (event.message?.includes('chunk') || event.message?.includes('Loading chunk')) {
        console.error('Chunk loading error detected:', event.message)
        setHasError(true)
      }
    }

    window.addEventListener('error', handleChunkError)
    return () => window.removeEventListener('error', handleChunkError)
  }, [])

  const handleRetry = () => {
    setHasError(false)
    setRetryCount(prev => prev + 1)
    // Force reload the page if retry fails multiple times
    if (retryCount >= 2) {
      window.location.reload()
    }
  }

  if (hasError) {
    return <MapErrorFallback onRetry={handleRetry} />
  }

  try {
    return <MapWithNoSSR key={retryCount} {...props} />
  } catch (error) {
    console.error('MapComponent render error:', error)
    return <MapErrorFallback onRetry={handleRetry} />
  }
}
