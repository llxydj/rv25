"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { MapPin, Users, Radio, Filter, RefreshCw, Clock, History, Calendar } from "lucide-react"
import dynamic from "next/dynamic"
import { useAuth } from "@/hooks/use-auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

const MapComponent = dynamic(() => import("@/components/ui/map-enhanced"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex items-center justify-center bg-gray-50 rounded-lg">
      <LoadingSpinner size="lg" />
    </div>
  ),
})

export default function VolunteerMapPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [locationHistory, setLocationHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showHistory, setShowHistory] = useState(true)
  const [historyHours, setHistoryHours] = useState(24)

  const fetchVolunteers = async () => {
    try {
      setLoading(true)
      
      // Use the admin API endpoint which uses the active_volunteers_with_location view
      const response = await fetch('/api/admin/volunteers/locations')
      const json = await response.json()

      console.log('[fetchVolunteers] API Response:', {
        ok: response.ok,
        success: json.success,
        count: json.count,
        dataLength: json.data?.length || 0,
        message: json.message,
        code: json.code
      })

      if (!response.ok || !json.success) {
        console.error('[fetchVolunteers] API Error:', json)
        throw new Error(json.message || 'Failed to fetch volunteer locations')
      }

      // Log raw data for debugging
      if (json.data && json.data.length > 0) {
        console.log('[fetchVolunteers] Raw data sample:', json.data[0])
      } else {
        console.warn('[fetchVolunteers] No data returned from API')
      }

      // Transform the data from API format
      const transformed = (json.data || [])
        .filter((loc: any) => {
          // Validate coordinates
          const lat = parseFloat(loc.lat)
          const lng = parseFloat(loc.lng)
          const isValid = !isNaN(lat) && !isNaN(lng) && 
                 lat >= -90 && lat <= 90 && 
                 lng >= -180 && lng <= 180 &&
                 lat !== 0 && lng !== 0 // Exclude null coordinates
          
          if (!isValid && loc.lat && loc.lng) {
            console.warn('[fetchVolunteers] Invalid coordinates:', { lat: loc.lat, lng: loc.lng, user_id: loc.user_id })
          }
          
          return isValid
        })
        .map((loc: any) => ({
          id: loc.user_id,
          user_id: loc.user_id,
          first_name: loc.first_name || '',
          last_name: loc.last_name || '',
          email: loc.email || '',
          phone_number: loc.phone_number || '',
          latitude: parseFloat(loc.lat),
          longitude: parseFloat(loc.lng),
          accuracy: loc.accuracy,
          last_location_update: loc.created_at,
          status: loc.status || 'offline',
          skills: loc.skills || [],
          assigned_barangays: loc.assigned_barangays || []
        }))
      
      console.log(`[fetchVolunteers] ✅ Transformed ${transformed.length} volunteers with valid coordinates`)
      if (transformed.length > 0) {
        console.log('[fetchVolunteers] Volunteer data:', transformed.map(v => ({
          id: v.user_id,
          name: `${v.first_name} ${v.last_name}`,
          lat: v.latitude,
          lng: v.longitude,
          status: v.status
        })))
      } else {
        console.warn('[fetchVolunteers] ⚠️ No volunteers with valid coordinates found')
      }

      setVolunteers(transformed)
      setLastUpdate(new Date())
    } catch (error: any) {
      console.error('[fetchVolunteers] Error:', error)
      setVolunteers([]) // Clear volunteers on error
    } finally {
      setLoading(false)
    }
  }

  const fetchLocationHistory = async () => {
    try {
      setHistoryLoading(true)
      const response = await fetch(`/api/admin/volunteers/location-history?hours=${historyHours}&limit=1`)
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch location history')
      }

      // Transform the data
      const transformed = (json.data || [])
        .filter((loc: any) => {
          const lat = parseFloat(loc.lat)
          const lng = parseFloat(loc.lng)
          return !isNaN(lat) && !isNaN(lng) && 
                 lat >= -90 && lat <= 90 && 
                 lng >= -180 && lng <= 180 &&
                 lat !== 0 && lng !== 0
        })
        .map((loc: any) => ({
          id: loc.id,
          user_id: loc.user_id,
          first_name: loc.first_name || '',
          last_name: loc.last_name || '',
          email: loc.email || '',
          phone_number: loc.phone_number || '',
          latitude: parseFloat(loc.lat),
          longitude: parseFloat(loc.lng),
          accuracy: loc.accuracy,
          created_at: loc.created_at,
          status: loc.status || 'offline',
          is_available: loc.is_available || false
        }))

      setLocationHistory(transformed)
    } catch (error: any) {
      console.error('Error fetching location history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchVolunteers()
      if (showHistory) {
        fetchLocationHistory()
      }
    }
  }, [user, showHistory, historyHours])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchVolunteers()
    }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const filteredVolunteers = volunteers.filter(v => {
    if (statusFilter === 'all') return true
    return v.status === statusFilter
  })

  const stats = {
    total: volunteers.length,
    available: volunteers.filter(v => v.status === 'available').length,
    onTask: volunteers.filter(v => v.status === 'on_task').length,
    offline: volunteers.filter(v => v.status === 'offline' || !v.status).length,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-50 border-green-200'
      case 'on_task': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'offline': return 'text-gray-600 bg-gray-50 border-gray-200'
      case 'unavailable': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Available'
      case 'on_task': return 'On Task'
      case 'offline': return 'Offline'
      case 'unavailable': return 'Unavailable'
      default: return 'Unknown'
    }
  }

  if (user?.role !== 'admin') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 font-semibold">Access Denied</p>
            <p className="text-gray-600 mt-2">Only administrators can access this page.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Volunteer Location Tracking</h1>
            <p className="text-gray-600 mt-1">Real-time volunteer positions and availability</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
            <button
              onClick={() => fetchVolunteers()}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Active</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.available}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Radio className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">On Task</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.onTask}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Offline</p>
                <p className="text-2xl font-bold text-gray-600 mt-1">{stats.offline}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <Users className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <div className="flex gap-2 ml-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'available', label: 'Available' },
                { value: 'on_task', label: 'On Task' },
                { value: 'offline', label: 'Offline' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    statusFilter === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-gray-600">Auto-refresh:</label>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoRefresh ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Map Legend */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow-md"></div>
              <span className="text-xs text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-md"></div>
              <span className="text-xs text-gray-600">On Task</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white shadow-md"></div>
              <span className="text-xs text-gray-600">Offline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-md"></div>
              <span className="text-xs text-gray-600">Unavailable</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {loading ? (
            <div className="h-[600px] flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <MapComponent
              center={[10.7, 122.9]}
              zoom={13}
              height="600px"
              showBoundary={true}
              showVolunteerLocations={true}
              showRealtimeStatus={true}
              userLocation={false}
              markers={[
                // Fallback: Show current volunteers as markers (in case real-time hook has issues)
                ...filteredVolunteers
                  .filter(v => v.latitude && v.longitude && !isNaN(v.latitude) && !isNaN(v.longitude))
                  .map((v) => ({
                    id: `volunteer_${v.id || v.user_id}`,
                    position: [v.latitude, v.longitude] as [number, number],
                    status: v.status === 'available' ? 'ASSIGNED' : v.status === 'on_task' ? 'RESPONDING' : 'PENDING',
                    title: `${v.first_name || ''} ${v.last_name || ''}`.trim() || 'Volunteer',
                    description: `Status: ${getStatusLabel(v.status || 'offline')}${v.phone_number ? ` | Phone: ${v.phone_number}` : ''}${v.last_location_update ? ` | Last seen: ${new Date(v.last_location_update).toLocaleString()}` : ''}`
                  })),
                // Past locations (last known positions for offline volunteers)
                ...(showHistory ? locationHistory
                  .filter(v => v.latitude && v.longitude && !isNaN(v.latitude) && !isNaN(v.longitude))
                  .filter(v => !filteredVolunteers.some(curr => curr.user_id === v.user_id)) // Only show if not in current locations
                  .map((v) => ({
                    id: `history_${v.id}`,
                    position: [v.latitude, v.longitude] as [number, number],
                    status: 'PENDING' as const,
                    title: `${v.first_name || ''} ${v.last_name || ''}`.trim() || 'Volunteer',
                    description: `[Last Known] Status: ${getStatusLabel(v.status || 'offline')}${v.phone_number ? ` | Phone: ${v.phone_number}` : ''} | Recorded: ${new Date(v.created_at).toLocaleString()}`
                  })) : [])
              ]}
            />
          )}
        </div>

        {/* Location History Logs Table */}
        {showHistory && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Location History Logs
                </h3>
                <span className="text-sm text-gray-500">
                  ({locationHistory.length} last known positions)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={historyHours}
                  onChange={(e) => setHistoryHours(parseInt(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={6}>Last 6 hours</option>
                  <option value={12}>Last 12 hours</option>
                  <option value={24}>Last 24 hours</option>
                  <option value={48}>Last 48 hours</option>
                  <option value={72}>Last 3 days</option>
                  <option value={168}>Last 7 days</option>
                </select>
                <button
                  onClick={() => fetchLocationHistory()}
                  disabled={historyLoading}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${historyLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {showHistory ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {historyLoading ? (
                <div className="p-8 text-center">
                  <LoadingSpinner size="md" />
                  <p className="text-gray-600 mt-2">Loading location history...</p>
                </div>
              ) : locationHistory.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-gray-600 mt-2">No location history found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    No past positions recorded in the last {historyHours} hours
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Volunteer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recorded At
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Accuracy
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {locationHistory.map((loc) => (
                      <tr key={loc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {loc.first_name} {loc.last_name}
                            </div>
                            {loc.email && (
                              <div className="text-xs text-gray-500">{loc.email}</div>
                            )}
                            {loc.phone_number && (
                              <div className="text-xs text-blue-600">📞 {loc.phone_number}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="font-mono text-xs">
                                {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(loc.created_at).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(() => {
                              const diff = Date.now() - new Date(loc.created_at).getTime()
                              const hours = Math.floor(diff / (1000 * 60 * 60))
                              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                              if (hours > 0) return `${hours}h ${minutes}m ago`
                              return `${minutes}m ago`
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              loc.status || 'offline'
                            )}`}
                          >
                            {getStatusLabel(loc.status || 'offline')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {loc.accuracy ? `±${loc.accuracy.toFixed(0)}m` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Current Volunteer Locations ({filteredVolunteers.length})
            </h3>
            {!showHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <History className="h-4 w-4" />
                Show Location History
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center">
                <LoadingSpinner size="lg" />
                <p className="text-gray-600 mt-2">Loading volunteers...</p>
              </div>
            ) : filteredVolunteers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="text-gray-600 mt-2">No volunteers with active location tracking</p>
                <p className="text-sm text-gray-500 mt-1">
                  Volunteers must enable location sharing to appear here
                </p>
              </div>
            ) : (
              filteredVolunteers.map((volunteer) => (
                <div key={volunteer.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <MapPin className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {volunteer.first_name} {volunteer.last_name}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{volunteer.email}</p>
                        {volunteer.phone_number && (
                          <p className="text-sm text-blue-600 mt-1">📞 {volunteer.phone_number}</p>
                        )}
                        {volunteer.latitude && volunteer.longitude && (
                          <p className="text-xs text-gray-500 mt-1">
                            📍 {volunteer.latitude.toFixed(6)}, {volunteer.longitude.toFixed(6)}
                          </p>
                        )}
                        {volunteer.last_location_update && (
                          <p className="text-xs text-gray-500 mt-1">
                            🕒 Last seen: {new Date(volunteer.last_location_update).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          volunteer.status || 'offline'
                        )}`}
                      >
                        {getStatusLabel(volunteer.status || 'offline')}
                      </span>
                      {volunteer.accuracy && (
                        <span className="text-xs text-gray-500">
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
    </AdminLayout>
  )
}