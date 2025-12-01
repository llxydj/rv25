/**
 * Enhanced Cache Manager
 * Provides in-memory caching with TTL for API responses
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  key: string
}

interface CacheOptions {
  ttl: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL: number = 5 * 60 * 1000 // 5 minutes
  private maxSize: number = 1000

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, options: Partial<CacheOptions> = {}): void {
    const ttl = options.ttl || this.defaultTTL
    const expiresAt = Date.now() + ttl

    // Evict oldest entries if at max size
    if (this.cache.size >= (options.maxSize || this.maxSize)) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      expiresAt,
      key
    })
  }

  /**
   * Delete cached entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Invalidate cache by pattern (prefix matching)
   */
  invalidatePattern(pattern: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Evict oldest entries (FIFO)
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    
    // Remove 10% of oldest entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1))
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate?: number
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager()

// Auto-clean expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cacheManager.cleanExpired()
  }, 5 * 60 * 1000)
}

