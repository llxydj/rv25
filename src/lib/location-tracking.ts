import { supabase } from './supabase'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: Date
  heading?: number
  speed?: number
}

export interface LocationTrackingConfig {
  enableHighAccuracy: boolean
  timeout: number
  maximumAge: number
  distanceFilter: number // meters
}

export class LocationTrackingService {
  private static instance: LocationTrackingService
  private watchId: number | null = null
  private isTracking: boolean = false
  private lastLocation: LocationData | null = null
  private config: LocationTrackingConfig
  private listeners: ((location: LocationData) => void)[] = []
  private userId: string | null = null
  // Preferences caching & debouncing
  private prefCache: Map<string, { value: { enabled: boolean; accuracy: string }; ts: number }> = new Map()
  private prefTTLms = 60_000 // cache for 60s
  private prefInFlight: Map<string, Promise<{ enabled: boolean; accuracy: string }>> = new Map()
  // Timeout error tracking
  private timeoutErrorCount: number = 0
  private lastTimeoutErrorTime: number = 0
  private readonly MAX_TIMEOUT_ERRORS_PER_MINUTE = 3

  private constructor() {
    this.config = {
      enableHighAccuracy: true,
      timeout: 30000, // Increased to 30 seconds for better GPS acquisition
      maximumAge: 60000, // 60 seconds - allow older cached positions
      distanceFilter: 10 // 10 meters
    }
  }

  public static getInstance(): LocationTrackingService {
    if (!LocationTrackingService.instance) {
      LocationTrackingService.instance = new LocationTrackingService()
    }
    return LocationTrackingService.instance
  }

  /**
   * Initialize location tracking for a user
   */
  async initialize(userId: string, config?: Partial<LocationTrackingConfig>): Promise<boolean> {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser')
      return false
    }

    // Route guard: do not run on login route
    if (this.isLoginRoute()) {
      // Ensure tracking stopped on login
      this.stopTracking()
      return false
    }

    // Auth guard
    if (!userId) {
      this.stopTracking()
      return false
    }

    this.userId = userId
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Check if location tracking is enabled in user preferences (defaults to enabled if unavailable)
    const preferences = await this.getLocationPreferences(userId)
    if (!preferences.enabled) {
      console.log('Location tracking is disabled for user')
      return false
    }

