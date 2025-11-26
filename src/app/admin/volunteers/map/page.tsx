"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { MapPin, Users, Radio, Filter, RefreshCw, Clock } from "lucide-react"
import dynamic from "next/dynamic"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
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
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchVolunteers = async () => {
    try {
      setLoading(true)
      
      // FIXED: Removed nested volunteer_profiles to avoid ambiguous FK error
      const { data, error } = await supabase
        .from('volunteer_locations')
        .select(`
          user_id,
          lat,
          lng,
          accuracy,
          created_at,
          users!volunteer_locations_user_id_fkey (
            first_name,
            last_name,
            email,
            phone_number
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get unique volunteers (latest location per user)
      const uniqueVolunteers = new Map<string, any>()
      data?.forEach((loc: any) => {
        if (!uniqueVolunteers.has(loc.user_id)) {
          uniqueVolunteers.set(loc.user_id, loc)
        }
      })

      // Transform the data
      const transformed = Array.from(uniqueVolunteers.values())
        .filter(v => v.users)
        .map(v => ({
          id: v.user_id,
          user_id: v.user_id,
          first_name: v.users?.first_name,
          last_name: v.users?.last_name,
          email: v.users?.email,
          phone_number: v.users?.phone_number,
          latitude: v.lat,
          longitude: v.lng,
          accuracy: v.accuracy,
          last_location_update: v.created_at,
          status: 'available',
          skills: [],
          assigned_barangays: []
        }))

      setVolunteers(transformed)
      setLastUpdate(new Date())
    } catch (error: any) {
      console.error('Error fetching volunteers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchVolunteers()
    }
  }, [user])

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

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <MapComponent
            center={[10.7, 122.9]}
            zoom={13}
            height="600px"
            showBoundary={true}
            showVolunteerLocations={true}
            showRealtimeStatus={true}
            userLocation={false}
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Volunteer List ({filteredVolunteers.length})
            </h3>
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