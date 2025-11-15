"use client"

import { supabase } from './supabase'

/**
 * Background Location Tracking Service
 * Provides periodic location updates for volunteers even when app is in background
 * Uses Geolocation API with watchPosition for continuous tracking
 */

interface LocationUpdate {
  lat: number
  lng: number
  accuracy: number
  speed: number | null
  heading: number | null
  timestamp: number
}

interface BackgroundLocationOptions {
  updateInterval?: number // milliseconds between updates (default: 30000 = 30 seconds)
  highAccuracy?: boolean // use high accuracy GPS (default: true)
  maxAge?: number // max age of cached position (default: 5000ms)
  timeout?: number // timeout for position acquisition (default: 10000ms)
  onUpdate?: (location: LocationUpdate) => void
  onError?: (error: string) => void
}

class BackgroundLocationService {
  private static instance: BackgroundLocationService
  private watchId: number | null = null
  private isTracking: boolean = false
  private updateInterval: number = 30000 // 30 seconds
  private lastUpdate: number = 0
  private options: BackgroundLocationOptions = {}
  private pendingUpdates: LocationUpdate[] = []
  private uploadTimer: NodeJS.Timeout | null = null

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): BackgroundLocationService {
    if (!BackgroundLocationService.instance) {
      BackgroundLocationService.instance = new BackgroundLocationService()
    }
    return BackgroundLocationService.instance
  }

  /**
   * Start background location tracking
   */
  async startTracking(options: BackgroundLocationOptions = {}): Promise<void> {
    if (this.isTracking) {
      console.log('[bg-location] Already tracking')
      return
    }

    if (!navigator.geolocation) {
      const error = 'Geolocation not supported'
      options.onError?.(error)
      throw new Error(error)
    }

    this.options = {
      updateInterval: 30000, // 30 seconds
      highAccuracy: true,
      maxAge: 5000,
      timeout: 10000,
      ...options
    }

    this.updateInterval = this.options.updateInterval!
    this.isTracking = true

    // Use watchPosition for continuous tracking
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: this.options.highAccuracy,
        maximumAge: this.options.maxAge,
        timeout: this.options.timeout
      }
    )

    // Start batch upload timer
    this.startBatchUpload()

    console.log('[bg-location] Tracking started')
  }

  /**
   * Stop background location tracking
   */
  stopTracking(): void {
    if (!this.isTracking) {
      return
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }

    if (this.uploadTimer) {
      clearInterval(this.uploadTimer)
      this.uploadTimer = null
    }

    // Upload any pending updates before stopping
    if (this.pendingUpdates.length > 0) {
      this.uploadPendingUpdates()
    }

    this.isTracking = false
    console.log('[bg-location] Tracking stopped')
  }

  /**
   * Check if currently tracking
   */
  isActive(): boolean {
    return this.isTracking
  }

  /**
   * Handle position update from Geolocation API
   */
  private handlePositionUpdate(position: GeolocationPosition): void {
    const now = Date.now()
    
    // Throttle updates based on interval
    if (now - this.lastUpdate < this.updateInterval) {
      return
    }

    this.lastUpdate = now

    const locationUpdate: LocationUpdate = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
      timestamp: position.timestamp
    }

    // Call callback if provided
    this.options.onUpdate?.(locationUpdate)

    // Add to pending updates queue
    this.pendingUpdates.push(locationUpdate)

    console.log('[bg-location] Position updated:', {
      lat: locationUpdate.lat.toFixed(6),
      lng: locationUpdate.lng.toFixed(6),
      accuracy: locationUpdate.accuracy.toFixed(0)
    })
  }

  /**
   * Handle position error
   */
  private handlePositionError(error: GeolocationPositionError): void {
    let errorMessage = 'Location error'

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied'
        this.stopTracking() // Stop if permission denied
        break
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable'
        break
      case error.TIMEOUT:
        errorMessage = 'Location request timeout'
        break
    }

    console.error('[bg-location]', errorMessage, error.message)
    this.options.onError?.(errorMessage)
  }

  /**
   * Start batch upload timer
   */
  private startBatchUpload(): void {
    // Upload pending locations every 60 seconds
    this.uploadTimer = setInterval(() => {
      if (this.pendingUpdates.length > 0) {
        this.uploadPendingUpdates()
      }
    }, 60000) // 1 minute
  }

  /**
   * Upload pending location updates to server
   */
  private async uploadPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.length === 0) {
      return
    }

    const updates = [...this.pendingUpdates]
    this.pendingUpdates = []

    try {
      // Upload most recent location (last in array)
      const latest = updates[updates.length - 1]

      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      
      // Add Authorization header if we have a session
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/volunteer/location', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          lat: latest.lat,
          lng: latest.lng,
          accuracy: latest.accuracy,
          speed: latest.speed,
          heading: latest.heading
        })
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        // Handle specific error codes
        if (result.code === 'OUT_OF_BOUNDS') {
          console.warn('[bg-location] Location out of bounds')
          this.stopTracking()
          this.options.onError?.('You are outside the service area')
        } else if (result.code === 'ACCURACY_TOO_LOW') {
          console.warn('[bg-location] GPS accuracy too low')
        } else {
          throw new Error(result.message || 'Upload failed')
        }
      } else {
        console.log('[bg-location] Location uploaded successfully')
      }
    } catch (error: any) {
      console.error('[bg-location] Upload error:', error.message)
      
      // Re-add failed updates to queue for retry
      this.pendingUpdates = [...updates, ...this.pendingUpdates]
      
      // Limit queue size to prevent memory issues
      if (this.pendingUpdates.length > 50) {
        this.pendingUpdates = this.pendingUpdates.slice(-50)
      }
    }
  }

  /**
   * Get current tracking status and stats
   */
  getStatus(): {
    isTracking: boolean
    pendingUpdates: number
    lastUpdate: number
  } {
    return {
      isTracking: this.isTracking,
      pendingUpdates: this.pendingUpdates.length,
      lastUpdate: this.lastUpdate
    }
  }
}

export const backgroundLocationService = BackgroundLocationService.getInstance()
