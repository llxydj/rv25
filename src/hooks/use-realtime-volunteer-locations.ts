"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { isWithinTalisayCity } from '@/lib/geo-utils'

export interface VolunteerLocation {
  user_id: string
  latitude: number
  longitude: number
  accuracy?: number
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
  const [volunteers, setVolunteers] = useState<VolunteerLocation[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting')
  
  // Refs for managing reconnection
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)

  // Cleanup function - stable, no external dependencies
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  // Reconnection logic - stable, using refs and props only
  const attemptReconnect = useCallback(() => {
    if (!isMountedRef.current || reconnectAttemptsRef.current >= reconnectAttempts) {
      console.error('Max reconnection attempts reached')
      setConnectionStatus('disconnected')
      setError('Connection lost. Please refresh the page.')
      return
    }

    reconnectAttemptsRef.current++
    setConnectionStatus('reconnecting')
    console.log(`Attempting reconnection ${reconnectAttemptsRef.current}/${reconnectAttempts}`)

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        // Trigger a re-render by updating a state that will cause useEffect to run
        setConnectionStatus('connecting')
      }
    }, reconnectInterval)
  }, [reconnectAttempts, reconnectInterval])

  // Fetch initial volunteer locations - recreates when search params change
  const fetchVolunteers = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      // Fetch volunteer locations with user details
      const { data: locations, error: locError } = await supabase
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
            phone_number
          )
        `)
        .order('created_at', { ascending: false })

      if (locError) {
        console.error('Error fetching volunteers:', locError)
        setError(locError.message)
        setVolunteers([])
        return
      }

      // Get unique volunteers (latest location per user)
      const uniqueVolunteers = new Map<string, any>()
      locations?.forEach(loc => {
        if (!uniqueVolunteers.has(loc.user_id)) {
          uniqueVolunteers.set(loc.user_id, loc)
        }
      })

      // Filter by Talisay boundaries, radius, and calculate distance
      const filtered = Array.from(uniqueVolunteers.values())
        .filter(loc => isWithinTalisayCity(loc.lat, loc.lng)) // Only show volunteers in Talisay
        .map(loc => {
          const distance = calculateDistance(
            center[0], center[1],
            loc.lat, loc.lng
          )
          return {
            user_id: loc.user_id,
            latitude: loc.lat,
            longitude: loc.lng,
            accuracy: loc.accuracy,
            last_seen: loc.created_at,
            first_name: loc.users?.first_name,
            last_name: loc.users?.last_name,
            phone_number: loc.users?.phone_number,
            distance_km: distance
          }
        })
        .filter(v => v.distance_km <= radiusKm)
        .sort((a, b) => a.distance_km - b.distance_km)

      if (isMountedRef.current) {
        setVolunteers(filtered)
      }
    } catch (err: any) {
      console.error('Failed to fetch volunteers:', err)
      if (isMountedRef.current) {
        setError(err.message)
        setVolunteers([])
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [center, radiusKm, enabled])

  // Helper function to calculate distance between two points
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Setup realtime subscription with enhanced error handling
  // Removed circular dependencies to prevent infinite loops
  const setupRealtimeSubscription = useCallback(() => {
    if (!enabled || !isMountedRef.current) return

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setConnectionStatus('connecting')
    console.log('Setting up real-time subscription...')

    const channel = supabase
      .channel(`volunteer-locations-${Date.now()}`) // Unique channel name
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'volunteer_locations',
          // Only listen to recent updates (last 5 minutes)
          filter: `created_at=gte.${new Date(Date.now() - 300000).toISOString()}`
        },
        (payload) => {
          console.log('Location update received:', payload)
          
          // Refetch all volunteers when any location changes
          // This ensures we get accurate distance calculations
          fetchVolunteers()
        }
      )
      .on('system', { event: 'connected' }, () => {
        console.log('✅ Real-time connection established')
        if (isMountedRef.current) {
          setIsConnected(true)
          setConnectionStatus('connected')
          setError(null)
          reconnectAttemptsRef.current = 0 // Reset reconnection attempts
        }
      })
      .on('system', { event: 'disconnected' }, () => {
        console.warn('⚠️ Real-time connection lost')
        if (isMountedRef.current) {
          setIsConnected(false)
          setConnectionStatus('disconnected')
          attemptReconnect()
        }
      })
      .on('system', { event: 'error' }, (error) => {
        console.warn('⚠️ Real-time connection error:', error?.message || 'Unknown error')
        if (isMountedRef.current) {
          setError(`Connection error: ${error?.message || 'Unknown error'}`)
          attemptReconnect()
        }
      })
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED' && isMountedRef.current) {
          setIsConnected(true)
          setConnectionStatus('connected')
          setError(null)
        } else if (status === 'CHANNEL_ERROR' && isMountedRef.current) {
          console.warn('⚠️ Channel error, attempting reconnection...')
          attemptReconnect()
        }
      })

    channelRef.current = channel
  }, [enabled, center[0], center[1], radiusKm])

  // Main effect: Set up subscription when search params change
  // We include ONLY the essential dependencies to prevent infinite loops
  useEffect(() => {
    if (!enabled) {
      setVolunteers([])
      setIsConnected(false)
      setConnectionStatus('disconnected')
      cleanup()
      return
    }

    // Fetch initial data
    fetchVolunteers()

    // Set up real-time subscription
    setupRealtimeSubscription()

    // Cleanup on unmount or when dependencies change
    return () => {
      cleanup()
    }
  }, [enabled, center[0], center[1], radiusKm])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    volunteers,
    isConnected,
    isLoading,
    error,
    connectionStatus,
    refetch: fetchVolunteers,
    reconnect: () => {
      reconnectAttemptsRef.current = 0
      attemptReconnect()
    }
  }
}
