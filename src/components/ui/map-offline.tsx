"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { TALISAY_CENTER } from "@/lib/geo-utils"
import { offlineStorageService } from "@/lib/offline-storage"
import { WifiOff, Download, AlertCircle } from "lucide-react"

interface MapOfflineProps {
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
}

// Custom marker icons
const createCustomIcon = (color: string, type: 'incident' | 'volunteer' | 'user') => {
  const iconHtml = type === 'volunteer' 
    ? `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
    : `<div style="background-color: ${color}; width: 25px; height: 25px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
  
  return L.divIcon({
    html: iconHtml,
    className: 'custom-marker',
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

// Incident status colors
const getIncidentColor = (status: string) => {
  switch (status) {
    case 'PENDING': return '#ef4444'
    case 'ASSIGNED': return '#f59e0b'
    case 'RESPONDING': return '#3b82f6'
    case 'RESOLVED': return '#10b981'
    case 'CANCELLED': return '#6b7280'
    default: return '#6b7280'
  }
}

// Offline tile layer component
function OfflineTileLayer() {
  const map = useMap()

  useEffect(() => {
    // Check if we have cached tiles
    const checkCachedTiles = async () => {
      try {
        const cache = await caches.open('rvois-maps-v1')
        const cachedTiles = await cache.keys()
        
        if (cachedTiles.length > 0) {
          console.log(`Found ${cachedTiles.length} cached map tiles`)
        } else {
          console.log('No cached map tiles found')
        }
      } catch (error) {
        console.error('Error checking cached tiles:', error)
      }
    }

    checkCachedTiles()
  }, [map])

  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={18}
      minZoom={10}
    />
  )
}

// Offline boundary component
function OfflineBoundary() {
  const map = useMap()
  const [boundaryData, setBoundaryData] = useState<any>(null)

  useEffect(() => {
    const loadBoundary = async () => {
      try {
        // Try to load from cache first
        const cache = await caches.open('rvois-static-v1')
        const cachedResponse = await cache.match('/talisay.geojson')
        
        if (cachedResponse) {
          const data = await cachedResponse.json()
          setBoundaryData(data)
          return
        }

        // Fallback to network
        const response = await fetch('/talisay.geojson')
        if (response.ok) {
          const data = await response.json()
          setBoundaryData(data)
          
          // Cache the response
          cache.put('/talisay.geojson', response.clone())
        }
      } catch (error) {
        console.error('Error loading boundary:', error)
      }
    }

    loadBoundary()
  }, [map])

  useEffect(() => {
    if (boundaryData) {
      const geoJsonLayer = L.geoJSON(boundaryData, {
        style: {
          color: '#3b82f6',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.1
        }
      }).addTo(map)
    }
  }, [boundaryData, map])

  return null
}

// Map click handler
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    }
  })
  return null
}

// Offline status indicator
function OfflineStatusIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [cachedTiles, setCachedTiles] = useState(0)

  useEffect(() => {
    const handleOnlineStatusChange = () => {
      setIsOffline(!navigator.onLine)
    }

    const checkCachedTiles = async () => {
      try {
        const cache = await caches.open('rvois-maps-v1')
        const tiles = await cache.keys()
        setCachedTiles(tiles.length)
      } catch (error) {
        console.error('Error checking cached tiles:', error)
      }
    }

    window.addEventListener('online', handleOnlineStatusChange)
    window.addEventListener('offline', handleOnlineStatusChange)
    checkCachedTiles()

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange)
      window.removeEventListener('offline', handleOnlineStatusChange)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="absolute top-4 left-4 z-10 bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-yellow-600" />
        <div>
          <p className="text-sm font-medium text-yellow-800">Offline Mode</p>
          <p className="text-xs text-yellow-600">
            {cachedTiles > 0 ? `${cachedTiles} tiles cached` : 'Limited map data'}
          </p>
        </div>
      </div>
    </div>
  )
}

