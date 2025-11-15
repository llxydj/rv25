"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock, User, Navigation } from 'lucide-react'

interface LocationTracking {
  id: string
  user_id: string
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  speed: number | null
  timestamp: string
  created_at: string
}

export function LocationTrackingManager() {
  const [locations, setLocations] = useState<LocationTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    user_id: '',
    limit: '50'
  })

  useEffect(() => {
    fetchLocations()
  }, [filters])

  const fetchLocations = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.user_id) params.append('user_id', filters.user_id)
      if (filters.limit) params.append('limit', filters.limit)

      const response = await fetch(`/api/location-tracking?${params.toString()}`)
      const result = await response.json()
      if (result.success) {
        setLocations(result.data)
      }
    } catch (error) {
      console.error('Error fetching location data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatAccuracy = (accuracy: number | null) => {
    if (!accuracy) return 'N/A'
    return `${Math.round(accuracy)}m`
  }

  const formatSpeed = (speed: number | null) => {
    if (!speed) return 'N/A'
    return `${Math.round(speed * 3.6)} km/h`
  }

  const formatHeading = (heading: number | null) => {
    if (!heading) return 'N/A'
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round(heading / 45) % 8
    return `${Math.round(heading)}° ${directions[index]}`
  }

  if (loading) {
    return <div className="p-6">Loading location data...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Location Tracking</h2>
        <Button onClick={fetchLocations}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="user_id">User ID</Label>
              <Input
                id="user_id"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                placeholder="Filter by user ID"
              />
            </div>
            <div>
              <Label htmlFor="limit">Limit</Label>
              <Select
                value={filters.limit}
                onValueChange={(value) => setFilters({ ...filters, limit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {locations.map((location) => (
          <Card key={location.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span className="font-semibold">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </span>
                      <Badge variant="outline">
                        {formatAccuracy(location.accuracy)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {location.user_id}
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="w-4 h-4" />
                        {formatHeading(location.heading)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatSpeed(location.speed)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Tracked: {formatDate(location.timestamp)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(location.created_at)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {locations.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No location data found</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

