/**
 * Location Update Throttling
 * Prevents excessive location updates to reduce database writes
 */

interface ThrottleConfig {
  minIntervalMs: number // Minimum time between updates
  minDistanceMeters: number // Minimum distance change to trigger update
  maxAgeMs: number // Maximum age of location before forcing update
}

const DEFAULT_CONFIG: ThrottleConfig = {
  minIntervalMs: 5000, // 5 seconds
  minDistanceMeters: 10, // 10 meters
  maxAgeMs: 30000 // 30 seconds
}

interface LocationData {
  lat: number
  lng: number
  timestamp: number
}

class LocationThrottle {
  private lastUpdate: Map<string, LocationData> = new Map()
  private config: ThrottleConfig

  constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Calculate distance between two coordinates in meters (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth radius in meters
    const dLat = this.toRad(lat2 - lat1)
    const dLon = this.toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Check if location update should be sent
   * Returns true if update should be sent, false if throttled
   */
  shouldUpdate(userId: string, lat: number, lng: number): boolean {
    const now = Date.now()
    const last = this.lastUpdate.get(userId)

    // No previous update - allow
    if (!last) {
      this.lastUpdate.set(userId, { lat, lng, timestamp: now })
      return true
    }

    // Check time interval
    const timeSinceLastUpdate = now - last.timestamp
    if (timeSinceLastUpdate < this.config.minIntervalMs) {
      // Too soon - check if location changed significantly
      const distance = this.calculateDistance(last.lat, last.lng, lat, lng)
      if (distance < this.config.minDistanceMeters) {
        return false // Too close and too soon
      }
    }

    // Check if location is stale (force update)
    if (timeSinceLastUpdate > this.config.maxAgeMs) {
      this.lastUpdate.set(userId, { lat, lng, timestamp: now })
      return true
    }

    // Check distance change
    const distance = this.calculateDistance(last.lat, last.lng, lat, lng)
    if (distance >= this.config.minDistanceMeters) {
      this.lastUpdate.set(userId, { lat, lng, timestamp: now })
      return true
    }

    return false
  }

  /**
   * Clear throttle state for a user
   */
  clear(userId: string): void {
    this.lastUpdate.delete(userId)
  }

  /**
   * Clear all throttle state
   */
  clearAll(): void {
    this.lastUpdate.clear()
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ThrottleConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Singleton instance
export const locationThrottle = new LocationThrottle()