// Cache download progress
function CacheDownloadProgress() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState(0)

  const downloadMapTiles = async () => {
    setIsDownloading(true)
    setProgress(0)

    try {
      // This would trigger the service worker to download tiles
      const response = await fetch('/api/cache-map-tiles', {
        method: 'POST'
      })

      if (response.ok) {
        // Simulate progress (in real implementation, this would come from service worker)
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval)
              setIsDownloading(false)
              return 100
            }
            return prev + 10
          })
        }, 200)
      }
    } catch (error) {
      console.error('Error downloading map tiles:', error)
      setIsDownloading(false)
    }
  }

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">Download Map Data</p>
          <p className="text-xs text-gray-600">Cache tiles for offline use</p>
          {isDownloading && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <button
          onClick={downloadMapTiles}
          disabled={isDownloading}
          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isDownloading ? 'Downloading...' : 'Download'}
        </button>
      </div>
    </div>
  )
}

export function MapOffline({
  center = TALISAY_CENTER,
  zoom = 13,
  markers = [],
  height = "500px",
  onMapClick,
  userLocation = false,
  showBoundary = false,
  showGeofence = false,
  offlineMode = false,
  showVolunteerLocations = false,
}: MapOfflineProps) {
  const [userLocationState, setUserLocationState] = useState<[number, number] | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [offlineIncidents, setOfflineIncidents] = useState<any[]>([])

  // Fix Leaflet icon issue
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
  }, [])

  // Load offline incidents
  useEffect(() => {
    const loadOfflineIncidents = async () => {
      try {
        const incidents = await offlineStorageService.getPendingIncidents()
        setOfflineIncidents(incidents)
      } catch (error) {
        console.error('Error loading offline incidents:', error)
      }
    }

    loadOfflineIncidents()
  }, [])

  // Get user location
  useEffect(() => {
    if (!userLocation) return

    const getCurrentLocation = () => {
      setIsLoadingLocation(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setUserLocationState([lat, lng])
          setIsLoadingLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          setIsLoadingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      )
    }

    getCurrentLocation()
  }, [userLocation])

  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <OfflineTileLayer />
        
        {/* Map click handler */}
        <MapClickHandler onMapClick={onMapClick} />
        
        {/* Talisay City boundary */}
        {showBoundary && <OfflineBoundary />}
        
        {/* Incident markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={createCustomIcon(getIncidentColor(marker.status), 'incident')}
            eventHandlers={{
              click: () => marker.onClick?.(marker.id)
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">{marker.title}</h3>
                <p className="text-xs text-gray-600 capitalize">{marker.status.toLowerCase()}</p>
                {marker.description && (() => {
                  // Clean up description: remove excessive newlines, normalize whitespace, remove coordinates
                  const cleanedDescription = marker.description
                    .trim()
                    .replace(/\n+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .replace(/\b\d+\.\d{6,}\b/g, '')
                    .trim()
                  
                  return cleanedDescription ? (
                    <p className="text-xs text-gray-500 mt-1 whitespace-normal break-words">{cleanedDescription}</p>
                  ) : null
                })()}
                <p className="text-xs text-gray-400 mt-1">
                  {marker.position[0].toFixed(6)}, {marker.position[1].toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Offline incident markers */}
        {offlineIncidents.map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.location_lat, incident.location_lng]}
            icon={createCustomIcon('#f59e0b', 'incident')}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">{incident.incident_type}</h3>
                <p className="text-xs text-yellow-600">Offline - Pending Sync</p>
                <p className="text-xs text-gray-500 mt-1">{incident.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {incident.location_lat.toFixed(6)}, {incident.location_lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* User location marker */}
        {userLocationState && (
          <Marker
            position={userLocationState}
            icon={createCustomIcon('#3b82f6', 'user')}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">Your Location</h3>
                <p className="text-xs text-gray-500">
                  {userLocationState[0].toFixed(6)}, {userLocationState[1].toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Loading indicator for user location */}
        {isLoadingLocation && (
          <div className="absolute top-4 left-4 bg-white p-2 rounded shadow-md">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-xs text-gray-600">Getting location...</span>
            </div>
          </div>
        )}
        
        {/* Geofence circle */}
        {showGeofence && (
          <Circle
            center={TALISAY_CENTER}
            radius={5000} // 5km radius
            pathOptions={{
              color: '#ef4444',
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.1
            }}
          />
        )}
      </MapContainer>

      {/* Offline status indicator */}
      <OfflineStatusIndicator />

      {/* Cache download progress */}
      {offlineMode && <CacheDownloadProgress />}
    </div>
  )
}
