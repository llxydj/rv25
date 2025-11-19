"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import "leaflet/dist/leaflet.css"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { MapPin, Navigation, Clock, Radio, Eye, EyeOff, TrendingUp as RouteIcon, User, List, Map, Filter, AlertCircle, ArrowRight } from "lucide-react"
import { GEOLOCATION_CONFIG } from "@/lib/geolocation-config"
import Link from "next/link"

/**
 * Enhanced Volunteer Map with Phase 2 Features:
 * - Marker clustering for scalability
 * - Route/path visualization
 * - Smooth marker animations
 * - Status badges and legend
 * - Mobile-responsive controls
 * - Accessibility improvements
 */

interface VolunteerLocation {
  id: string
  user_id: string
  lat: number
  lng: number
  accuracy?: number
  speed?: number | null
  heading?: number | null
  created_at: string
  is_within_talisay_city?: boolean
  // User info
  first_name?: string
  last_name?: string
  // Status info
  status?: 'available' | 'on_task' | 'offline' | 'unavailable'
  // Additional fields
  assigned_barangays?: string[]
  skills?: string[]
}

interface RoutePoint {
  lat: number
  lng: number
  created_at: string
}

interface Incident {
  id: string
  incident_type: string
  status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED'
  location_lat: number
  location_lng: number
  assigned_to?: string | null
  barangay: string
  severity: number
  created_at: string
}

// Status color mapping
const STATUS_COLORS = {
  available: { bg: 'bg-green-500', text: 'text-green-700', label: 'Available', icon: '🟢' },
  on_task: { bg: 'bg-blue-500', text: 'text-blue-700', label: 'On Task', icon: '🔵' },
  offline: { bg: 'bg-gray-400', text: 'text-gray-600', label: 'Offline', icon: '⚫' },
  unavailable: { bg: 'bg-red-500', text: 'text-red-700', label: 'Unavailable', icon: '🔴' }
} as const

// Custom marker icons by status
const createCustomIcon = (status: string = 'available') => {
  const color = status === 'available' ? '#22c55e' : 
                status === 'on_task' ? '#3b82f6' : 
                status === 'offline' ? '#9ca3af' : '#ef4444'
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative">
        <div class="absolute -translate-x-1/2 -translate-y-full">
          <div class="relative">
            <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26c0-8.837-7.163-16-16-16z" fill="${color}"/>
              <circle cx="16" cy="16" r="6" fill="white"/>
            </svg>
            <div class="absolute top-0 left-0 w-full h-full flex items-center justify-center">
              <div class="w-3 h-3 rounded-full ${status === 'on_task' ? 'animate-pulse' : ''}" style="background: white; margin-top: -8px"></div>
            </div>
          </div>
        </div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42]
  })
}

