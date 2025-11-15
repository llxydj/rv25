import * as React from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { cn } from "@/lib/utils"

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

interface EnhancedMapProps {
  center?: [number, number]
  zoom?: number
  markers?: Array<{
    position: [number, number]
    popupContent?: React.ReactNode
  }>
  height?: string
  className?: string
  onMapClick?: (latlng: { lat: number; lng: number }) => void
}

const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap()
  React.useEffect(() => {
    map.setView(center)
  }, [center, map])
  return null
}

const EnhancedMapComponent: React.FC<EnhancedMapProps> = ({
  center = [10.03, 123.03], // Default to Talisay City coordinates
  zoom = 13,
  markers = [],
  height = "500px",
  className,
  onMapClick,
}) => {
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng })
  }

  return (
    <div 
      className={cn("relative rounded-lg overflow-hidden border border-gray-200", className)}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        className="z-0"
        whenCreated={(map) => {
          // Set proper z-index for map controls
          const controls = map.getContainer().querySelector(".leaflet-control-container")
          if (controls) {
            (controls as HTMLElement).style.zIndex = "400"
          }
        }}
        eventHandlers={{
          click: handleMapClick,
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <RecenterMap center={center} />
        
        {markers.map((marker, index) => (
          <Marker 
            key={index} 
            position={marker.position}
            zIndexOffset={500} // Ensure markers appear above map controls
          >
            {marker.popupContent && (
              <Popup className="z-[600]">
                {marker.popupContent}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export { EnhancedMapComponent, type EnhancedMapProps }