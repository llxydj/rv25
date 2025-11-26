"use client"

import { useState, useEffect, useRef, useCallback } from 'react'

interface LocationUpdate {
  id: string
  latitude: number
  longitude: number
  accuracy?: number
  heading?: number
  speed?: number
  timestamp: number
  retryCount: number
}

interface OfflineQueueOptions {
  maxRetries?: number
  retryDelay?: number
  maxQueueSize?: number
  syncInterval?: number
}

export class OfflineLocationQueue {
  private queue: LocationUpdate[] = []
  private isOnline: boolean = true
  private syncInterval: NodeJS.Timeout | null = null
  private options: Required<OfflineQueueOptions>

  constructor(options: OfflineQueueOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      maxQueueSize: options.maxQueueSize || 100,
      syncInterval: options.syncInterval || 30000
    }

    this.setupOnlineStatusListener()
    this.startSyncInterval()
  }

  private setupOnlineStatusListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network connection restored')
        this.isOnline = true
        this.syncQueue()
      })

      window.addEventListener('offline', () => {
        console.log('📵 Network connection lost')
        this.isOnline = false
      })
    }
  }

  private startSyncInterval() {
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.queue.length > 0) {
        this.syncQueue()
      }
    }, this.options.syncInterval)
  }

  private stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  addLocationUpdate(location: Omit<LocationUpdate, 'id' | 'timestamp' | 'retryCount'>) {
    const update: LocationUpdate = {
      ...location,
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    }

    // Remove oldest entries if queue is full
    if (this.queue.length >= this.options.maxQueueSize) {
      this.queue = this.queue.slice(-this.options.maxQueueSize + 1)
    }

    this.queue.push(update)
    console.log(`📍 Location queued (${this.queue.length} in queue)`, update)

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncQueue()
    }

    return update.id
  }

  private async syncQueue() {
    if (!this.isOnline || this.queue.length === 0) return

    console.log(`🔄 Syncing ${this.queue.length} queued locations...`)

    const updatesToSync = [...this.queue]
    const successfulSyncs: string[] = []

    for (const update of updatesToSync) {
      try {
        const success = await this.sendLocationUpdate(update)
        if (success) {
          successfulSyncs.push(update.id)
        } else {
          update.retryCount++
          if (update.retryCount >= this.options.maxRetries) {
            console.warn(`❌ Max retries reached for location ${update.id}`)
            successfulSyncs.push(update.id) // Remove from queue even if failed
          }
        }
      } catch (error) {
        console.error('Error syncing location update:', error)
        update.retryCount++
      }

      // Add delay between requests to avoid overwhelming the server
      if (updatesToSync.indexOf(update) < updatesToSync.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Remove successfully synced updates from queue
    this.queue = this.queue.filter(update => !successfulSyncs.includes(update.id))
    
    if (successfulSyncs.length > 0) {
      console.log(`✅ Successfully synced ${successfulSyncs.length} location updates`)
    }
  }

  private async sendLocationUpdate(update: LocationUpdate): Promise<boolean> {
    try {
      const response = await fetch('/api/location-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: update.latitude,
          longitude: update.longitude,
          accuracy: update.accuracy,
          heading: update.heading,
          speed: update.speed,
          timestamp: new Date(update.timestamp).toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      return result.success === true
    } catch (error) {
      console.error('Failed to send location update:', error)
      return false
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isOnline: this.isOnline,
      oldestUpdate: this.queue.length > 0 ? this.queue[0].timestamp : null,
      newestUpdate: this.queue.length > 0 ? this.queue[this.queue.length - 1].timestamp : null
    }
  }

  clearQueue() {
    this.queue = []
    console.log('🗑️ Location queue cleared')
  }

  destroy() {
    this.stopSyncInterval()
    this.clearQueue()
  }
}

// React hook for using the offline queue
export function useOfflineLocationQueue(options: OfflineQueueOptions = {}) {
  const queueRef = useRef<OfflineLocationQueue | null>(null)
  const [queueStatus, setQueueStatus] = useState({
    queueLength: 0,
    isOnline: true,
    oldestUpdate: null as number | null,
    newestUpdate: null as number | null
  })

  // Initialize queue
  useEffect(() => {
    queueRef.current = new OfflineLocationQueue(options)
    
    // Update status periodically
    const statusInterval = setInterval(() => {
      if (queueRef.current) {
        setQueueStatus(queueRef.current.getQueueStatus())
      }
    }, 1000)

    return () => {
      clearInterval(statusInterval)
      if (queueRef.current) {
        queueRef.current.destroy()
      }
    }
  }, [])

  const addLocationUpdate = useCallback((location: Omit<LocationUpdate, 'id' | 'timestamp' | 'retryCount'>) => {
    if (queueRef.current) {
      return queueRef.current.addLocationUpdate(location)
    }
    return null
  }, [])

  const syncQueue = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.syncQueue()
    }
  }, [])

  const clearQueue = useCallback(() => {
    if (queueRef.current) {
      queueRef.current.clearQueue()
    }
  }, [])

  return {
    addLocationUpdate,
    syncQueue,
    clearQueue,
    queueStatus
  }
}

// Enhanced location tracking service with offline support
export class EnhancedLocationTrackingService {
  private offlineQueue: OfflineLocationQueue
  private watchId: number | null = null
  private isTracking: boolean = false
  private lastKnownPosition: GeolocationPosition | null = null

  constructor() {
    this.offlineQueue = new OfflineLocationQueue({
      maxRetries: 3,
      retryDelay: 5000,
      maxQueueSize: 100,
      syncInterval: 30000
    })
  }

  async startTracking(options: {
    enableHighAccuracy?: boolean
    timeout?: number
    maximumAge?: number
    updateInterval?: number
  } = {}) {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported')
    }

    if (this.isTracking) {
      console.warn('Location tracking is already active')
      return
    }

    const {
      enableHighAccuracy = true,
      timeout = 10000,
      maximumAge = 30000,
      updateInterval = 10000
    } = options

    this.isTracking = true

    // Get initial position
    try {
      const position = await this.getCurrentPosition({
        enableHighAccuracy,
        timeout,
        maximumAge
      })
      this.lastKnownPosition = position
      await this.sendLocationUpdate(position)
    } catch (error) {
      console.warn('Failed to get initial position:', error)
    }

    // Start watching position
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.lastKnownPosition = position
        this.sendLocationUpdate(position)
      },
      (error) => {
        console.error('Geolocation error:', error)
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
        ...(updateInterval && { updateInterval })
      }
    )

    console.log('📍 Location tracking started')
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.isTracking = false
    console.log('📍 Location tracking stopped')
  }

  private async sendLocationUpdate(position: GeolocationPosition) {
    const locationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed
    }

    // Add to offline queue (it will handle online/offline logic)
    this.offlineQueue.addLocationUpdate(locationData)
  }

  private getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options)
    })
  }

  getQueueStatus() {
    return this.offlineQueue.getQueueStatus()
  }

  async syncQueue() {
    return this.offlineQueue.syncQueue()
  }

  destroy() {
    this.stopTracking()
    this.offlineQueue.destroy()
  }
}

// Singleton instance
export const enhancedLocationTrackingService = new EnhancedLocationTrackingService()