// Animated marker component
function AnimatedMarker({ position, volunteer, onShowRoute }: { 
  position: [number, number]
  volunteer: VolunteerLocation
  onShowRoute: (userId: string) => void
}) {
  const markerRef = useRef<any>(null)
  const prevPositionRef = useRef(position)

  useEffect(() => {
    if (markerRef.current) {
      const marker = markerRef.current
      const prevPos = prevPositionRef.current
      
      // Smooth animation from previous position to new position
      if (prevPos[0] !== position[0] || prevPos[1] !== position[1]) {
        const startLatLng = L.latLng(prevPos[0], prevPos[1])
        const endLatLng = L.latLng(position[0], position[1])
        
        const duration = 1000 // 1 second animation
        const steps = 60
        const stepDuration = duration / steps
        let currentStep = 0
        
        const animate = () => {
          currentStep++
          const progress = currentStep / steps
          const easeProgress = 1 - Math.pow(1 - progress, 3) // Ease out cubic
          
          const lat = startLatLng.lat + (endLatLng.lat - startLatLng.lat) * easeProgress
          const lng = startLatLng.lng + (endLatLng.lng - startLatLng.lng) * easeProgress
          
          marker.setLatLng([lat, lng])
          
          if (currentStep < steps) {
            requestAnimationFrame(animate)
          }
        }
        
        requestAnimationFrame(animate)
      }
      
      prevPositionRef.current = position
    }
  }, [position])

  const statusInfo = STATUS_COLORS[volunteer.status || 'offline']
  const name = volunteer.first_name && volunteer.last_name 
    ? `${volunteer.first_name} ${volunteer.last_name}` 
    : 'Volunteer'

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={createCustomIcon(volunteer.status)}
    >
      <Popup className="volunteer-popup">
        <div className="min-w-[200px] sm:min-w-[220px] p-3 sm:p-2">
          <div className="flex items-center justify-between mb-3 sm:mb-2 gap-2">
            <h3 className="font-semibold text-base sm:text-sm flex-1 truncate">{name}</h3>
            <Badge variant="outline" className={statusInfo.bg + ' text-white border-0 text-xs whitespace-nowrap'}>
              {statusInfo.label}
            </Badge>
          </div>
          
          <div className="space-y-2 sm:space-y-1 text-sm sm:text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 sm:h-3 sm:w-3 flex-shrink-0" />
              <span className="break-all">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
            </div>
            
            {volunteer.accuracy && (
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 sm:h-3 sm:w-3 flex-shrink-0" />
                <span>Accuracy: ±{volunteer.accuracy.toFixed(0)}m</span>
              </div>
            )}
            
            {volunteer.speed && volunteer.speed > 0 && (
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 sm:h-3 sm:w-3 flex-shrink-0" />
                <span>Speed: {(volunteer.speed * 3.6).toFixed(1)} km/h</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 sm:h-3 sm:w-3 flex-shrink-0" />
              <span>{new Date(volunteer.created_at).toLocaleTimeString()}</span>
            </div>
          </div>
          
          <div className="flex gap-2 mt-3 sm:mt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 h-10 sm:h-8 touch-manipulation"
              onClick={() => onShowRoute(volunteer.user_id)}
            >
              <RouteIcon className="h-4 w-4 sm:h-3 sm:w-3 mr-2 sm:mr-1" />
              Route
            </Button>
            <Link href={`/admin/volunteers/${volunteer.user_id}`} target="_blank">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-10 sm:h-8 touch-manipulation"
              >
                <User className="h-4 w-4 sm:h-3 sm:w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

// Route polyline component
function RoutePolyline({ route, color = "#3b82f6" }: { route: RoutePoint[], color?: string }) {
  const positions: [number, number][] = useMemo(() => {
    return route.map(p => [p.lat, p.lng])
  }, [route])

  if (positions.length < 2) return null

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: color,
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      }}
    />
  )
}

export interface VolunteerMapEnhancedProps {
  height?: string
  showClustering?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export function VolunteerMapEnhanced({ 
  height = "600px",
  showClustering = true,
  autoRefresh = true,
  refreshInterval = 10000 // 10 seconds
}: VolunteerMapEnhancedProps) {
  const { toast } = useToast()
  const [volunteers, setVolunteers] = useState<VolunteerLocation[]>([])
  const [routes, setRoutes] = useState<Record<string, RoutePoint[]>>({})
  const [loading, setLoading] = useState(true)
  const [showRoutes, setShowRoutes] = useState(false)
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterBarangay, setFilterBarangay] = useState<string | null>(null)
  const [clusteringEnabled, setClusteringEnabled] = useState(showClustering)
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'both'>('both')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [showIncidents, setShowIncidents] = useState(true)

  // Fetch active incidents
  const fetchIncidents = async () => {
    try {
      const response = await fetch('/api/incidents?status=ASSIGNED&status=RESPONDING&projection=map&limit=50')
      if (!response.ok) throw new Error('Failed to fetch incidents')
      
      const result = await response.json()
      if (result.success) {
        setIncidents(result.data || [])
      }
    } catch (error: any) {
      console.error('[volunteer-map] Incident fetch error:', error)
    }
  }

