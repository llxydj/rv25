"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Search } from "lucide-react"
import { getAddressFromCoordinates } from "@/lib/geo-utils"
import { MapErrorBoundary } from "@/components/ui/map-error-boundary"

// Center of Bacolod City
const BACOLOD_CENTER: [number, number] = [10.6761, 122.9513]

interface LocationPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (location: { address: string; lat: number; lng: number }) => void
  initialLocation?: { address: string; lat?: number; lng?: number }
}

// Dynamic import of the entire map component to prevent SSR issues
const LocationMap = dynamic(
  () => import('./location-map-internal').then((mod) => mod.LocationMap),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm">Loading map...</p>
        </div>
      </div>
    )
  }
)

export function LocationPickerModal({ isOpen, onClose, onSelect, initialLocation }: LocationPickerModalProps) {
  // ===== CRITICAL: Ensure valid default values =====
  const getValidLat = (lat?: number | null): number => {
    if (lat != null && !isNaN(lat) && isFinite(lat)) return lat
    return BACOLOD_CENTER[0]
  }
  
  const getValidLng = (lng?: number | null): number => {
    if (lng != null && !isNaN(lng) && isFinite(lng)) return lng
    return BACOLOD_CENTER[1]
  }

  const [selectedLat, setSelectedLat] = useState<number>(getValidLat(initialLocation?.lat))
  const [selectedLng, setSelectedLng] = useState<number>(getValidLng(initialLocation?.lng))
  const [address, setAddress] = useState(initialLocation?.address || "")
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on client before rendering map
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Reset to initial location when modal opens
  useEffect(() => {
    if (isOpen && isClient) {
      // Validate and set coordinates with fallbacks
      const validLat = getValidLat(initialLocation?.lat)
      const validLng = getValidLng(initialLocation?.lng)
      
      setSelectedLat(validLat)
      setSelectedLng(validLng)
      setAddress(initialLocation?.address || "")
      setSearchQuery("")
    }
  }, [isOpen, initialLocation, isClient])

  useEffect(() => {
    if (selectedLat && selectedLng && !address) {
      fetchAddress()
    }
  }, [selectedLat, selectedLng, address])

  const fetchAddress = async () => {
    if (!selectedLat || !selectedLng) return
    
    setLoading(true)
    try {
      const addr = await getAddressFromCoordinates(selectedLat, selectedLng)
      if (addr) {
        setAddress(addr)
      } else {
        setAddress(`${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`)
      }
    } catch (error) {
      console.error("Error fetching address:", error)
      setAddress(`${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLocationSelect = async (lat: number, lng: number) => {
    if (typeof window === 'undefined') return
    
    const L = await import('leaflet').then(m => m.default)
    const bounds = L.latLngBounds(
      [10.5, 122.7] as [number, number],
      [10.9, 123.1] as [number, number]
    )
    if (!bounds.contains([lat, lng])) {
      alert("Location is outside Northern Negros Occidental area. Please select a location within the allowed area.")
      return
    }

    setSelectedLat(lat)
    setSelectedLng(lng)
    
    setLoading(true)
    try {
      const addr = await getAddressFromCoordinates(lat, lng)
      if (addr) {
        setAddress(addr)
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      }
    } catch (error) {
      console.error("Error fetching address:", error)
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || typeof window === 'undefined') return

    setLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&bounded=1&viewbox=122.7,10.5,123.1,10.9`,
        {
          headers: {
            'User-Agent': 'RVOIS-Capstone-Project/1.0'
          }
        }
      )
      const data = await response.json()

      if (data && data.length > 0) {
        const result = data[0]
        const lat = parseFloat(result.lat)
        const lng = parseFloat(result.lon)
        
        const L = await import('leaflet').then(m => m.default)
        const bounds = L.latLngBounds(
          [10.5, 122.7] as [number, number],
          [10.9, 123.1] as [number, number]
        )
        if (bounds.contains([lat, lng])) {
          handleLocationSelect(lat, lng)
        } else {
          alert("Location is outside Northern Negros Occidental area. Please select a location within the allowed area.")
        }
      } else {
        alert("Location not found. Please try a different search term.")
      }
    } catch (error) {
      console.error("Error searching location:", error)
      alert("Error searching location. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (selectedLat !== null && selectedLng !== null && address) {
      onSelect({
        address,
        lat: selectedLat,
        lng: selectedLng
      })
      onClose()
    }
  }

  // Don't render map until client-side
  if (!isClient) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Location</DialogTitle>
            <DialogDescription>
              Click on the map or search to select a location in Northern Negros Occidental (Bacolod area)
            </DialogDescription>
          </DialogHeader>
          <div className="h-[400px] w-full flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm">Loading...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Location</DialogTitle>
          <DialogDescription>
            Click on the map or search to select a location in Northern Negros Occidental (Bacolod area)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search for a location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
              Search
            </Button>
          </div>

          {/* Map Container */}
          <div className="flex-1 relative border rounded-lg overflow-hidden min-h-[400px]">
            {isOpen && isClient && (
              <MapErrorBoundary>
                <LocationMap
                  selectedLat={selectedLat != null && !isNaN(selectedLat) && isFinite(selectedLat) ? selectedLat : BACOLOD_CENTER[0]}
                  selectedLng={selectedLng != null && !isNaN(selectedLng) && isFinite(selectedLng) ? selectedLng : BACOLOD_CENTER[1]}
                  address={address}
                  onLocationSelect={handleLocationSelect}
                />
              </MapErrorBoundary>
            )}
          </div>

          {/* Selected Location Info */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Address
                </label>
                {loading ? (
                  <p className="text-sm text-gray-500">Loading address...</p>
                ) : (
                  <p className="text-sm text-gray-900">{address || "Click on the map to select a location"}</p>
                )}
                {selectedLat && selectedLng && (
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={selectedLat === null || selectedLng === null || !address || loading}
            >
              Confirm Location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
