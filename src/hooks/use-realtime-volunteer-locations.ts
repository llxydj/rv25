// src/hooks/use-realtime-volunteer-locations.ts
"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { isWithinTalisayCity } from '@/lib/geo-utils'
import { useAuth } from '@/hooks/use-auth'

export interface VolunteerLocation {
  user_id: string
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  last_seen: string
  first_name?: string
  last_name?: string
  phone_number?: string
  distance_km?: number
}

interface UseRealtimeVolunteerLocationsOptions {
  center: [number, number]
  radiusKm?: number
  enabled?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
}

export function useRealtimeVolunteerLocations({
  center,
  radiusKm = 10,
  enabled = true,
  reconnectAttempts = 5,
  reconnectInterval = 3000
}: UseRealtimeVolunteerLocationsOptions) {
  const { user } = useAuth()
  const [volunteers, setVolunteers] = useState<VolunteerLocation[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting')

  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)
  const lastFetchRef = useRef<number>(0)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Store center and radius in refs to avoid dependency issues
  const centerRef = useRef(center)
  const radiusRef = useRef(radiusKm)
  
  // Check if user is admin or barangay
  const isAdminOrBarangay = user?.role === 'admin' || user?.role === 'barangay'
  
  // Update refs when props change
  useEffect(() => {
    centerRef.current = center
  }, [center])
  
  useEffect(() => {
    radiusRef.current = radiusKm
  }, [radiusKm])

  // --- Helper: distance calculation (stable, no dependencies) ---
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }, [])

  // --- Fetch volunteer locations (stable, uses refs) ---
  const fetchVolunteers = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return

    // Throttle fetches to avoid excessive API calls (min 5 seconds between fetches for mobile)
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchRef.current
    if (timeSinceLastFetch < 5000) {
      return
    }
    lastFetchRef.current = now

    try {
      setIsLoading(true)
      setError(null)

      // Only try admin API if user is admin or barangay
      if (isAdminOrBarangay) {
        try {
          const adminResponse = await fetch('/api/admin/volunteers/locations')
          if (adminResponse.ok) {
            const adminJson = await adminResponse.json()
            if (adminJson.success && adminJson.data && Array.isArray(adminJson.data)) {
              // Use current values from refs
              const currentCenter = centerRef.current
              const currentRadius = radiusRef.current

              // Don't filter by radius for admin - show all volunteers
              const filtered = adminJson.data
                .filter((loc: any) => loc.lat && loc.lng && isWithinTalisayCity(loc.lat, loc.lng))
                .map((loc: any) => {
                  const distance = calculateDistance(currentCenter[0], currentCenter[1], loc.lat, loc.lng)
                  return {
                    user_id: loc.user_id,
                    latitude: loc.lat,
                    longitude: loc.lng,
                    accuracy: loc.accuracy,
                    speed: loc.speed || null,
                    last_seen: loc.created_at,
                    first_name: loc.first_name,
                    last_name: loc.last_name,
                    phone_number: loc.phone_number || '',
                    distance_km: distance
                  }
                })
                // For admin, show all volunteers regardless of radius
                .sort((a: any, b: any) => a.distance_km - b.distance_km)

              if (isMountedRef.current) {
                setVolunteers(filtered)
                console.log(`✅ Fetched ${filtered.length} volunteers via admin API`)
              }
              return
            }
          } else if (adminResponse.status === 403) {
            // Expected 403 for non-admin users - don't log as error, just fall through
            // This shouldn't happen if isAdminOrBarangay is correct, but handle gracefully
          }
        } catch (adminErr: any) {
          // Only log non-403 errors
          if (adminErr?.status !== 403) {
            console.warn('Admin API error (non-403), using direct query:', adminErr)
          }
        }
      }

      // For residents, use the public API endpoint (they don't have direct DB access)
      if (user?.role === 'resident') {
        // Add timeout to prevent hanging (5 seconds max)
        const controller = new AbortController()
        let timeoutId: NodeJS.Timeout | null = null
        
        try {
          timeoutId = setTimeout(() => controller.abort(), 5000)
          
          const publicResponse = await fetch('/api/volunteer/location/public?since=30&limit=100', {
            signal: controller.signal,
            cache: 'no-store'
          })
          
          if (timeoutId) clearTimeout(timeoutId)
          
          if (publicResponse.ok) {
            const publicJson = await publicResponse.json()
            if (publicJson.success && publicJson.data && Array.isArray(publicJson.data)) {
              const currentCenter = centerRef.current
              const currentRadius = radiusRef.current

              const filtered = publicJson.data
                .filter((loc: any) => loc.lat && loc.lng && isWithinTalisayCity(loc.lat, loc.lng))
                .map((loc: any) => {
                  const distance = calculateDistance(currentCenter[0], currentCenter[1], loc.lat, loc.lng)
                  return {
                    user_id: loc.user_id,
                    latitude: loc.lat,
                    longitude: loc.lng,
                    accuracy: loc.accuracy,
                    speed: loc.speed || null,
                    last_seen: loc.created_at,
                    first_name: loc.first_name || '',
                    last_name: loc.last_name || '',
                    phone_number: loc.phone_number || '',
                    distance_km: distance
                  }
                })
                .filter((v: any) => v.distance_km <= currentRadius)
                .sort((a: any, b: any) => a.distance_km - b.distance_km)

              if (isMountedRef.current) {
                setVolunteers(filtered)
                console.log(`✅ Fetched ${filtered.length} volunteers via public API (resident)`)
              }
              return
            }
          } else {
            console.warn('Public API returned non-OK status:', publicResponse.status)
          }
        } catch (publicErr: any) {
          if (timeoutId) clearTimeout(timeoutId)
          // Don't spam console with timeout errors - they're expected on slow networks
          if (publicErr.name === 'AbortError' || publicErr.message?.includes('timeout')) {
            // Silently handle timeout - it's non-critical for volunteer locations
            if (isMountedRef.current) {
              setVolunteers([]) // Clear volunteers on timeout
            }
            return // Don't try fallback on timeout
          } else {
            console.warn('Public API not available, trying direct query:', publicErr)
          }
        }
      }

      // Fallback to direct database query (for volunteers and other roles with DB access)
      const { data: locations, error: locError } = await supabase
        .from('volunteer_locations')
        .select(`
          user_id,
          lat,
          lng,
          accuracy,
          speed,
          created_at,
          users!volunteer_locations_user_id_fkey (
            first_name,
            last_name,
            phone_number
          )
        `)
        .order('created_at', { ascending: false })

      if (locError) {
        // If direct query fails (e.g., RLS permission denied), return empty array gracefully
        console.warn('Direct database query failed (may be RLS restriction):', locError.message)
        if (isMountedRef.current) {
          setVolunteers([])
          setError(null) // Don't show error for expected permission issues
        }
        return
      }

      const uniqueVolunteers = new Map<string, any>()
      locations?.forEach(loc => {
        if (!uniqueVolunteers.has(loc.user_id)) {
          uniqueVolunteers.set(loc.user_id, loc)
        }
      })

      // Use current values from refs
      const currentCenter = centerRef.current
      const currentRadius = radiusRef.current

      const filtered = Array.from(uniqueVolunteers.values())
        .filter(loc => loc.lat && loc.lng && isWithinTalisayCity(loc.lat, loc.lng))
        .map(loc => {
          const distance = calculateDistance(currentCenter[0], currentCenter[1], loc.lat, loc.lng)
          return {
            user_id: loc.user_id,
            latitude: loc.lat,
            longitude: loc.lng,
            accuracy: loc.accuracy,
            speed: loc.speed,
            last_seen: loc.created_at,
            first_name: loc.users?.first_name,
            last_name: loc.users?.last_name,
            phone_number: loc.users?.phone_number,
            distance_km: distance
          }
        })
        .filter(v => v.distance_km <= currentRadius)
        .sort((a, b) => a.distance_km - b.distance_km)

      if (isMountedRef.current) {
        setVolunteers(filtered)
        console.log(`Fetched ${filtered.length} volunteers`)
      }
    } catch (err: any) {
      console.error('Failed to fetch volunteers:', err)
      if (isMountedRef.current) {
        setError(err.message)
        setVolunteers([])
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [enabled, calculateDistance, isAdminOrBarangay]) // Include isAdminOrBarangay

  // --- Cleanup (stable, no dependencies) ---
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  // --- Setup real-time subscription (stable) ---
  const setupRealtimeSubscription = useCallback(() => {
    if (!enabled || !isMountedRef.current) return

    cleanup()
    setConnectionStatus('connecting')
    console.log('Setting up real-time subscription...')

    const channel = supabase
      .channel(`volunteer-locations-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'volunteer_locations'
        },
        () => {
          // Fetch volunteers when data changes (throttled by fetchVolunteers itself)
          fetchVolunteers()
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status)
        if (!isMountedRef.current) return

        switch(status) {
          case 'SUBSCRIBED':
            setIsConnected(true)
            setConnectionStatus('connected')
            setError(null)
            reconnectAttemptsRef.current = 0
            break
          case 'CHANNEL_ERROR':
            console.error('Channel error:', err)
            setIsConnected(false)
            setConnectionStatus('disconnected')
            if (err) setError(`Connection error: ${err.message || 'Unknown error'}`)
            // Attempt reconnect
            if (reconnectAttemptsRef.current < reconnectAttempts) {
              reconnectAttemptsRef.current++
              setConnectionStatus('reconnecting')
              console.log(`Attempting reconnection ${reconnectAttemptsRef.current}/${reconnectAttempts}`)
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) setupRealtimeSubscription()
              }, reconnectInterval)
            } else {
              console.error('Max reconnection attempts reached')
              setError('Connection lost. Please refresh the page.')
            }
            break
          case 'TIMED_OUT':
            console.warn('Subscription timed out')
            if (reconnectAttemptsRef.current < reconnectAttempts) {
              reconnectAttemptsRef.current++
              setConnectionStatus('reconnecting')
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) setupRealtimeSubscription()
              }, reconnectInterval)
            }
            break
          case 'CLOSED':
            setIsConnected(false)
            setConnectionStatus('disconnected')
            break
        }
      })

    channelRef.current = channel
  }, [enabled, cleanup, fetchVolunteers, reconnectAttempts, reconnectInterval])

  // --- Main effect: initial setup ---
  useEffect(() => {
    isMountedRef.current = true

    if (!enabled) {
      setVolunteers([])
      setIsConnected(false)
      setConnectionStatus('disconnected')
      cleanup()
      return
    }

    // Initial fetch
    fetchVolunteers()
    
    // Setup real-time subscription
    setupRealtimeSubscription()

    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [enabled, cleanup, fetchVolunteers, setupRealtimeSubscription])

  // --- Refetch when center or radius changes significantly ---
  useEffect(() => {
    if (!enabled) return
    
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    
    // Debounce refetch to avoid excessive calls (increased to 1 second)
    fetchTimeoutRef.current = setTimeout(() => {
      fetchVolunteers()
    }, 1000)
    
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [center[0], center[1], radiusKm, enabled, fetchVolunteers])

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    setupRealtimeSubscription()
  }, [setupRealtimeSubscription])

  return {
    volunteers,
    isConnected,
    isLoading,
    error,
    connectionStatus,
    refetch: fetchVolunteers,
    reconnect
  }
}