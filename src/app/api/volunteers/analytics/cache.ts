/**
 * Simple in-memory cache for volunteer analytics
 * In production, consider using Redis or similar for distributed caching
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class AnalyticsCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes default

  /**
   * Generate cache key from parameters
   */
  private getKey(volunteerId: string, startDate?: string, endDate?: string): string {
    return `volunteer_analytics:${volunteerId}:${startDate || 'all'}:${endDate || 'all'}`
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(volunteerId: string, startDate?: string, endDate?: string): T | null {
    const key = this.getKey(volunteerId, startDate, endDate)
    const entry = this.cache.get(key)

    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache entry
   */
  set<T>(volunteerId: string, data: T, ttl?: number, startDate?: string, endDate?: string): void {
    const key = this.getKey(volunteerId, startDate, endDate)
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * Clear cache for a specific volunteer or all
   */
  clear(volunteerId?: string): void {
    if (volunteerId) {
      // Clear all entries for this volunteer
      const prefix = `volunteer_analytics:${volunteerId}:`
      const keys = Array.from(this.cache.keys())
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key)
        }
      }
    } else {
      // Clear all
      this.cache.clear()
    }
  }

  /**
   * Invalidate cache for a volunteer when their incident data changes
   * This should be called when:
   * - New incident is assigned to volunteer
   * - Incident status changes (especially RESOLVED)
   * - Incident severity changes
   * - New report is created for volunteer's incident
   */
  invalidateForVolunteer(volunteerId: string): void {
    this.clear(volunteerId)
  }

  /**
   * Invalidate all volunteer analytics cache
   * Use when you want to ensure fresh data across all volunteers
   */
  invalidateAll(): void {
    this.clear()
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const analyticsCache = new AnalyticsCache()

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    analyticsCache.cleanup()
  }, 10 * 60 * 1000)
}

