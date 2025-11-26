/**
 * Geolocation System Configuration
 * Centralized config for thresholds, filters, and edge case handling
 */

export const GEOLOCATION_CONFIG = {
  /**
   * Accuracy threshold in meters
   * Locations with accuracy > this value will be rejected
   */
  MAX_ACCURACY_METERS: 2000, // Increased from 150 for testing - should be 150 in production

  /**
   * Minimum movement distance in meters
   * Locations closer than this to the last location will be ignored
   * Helps reduce noise from GPS jitter
   */
  MIN_MOVEMENT_METERS: 10,

  /**
   * Boundary tolerance buffer in degrees
   * Adds a small buffer to boundary checks to handle borderline cases
   * ~0.0005° ≈ 55 meters
   */
  BOUNDARY_TOLERANCE_DEGREES: 0.0005,

  /**
   * Maximum age of location data in minutes
   * Locations older than this are considered stale
   */
  MAX_LOCATION_AGE_MINUTES: 30,

  /**
   * Data retention period in days
   * Location records older than this should be cleaned up
   */
  DATA_RETENTION_DAYS: 30,

  /**
   * Rate limiting - max location updates per minute
   */
  MAX_UPDATES_PER_MINUTE: 10,

  /**
   * Route tracking - default lookback period in minutes
   */
  DEFAULT_ROUTE_HISTORY_MINUTES: 180,

  /**
   * Route tracking - maximum lookback period in minutes
   */
  MAX_ROUTE_HISTORY_MINUTES: 1440, // 24 hours

  /**
   * Map clustering - minimum volunteers before clustering
   */
  CLUSTER_THRESHOLD: 50,

  /**
   * Real-time update throttle in milliseconds
   */
  REALTIME_THROTTLE_MS: 1000,

  /**
   * Talisay City approximate bounds (for quick validation)
   * Use database function for precise validation
   */
  TALISAY_CITY_BOUNDS: {
    minLat: 10.6,
    maxLat: 10.8,
    minLng: 122.8,
    maxLng: 123.0
  }
} as const

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  
  return distance
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Check if location accuracy is acceptable
 */
export function isAccuracyAcceptable(accuracy: number | null | undefined): boolean {
  if (accuracy === null || accuracy === undefined) {
    return true // Allow if accuracy not provided
  }
  return accuracy <= GEOLOCATION_CONFIG.MAX_ACCURACY_METERS
}

/**
 * Check if movement is significant enough to record
 */
export function isSignificantMovement(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): boolean {
  const distance = calculateDistance(lat1, lng1, lat2, lng2)
  return distance >= GEOLOCATION_CONFIG.MIN_MOVEMENT_METERS
}

/**
 * Quick bounds check (before database validation)
 */
export function isWithinApproximateBounds(lat: number, lng: number): boolean {
  const bounds = GEOLOCATION_CONFIG.TALISAY_CITY_BOUNDS
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  )
}