    return true
  }

  /**
   * Start tracking user location
   */
  async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      console.warn('Location tracking is already active')
      return true
    }

    // Guard again before starting
    if (this.isLoginRoute()) {
      this.stopTracking()
      return false
    }

    if (!this.userId) {
      console.error('Location tracking not initialized')
      return false
    }

    try {
      // Reset timeout error tracking when starting fresh
      this.timeoutErrorCount = 0
      this.lastTimeoutErrorTime = 0
      
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Reset timeout error count on successful position update
          this.timeoutErrorCount = 0
          this.handleLocationUpdate(position)
        },
        (error) => this.handleLocationError(error),
        {
          enableHighAccuracy: this.config.enableHighAccuracy,
          timeout: this.config.timeout,
          maximumAge: this.config.maximumAge
        }
      )

      this.isTracking = true
      console.log('Location tracking started')
      return true
    } catch (error) {
      console.error('Failed to start location tracking:', error)
      return false
    }
  }

  /**
   * Stop tracking user location
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.isTracking = false
    console.log('Location tracking stopped')
  }

  /**
   * Handle location update from geolocation API
   */
  private async handleLocationUpdate(position: GeolocationPosition): Promise<void> {
    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date(position.timestamp),
      heading: position.coords.heading || undefined,
      speed: position.coords.speed || undefined
    }

    // Check if location has changed significantly
    if (this.shouldUpdateLocation(locationData)) {
      this.lastLocation = locationData
      
      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(locationData)
        } catch (error) {
          console.error('Error in location listener:', error)
        }
      })

      // Save to database
      await this.saveLocationToDatabase(locationData)
    }
  }

  /**
   * Check if location should be updated based on distance filter
   */
  private shouldUpdateLocation(newLocation: LocationData): boolean {
    if (!this.lastLocation) return true

    const distance = this.calculateDistance(
      this.lastLocation.latitude,
      this.lastLocation.longitude,
      newLocation.latitude,
      newLocation.longitude
    )

    return distance >= this.config.distanceFilter
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  /**
   * Save location to database
   * Only saves for volunteers - residents should not post to volunteer location API
   */
  private async saveLocationToDatabase(location: LocationData): Promise<void> {
    if (!this.userId) return

    try {
      // Check user role before posting to volunteer location API
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return

      // Get user role from database
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      // Only save location if user is a volunteer
      if (!userData || userData.role !== 'volunteer') {
        // Silently skip - residents don't need to post location to volunteer API
        return
      }

      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      
      // Add Authorization header if we have a session
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/volunteer/location', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed ?? null,
          heading: location.heading ?? null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({} as any))
        console.warn('Location POST failed:', res.status, json?.code || json?.message)
      } else {
        console.log('[location-tracking] Location saved successfully')
      }
    } catch (error) {
      console.warn('Error posting location:', error)
    }
  }

  /**
   * Handle location error
   */
  private handleLocationError(error: GeolocationPositionError): void {
    const now = Date.now()
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location access denied by user')
        // Stop tracking if permission is denied
        this.stopTracking()
        break
      case error.POSITION_UNAVAILABLE:
        console.warn('Location information unavailable - GPS signal may be weak')
        // This is recoverable, don't stop tracking
        break
      case error.TIMEOUT:
        // Timeout errors are common and recoverable - don't spam the console
        // Only log if we haven't logged too many timeouts recently
        if (now - this.lastTimeoutErrorTime > 60000) {
          // Reset counter if it's been more than a minute
          this.timeoutErrorCount = 0
        }
        
        this.timeoutErrorCount++
        this.lastTimeoutErrorTime = now
        
        // Only log as warning and only if not spamming
        if (this.timeoutErrorCount <= this.MAX_TIMEOUT_ERRORS_PER_MINUTE) {
          console.warn('Location request timed out - GPS signal may be weak. Retrying...')
        }
        // Timeout errors are expected in some scenarios (indoor, weak GPS signal)
        // The watchPosition will automatically retry, so we don't need to do anything
        break
      default:
        console.warn('Location tracking error:', error.message || 'Unknown error')
    }
  }

  /**
   * Add location update listener
   */
  addLocationListener(listener: (location: LocationData) => void): void {
    this.listeners.push(listener)
  }

  /**
   * Remove location update listener
   */
  removeLocationListener(listener: (location: LocationData) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  /**
   * Get current location
   */
  getCurrentLocation(): LocationData | null {
    return this.lastLocation
  }

  /**
   * Check if tracking is active
   */
  isActive(): boolean {
    return this.isTracking
  }

  /**
   * Get location history for a user
   */
  async getLocationHistory(userId: string, limit: number = 100): Promise<LocationData[]> {
    try {
      const { data, error } = await supabase
        .from('volunteer_locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to fetch location history:', error)
        return []
      }

      return data.map(item => ({
        latitude: item.lat,
        longitude: item.lng,
        accuracy: item.accuracy,
        timestamp: new Date(item.created_at),
        heading: item.heading,
        speed: item.speed
      }))
    } catch (error) {
      console.error('Error fetching location history:', error)
      return []
    }
  }

  /**
   * Get nearby volunteers
   */
  async getNearbyVolunteers(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 5
  ): Promise<any[]> {
    try {
      // Basic guards to prevent unnecessary RPC calls
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
        return []
      }
      // Get all active volunteers within radius
      const { data, error } = await supabase
        .rpc('get_volunteers_within_radius', {
          center_lat: centerLat,
          center_lng: centerLng,
          radius_km: radiusKm
        })

      if (error) {
        console.warn('Failed to fetch nearby volunteers (RPC): defaulting to empty set')
        return []
      }

      return Array.isArray(data) ? data : []
    } catch (error) {
      console.warn('Error fetching nearby volunteers: defaulting to empty set')
      return []
    }
  }

  /**
   * Get location preferences for a user
   */
  async getLocationPreferences(userId: string): Promise<{ enabled: boolean; accuracy: string }> {
    // Route/auth guard
    if (this.isLoginRoute() || !userId) {
      return { enabled: false, accuracy: 'medium' }
    }

    const now = Date.now()
    const cached = this.prefCache.get(userId)
    if (cached && now - cached.ts < this.prefTTLms) {
      return cached.value
    }

    // Debounce in-flight requests per user
    const existing = this.prefInFlight.get(userId)
    if (existing) {
      try {
        return await existing
      } catch {
        return { enabled: false, accuracy: 'medium' }
      }
    }

    const p = (async () => {
      try {
        const { data, error } = await supabase
          .from('location_preferences')
          .select('enabled, accuracy')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) {
          // Table may not exist or RLS may block; default to enabled to honor user toggle intent
          console.warn('Location preferences fetch failed; defaulting to enabled')
          return { enabled: true, accuracy: 'high' }
        }

        const value = (data as any) || { enabled: true, accuracy: 'high' }
        this.prefCache.set(userId, { value, ts: Date.now() })
        return value
      } catch {
        return { enabled: true, accuracy: 'high' }
      } finally {
        this.prefInFlight.delete(userId)
      }
    })()

    this.prefInFlight.set(userId, p)
    return await p
  }

  private isLoginRoute(): boolean {
    if (typeof window === 'undefined') return false
    const p = window.location?.pathname || ''
    return p === '/login' || p === '/resident/login' || p === '/admin/login'
  }

  /**
   * Update location preferences for a user
   */
  async updateLocationPreferences(
    userId: string,
    preferences: { enabled: boolean; accuracy: string }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('location_preferences')
        .upsert({
          user_id: userId,
          enabled: preferences.enabled,
          accuracy: preferences.accuracy,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Failed to update location preferences:', error)
        throw error
      }
    } catch (error) {
      console.error('Error updating location preferences:', error)
      throw error
    }
  }

  /**
   * Check if location tracking is supported
   */
  isSupported(): boolean {
    return 'geolocation' in navigator
  }

  /**
   * Request location permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false
    }

    try {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 5000 }
        )
      })
    } catch (error) {
      console.error('Error requesting location permission:', error)
      return false
    }
  }
}

// Export singleton instance
export const locationTrackingService = LocationTrackingService.getInstance()