  // Fetch volunteer locations
  const fetchVolunteers = async () => {
    try {
      const response = await fetch('/api/admin/volunteers/locations')
      if (!response.ok) throw new Error('Failed to fetch locations')
      
      const result = await response.json()
      if (result.success) {
        setVolunteers(result.data || [])
      } else {
        throw new Error(result.message || 'Unknown error')
      }
    } catch (error: any) {
      console.error('[volunteer-map] Fetch error:', error)
      toast({
        variant: "destructive",
        title: "Failed to load locations",
        description: error.message || "Please try again later"
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch route for specific volunteer
  const fetchRoute = async (userId: string) => {
    try {
      const response = await fetch(`/api/volunteer/location/route?user_id=${userId}&since=180`)
      if (!response.ok) throw new Error('Failed to fetch route')
      
      const result = await response.json()
      if (result.success && result.data.route) {
        setRoutes(prev => ({
          ...prev,
          [userId]: result.data.route
        }))
        setShowRoutes(true)
        setSelectedVolunteer(userId)
        
        toast({
          title: "Route loaded",
          description: `Showing ${result.data.simplifiedPointCount} points from last 3 hours`
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load route",
        description: error.message
      })
    }
  }

  useEffect(() => {
    fetchVolunteers()
    fetchIncidents()

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchVolunteers()
        fetchIncidents()
      }, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  // Filter volunteers by status and barangay
  const filteredVolunteers = useMemo(() => {
    let filtered = volunteers
    
    if (filterStatus) {
      filtered = filtered.filter(v => v.status === filterStatus)
    }
    
    if (filterBarangay) {
      filtered = filtered.filter(v => 
        v.assigned_barangays?.some(b => 
          b.toUpperCase() === filterBarangay.toUpperCase()
        )
      )
    }
    
    return filtered
  }, [volunteers, filterStatus, filterBarangay])
  
  // Get unique barangays from volunteers
  const availableBarangays = useMemo(() => {
    const barangays = new Set<string>()
    volunteers.forEach(v => {
      v.assigned_barangays?.forEach(b => barangays.add(b))
    })
    return Array.from(barangays).sort()
  }, [volunteers])

  // Cluster threshold check
  const shouldCluster = clusteringEnabled && filteredVolunteers.length >= GEOLOCATION_CONFIG.CLUSTER_THRESHOLD

  const talisayCenter: [number, number] = [10.7306, 122.9479]

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading volunteer locations...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        {/* Mobile-optimized header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl sm:text-2xl">Volunteer Locations</CardTitle>
            <CardDescription className="text-sm sm:text-base mt-1">
              {filteredVolunteers.length} volunteer{filteredVolunteers.length !== 1 ? 's' : ''} tracked
              {shouldCluster && ' (clustered)'}
            </CardDescription>
          </div>
          
          {/* Mobile-friendly controls with larger touch targets */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchVolunteers}
              className="h-11 sm:h-9 px-4 touch-manipulation"
            >
              <Radio className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            
            <div className="flex items-center gap-2 h-11 sm:h-auto px-3 sm:px-0">
              <Switch
                id="routes"
                checked={showRoutes}
                onCheckedChange={setShowRoutes}
                aria-label="Toggle route visibility"
                className="scale-110 sm:scale-100"
              />
              <Label htmlFor="routes" className="cursor-pointer flex items-center gap-2 touch-manipulation">
                {showRoutes ? <Eye className="h-5 w-5 sm:h-4 sm:w-4" /> : <EyeOff className="h-5 w-5 sm:h-4 sm:w-4" />}
                <span className="text-sm sm:text-base">Routes</span>
              </Label>
            </div>
            
            <div className="flex items-center gap-2 h-11 sm:h-auto px-3 sm:px-0">
              <Switch
                id="incidents"
                checked={showIncidents}
                onCheckedChange={setShowIncidents}
                aria-label="Toggle incident visibility"
                className="scale-110 sm:scale-100"
              />
              <Label htmlFor="incidents" className="cursor-pointer flex items-center gap-2 touch-manipulation">
                <AlertCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="text-sm sm:text-base">Incidents ({incidents.length})</span>
              </Label>
            </div>
            
            {volunteers.length >= GEOLOCATION_CONFIG.CLUSTER_THRESHOLD && (
              <div className="flex items-center gap-2 h-11 sm:h-auto px-3 sm:px-0">
                <Switch
                  id="clustering"
                  checked={clusteringEnabled}
                  onCheckedChange={setClusteringEnabled}
                  aria-label="Toggle marker clustering"
                  className="scale-110 sm:scale-100"
                />
                <Label htmlFor="clustering" className="cursor-pointer text-sm sm:text-base touch-manipulation">
                  Clustering
                </Label>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 border-t pt-4">
          <Filter className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium">View:</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={viewMode === 'map' ? 'default' : 'outline'}
              onClick={() => setViewMode('map')}
              className="h-9"
            >
              <Map className="h-4 w-4 mr-2" />
              Map
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              className="h-9"
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'both' ? 'default' : 'outline'}
              onClick={() => setViewMode('both')}
              className="h-9"
            >
              Both
            </Button>
          </div>
        </div>

        {/* Filters - Mobile Responsive */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          {/* Status Filter */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-600 block sm:inline">Status:</span>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {Object.entries(STATUS_COLORS).map(([status, info]) => (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? null : status)}
                className={`flex items-center gap-2 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-full text-sm sm:text-xs transition-all touch-manipulation min-h-[44px] sm:min-h-0 ${
                  filterStatus === status 
                    ? `${info.bg} text-white shadow-md` 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
                aria-label={`Filter by ${info.label}`}
                aria-pressed={filterStatus === status}
              >
                <span className="text-base sm:text-sm">{info.icon}</span>
                <span className="font-medium">{info.label}</span>
                <Badge 
                  variant="secondary" 
                  className={`ml-1 ${filterStatus === status ? 'bg-white/20 text-white' : ''}`}
                >
                  {volunteers.filter(v => v.status === status).length}
                </Badge>
              </button>
            ))}
            {filterStatus && (
              <button
                onClick={() => setFilterStatus(null)}
                className="flex items-center gap-1 px-3 py-2 sm:px-2 sm:py-1 rounded-md text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 touch-manipulation"
                aria-label="Clear filter"
              >
                <span className="text-lg sm:text-base">✕</span>
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
          
          {/* Barangay Filter */}
          {availableBarangays.length > 0 && (
            <div className="space-y-2 mt-3">
              <span className="text-xs font-medium text-gray-600 block sm:inline">Barangay:</span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFilterBarangay(null)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all touch-manipulation ${
                    !filterBarangay
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {availableBarangays.map((barangay) => (
                  <button
                    key={barangay}
                    onClick={() => setFilterBarangay(filterBarangay === barangay ? null : barangay)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all touch-manipulation ${
                      filterBarangay === barangay
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {barangay}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {(viewMode === 'map' || viewMode === 'both') && (
        <div style={{ height }} className="rounded-lg overflow-hidden border mb-6">
          <MapContainer
            center={talisayCenter}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Render markers with or without clustering */}
            {shouldCluster ? (
              <MarkerClusterGroup
                chunkedLoading
                maxClusterRadius={60}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
              >
                {filteredVolunteers.map(volunteer => (
                  <AnimatedMarker
                    key={volunteer.id}
                    position={[volunteer.lat, volunteer.lng]}
                    volunteer={volunteer}
                    onShowRoute={fetchRoute}
                  />
                ))}
              </MarkerClusterGroup>
            ) : (
              filteredVolunteers.map(volunteer => (
                <AnimatedMarker
                  key={volunteer.id}
                  position={[volunteer.lat, volunteer.lng]}
                  volunteer={volunteer}
                  onShowRoute={fetchRoute}
                />
              ))
            )}

            {/* Render incidents */}
            {showIncidents && incidents.map(incident => {
              const incidentColor = incident.status === 'ASSIGNED' ? '#f59e0b' : 
                                   incident.status === 'RESPONDING' ? '#ef4444' : '#6b7280'
              const incidentIcon = L.divIcon({
                className: 'custom-incident-marker',
                html: `
                  <div class="relative">
                    <div class="absolute -translate-x-1/2 -translate-y-full">
                      <div class="relative">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background: ${incidentColor}; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                          <span style="color: white; font-size: 16px;">⚠️</span>
                        </div>
                        ${incident.severity <= 2 ? '<div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>' : ''}
                      </div>
                    </div>
                  </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
              })

              return (
                <Marker
                  key={incident.id}
                  position={[incident.location_lat, incident.location_lng]}
                  icon={incidentIcon}
                >
                  <Popup>
                    <div className="min-w-[180px] p-2">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm">{incident.incident_type}</h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            incident.status === 'ASSIGNED' ? 'bg-amber-500 text-white border-0' :
                            incident.status === 'RESPONDING' ? 'bg-red-500 text-white border-0' :
                            'bg-gray-500 text-white border-0'
                          }`}
                        >
                          {incident.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>📍 {incident.barangay}</p>
                        <p>🚨 Priority: {incident.severity}/5</p>
                        <p>🕒 {new Date(incident.created_at).toLocaleTimeString()}</p>
                      </div>
                      {incident.assigned_to && (
                        <Link href={`/admin/incidents/${incident.id}`} target="_blank">
                          <Button size="sm" variant="outline" className="w-full mt-2">
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            })}

            {/* Render route lines from volunteers to incidents */}
            {showIncidents && showRoutes && incidents
              .filter(i => i.assigned_to && i.status === 'RESPONDING')
              .map(incident => {
                const volunteer = volunteers.find(v => v.user_id === incident.assigned_to)
                if (!volunteer) return null
                
                return (
                  <Polyline
                    key={`route-${incident.id}`}
                    positions={[
                      [volunteer.lat, volunteer.lng],
                      [incident.location_lat, incident.location_lng]
                    ]}
                    pathOptions={{
                      color: '#ef4444',
                      weight: 3,
                      opacity: 0.7,
                      dashArray: '5, 10'
                    }}
                  />
                )
              })
            }

            {/* Render routes */}
            {showRoutes && Object.entries(routes).map(([userId, route]) => (
              <RoutePolyline
                key={userId}
                route={route}
                color={selectedVolunteer === userId ? "#3b82f6" : "#94a3b8"}
              />
            ))}
          </MapContainer>
        </div>
        )}
        
        {/* Volunteer List */}
        {(viewMode === 'list' || viewMode === 'both') && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Volunteer List ({filteredVolunteers.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredVolunteers.length === 0 ? (
                <div className="p-8 text-center">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-gray-600 mt-2">No volunteers match the current filters</p>
                </div>
              ) : (
                filteredVolunteers.map((volunteer) => {
                  const statusInfo = STATUS_COLORS[volunteer.status || 'offline']
                  const name = volunteer.first_name && volunteer.last_name
                    ? `${volunteer.first_name} ${volunteer.last_name}`
                    : 'Volunteer'
                  
                  return (
                    <div key={volunteer.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 ${statusInfo.bg} rounded-lg flex-shrink-0`}>
                            <MapPin className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">{name}</h4>
                              <Badge variant="outline" className={`${statusInfo.bg} text-white border-0 text-xs whitespace-nowrap`}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 truncate">
                              📍 {volunteer.lat.toFixed(6)}, {volunteer.lng.toFixed(6)}
                            </p>
                            {volunteer.accuracy && (
                              <p className="text-xs text-gray-500 mt-1">
                                Accuracy: ±{volunteer.accuracy.toFixed(0)}m
                              </p>
                            )}
                            {volunteer.assigned_barangays && volunteer.assigned_barangays.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {volunteer.assigned_barangays.slice(0, 2).map((brgy, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                                  >
                                    {brgy}
                                  </span>
                                ))}
                                {volunteer.assigned_barangays.length > 2 && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                    +{volunteer.assigned_barangays.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchRoute(volunteer.user_id)}
                            className="h-9"
                          >
                            <RouteIcon className="h-4 w-4" />
                          </Button>
                          <Link href={`/admin/volunteers/${volunteer.user_id}`} target="_blank">
                            <Button size="sm" variant="outline" className="h-9">
                              <User className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
