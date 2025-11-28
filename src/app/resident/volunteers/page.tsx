"use client"

import { useEffect, useState } from "react"
import ResidentLayout from "@/components/layout/resident-layout"
import { MapComponent } from "@/components/ui/map-component"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Users, MapPin, Radio, Clock } from "lucide-react"
import { useAuth } from "@/lib/auth"

export default function ResidentVolunteersPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVolunteers = async () => {
      if (!user) return

      try {
        setLoading(true)
        setError(null)
        
        // Fetch available volunteers (residents can see available volunteers)
        const response = await fetch('/api/volunteer/location/public?since=30&limit=100')
        const json = await response.json()

        if (!response.ok || !json.success) {
          throw new Error(json.message || 'Failed to fetch volunteer locations')
        }

        // Get unique volunteers (latest location per volunteer)
        const uniqueVolunteers = new Map<string, any>()
        ;(json.data || []).forEach((loc: any) => {
          if (!uniqueVolunteers.has(loc.user_id)) {
            uniqueVolunteers.set(loc.user_id, loc)
          }
        })

        const transformed = Array.from(uniqueVolunteers.values())
          .filter((loc: any) => loc.lat && loc.lng)
          .map((loc: any) => ({
            id: loc.user_id,
            user_id: loc.user_id,
            latitude: loc.lat,
            longitude: loc.lng,
            accuracy: loc.accuracy,
            last_seen: loc.created_at,
            first_name: loc.users?.first_name || 'Volunteer',
            last_name: loc.users?.last_name || '',
            phone_number: loc.users?.phone_number || ''
          }))

        setVolunteers(transformed)
      } catch (err: any) {
        console.error('Error fetching volunteers:', err)
        setError(err.message || 'Failed to load volunteer locations')
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteers()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchVolunteers, 30000)
    return () => clearInterval(interval)
  }, [user])

  const stats = {
    total: volunteers.length,
    available: volunteers.length // All shown are available
  }

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Available Volunteers</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View volunteers who are currently available and sharing their location
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Available</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Location Sharing</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.available > 0 ? 'Active' : 'None'}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          {loading ? (
            <div className="h-[500px] flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-600 dark:text-red-400 font-semibold">Error</p>
                <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
              </div>
            </div>
          ) : (
            <MapComponent
              center={[10.7, 122.9]}
              zoom={13}
              height="500px"
              showBoundary={true}
              showVolunteerLocations={true}
              showRealtimeStatus={true}
              userLocation={false}
              markers={volunteers.map((v) => ({
                id: v.id || v.user_id,
                position: [v.latitude, v.longitude] as [number, number],
                status: 'ASSIGNED' as const,
                title: `${v.first_name} ${v.last_name}`.trim() || 'Volunteer',
                description: `Available volunteer${v.phone_number ? ` | Phone: ${v.phone_number}` : ''}${v.last_seen ? ` | Last seen: ${new Date(v.last_seen).toLocaleString()}` : ''}`
              }))}
            />
          )}
        </div>

        {/* Volunteer List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Available Volunteers ({volunteers.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <div className="p-8 text-center">
                <LoadingSpinner size="lg" />
                <p className="text-gray-600 dark:text-gray-400 mt-2">Loading volunteers...</p>
              </div>
            ) : volunteers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="text-gray-600 dark:text-gray-400 mt-2">No volunteers currently sharing location</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Volunteers must enable location sharing to appear here
                </p>
              </div>
            ) : (
              volunteers.map((volunteer) => (
                <div key={volunteer.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <Radio className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {volunteer.first_name} {volunteer.last_name}
                        </h4>
                        {volunteer.phone_number && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            📞 {volunteer.phone_number}
                          </p>
                        )}
                        {volunteer.latitude && volunteer.longitude && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            📍 {volunteer.latitude.toFixed(6)}, {volunteer.longitude.toFixed(6)}
                          </p>
                        )}
                        {volunteer.last_seen && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            🕒 Last seen: {new Date(volunteer.last_seen).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                        Available
                      </span>
                      {volunteer.accuracy && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ±{volunteer.accuracy.toFixed(0)}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ResidentLayout>
  )
}

