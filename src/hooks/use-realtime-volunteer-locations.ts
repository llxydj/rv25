// src/hooks/use-realtime-volunteer-locations.ts
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
  const [volunteers, setVolunteers] = useState<VolunteerLocation[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting')

  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)

  // --- Helper: distance calculation ---
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

  // --- Cleanup ---
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

  // --- Fetch volunteer locations ---
  const fetchVolunteers = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return

    try {
      setIsLoading(true)
      setError(null)

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

      if (locError) throw locError

      const uniqueVolunteers = new Map<string, any>()
      locations?.forEach(loc => {
        if (!uniqueVolunteers.has(loc.user_id)) {
          uniqueVolunteers.set(loc.user_id, loc)
        }
      })

      const filtered = Array.from(uniqueVolunteers.values())
        .filter(loc => loc.lat && loc.lng && isWithinTalisayCity(loc.lat, loc.lng))
        .map(loc => {
          const distance = calculateDistance(center[0], center[1], loc.lat, loc.lng)
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
        .filter(v => v.distance_km <= radiusKm)
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
  }, [center, radiusKm, enabled, calculateDistance])

  // --- Reconnection ---
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
      if (isMountedRef.current) setupRealtimeSubscription()
    }, reconnectInterval)
  }, [reconnectAttempts, reconnectInterval])

  // --- Setup real-time subscription ---
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
          fetchVolunteers() // Safe: fetchVolunteers is stable via useCallback
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
            attemptReconnect()
            break
          case 'TIMED_OUT':
            console.warn('Subscription timed out')
            attemptReconnect()
            break
          case 'CLOSED':
            setIsConnected(false)
            setConnectionStatus('disconnected')
            break
        }
      })

    channelRef.current = channel
  }, [enabled, cleanup, fetchVolunteers, attemptReconnect])

  // --- Main effect ---
  useEffect(() => {
    isMountedRef.current = true

    if (!enabled) {
      setVolunteers([])
      setIsConnected(false)
      setConnectionStatus('disconnected')
      cleanup()
      return
    }

    fetchVolunteers()
    setupRealtimeSubscription()

    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [enabled, fetchVolunteers, setupRealtimeSubscription, cleanup])

  // --- Refetch when center or radius changes ---
  useEffect(() => {
    if (enabled) fetchVolunteers()
  }, [center[0], center[1], radiusKm, enabled, fetchVolunteers])

  return {
    volunteers,
    isConnected,
    isLoading,
    error,
    connectionStatus,
    refetch: fetchVolunteers,
    reconnect: () => {
      reconnectAttemptsRef.current = 0
      setupRealtimeSubscription()
    }
  }
}
