"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"

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
}

export const MapComponent: React.FC<MapComponentProps> = ({
  center = [10.7202, 122.9755], // Default center (Talisay City)
  zoom = 13,
  markers = [],
  height = "500px",
  onMapClick,
  userLocation = false,
}) => {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    if (userLocation) {
      setLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation([position.coords.latitude, position.coords.longitude])
          setLoading(false)
        },
        (err) => {
          setError("Error getting location. Please enable location services.")
          setLoading(false)
          console.error("Error getting location:", err)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      )
    }
  }, [userLocation])

  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng)
      }
    })
    return null
  }

  function Recenter() {
    const map = useMap()
    useEffect(() => {
      if (currentLocation) {
        map.setView(currentLocation, map.getZoom())
      } else if (center) {
        map.setView(center, map.getZoom())
      }
    }, [map, currentLocation, center])
    return null
  }

  // Define marker icons
  const statusIcons = {
    PENDING: new L.Icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    ASSIGNED: new L.Icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    RESPONDING: new L.Icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    RESOLVED: new L.Icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    CANCELLED: new L.Icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
  }

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (onMapClick) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }
  }

  if (!isClient) {
    return (
      <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md bg-gray-100">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md bg-gray-100">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Getting your location...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md bg-gray-100">
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-red-500 p-4">
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden shadow-md">
      <MapContainer
        center={currentLocation || center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler />
        <Recenter />

        {currentLocation && (
          <>
            <Marker
              position={currentLocation}
              icon={
                new L.Icon({
                  iconUrl:
                    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
                  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                  shadowSize: [41, 41],
                })
              }
            >
              <Popup>
                <div>
                  <h3 className="font-bold">Your Location</h3>
                  <p className="text-xs">
                    {currentLocation[0]}, {currentLocation[1]}
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            icon={statusIcons[marker.status]}
            eventHandlers={{
              click: () => {
                if (marker.onClick) {
                  marker.onClick(marker.id)
                }
              },
            }}
          >
            <Popup>
              <div>
                <h3 className="font-bold">{marker.title}</h3>
                {marker.description && <p className="text-sm">{marker.description}</p>}
                <p className="text-xs mt-1">Status: {marker.status}</p>
                <p className="text-xs">
                  {marker.position[0]}, {marker.position[1]}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
