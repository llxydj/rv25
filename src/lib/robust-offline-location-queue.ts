"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

interface QueuedLocationUpdate {
  id: string
  user_id: string
  latitude: number
  longitude: number
  accuracy?: number
  heading?: number
  speed?: number
  timestamp: string
  attempt_count: number
  created_at: string
  last_error?: string
  priority: 'high' | 'medium' | 'low'
}

interface OfflineQueueStats {
  queueSize: number
  failedItems: number
  successRate: number
  averageRetryTime: number
  lastSyncTime: string | null
  isOnline: boolean
  isSyncing: boolean
}

const QUEUE_KEY = 'offline_location_queue'
const MAX_ATTEMPTS = 5
const RETRY_INTERVAL_MS = 5000
const MAX_QUEUE_SIZE = 500 // Prevent memory issues
const BATCH_SIZE = 10 // Process in smaller batches

class RobustOfflineLocationQueueService {
  private static instance: RobustOfflineLocationQueueService
  private queue: QueuedLocationUpdate[] = []
  private isSyncing: boolean = false
  private retryTimeout: NodeJS.Timeout | null = null
  private stats: OfflineQueueStats = {
    queueSize: 0,
    failedItems: 0,
    successRate: 0,
    averageRetryTime: 0,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    isSyncing: false
  }
  private listeners: Set<(stats: OfflineQueueStats) => void> = new Set()

  private constructor() {
    this.loadQueue()
    this.setupNetworkListeners()
    this.startPeriodicSync()
    this.setupCrashRecovery()
  }

  static getInstance(): RobustOfflineLocationQueueService {
    if (!RobustOfflineLocationQueueService.instance) {
      RobustOfflineLocationQueueService.instance = new RobustOfflineLocationQueueService()
    }
    return RobustOfflineLocationQueueService.instance
  }

  private setupNetworkListeners() {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    
    // Listen for visibility changes (app focus/blur)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    
    // Listen for page unload to save queue
    window.addEventListener('beforeunload', this.handleBeforeUnload)
  }

  private handleOnline = () => {
    console.log('Network is online. Starting sync...')
    this.stats.isOnline = true
    this.notifyListeners()
    this.syncQueue()
  }

  private handleOffline = () => {
    console.log('Network is offline. Queuing location updates...')
    this.stats.isOnline = false
    this.notifyListeners()
    this.stopSync()
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      // App became visible and we're online, try to sync
      this.syncQueue()
    }
  }

  private handleBeforeUnload = () => {
    // Save queue before page unload
    this.saveQueue()
  }

  private setupCrashRecovery() {
    // Check for incomplete syncs on startup
    const incompleteSyncs = this.queue.filter(item => 
      item.attempt_count > 0 && item.attempt_count < MAX_ATTEMPTS
    )
    
    if (incompleteSyncs.length > 0) {
      console.log(`Found ${incompleteSyncs.length} incomplete syncs, will retry`)
    }
  }

  private loadQueue() {
    try {
      const storedQueue = localStorage.getItem(QUEUE_KEY)
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue)
        console.log(`Loaded ${this.queue.length} items from offline queue`)
        
        // Validate queue integrity
        this.queue = this.queue.filter(item => 
          item.id && item.user_id && item.latitude && item.longitude && item.timestamp
        )
        
        // Update stats
        this.updateStats()
        
        // Attempt to sync immediately if online
        if (navigator.onLine && this.queue.length > 0) {
          setTimeout(() => this.syncQueue(), 1000) // Delay to ensure app is ready
        }
      }
    } catch (error) {
      console.error('Error loading offline queue from localStorage:', error)
      this.queue = []
      this.saveQueue() // Save empty queue to fix corrupted data
    }
  }

  private saveQueue() {
    try {
      // Limit queue size to prevent memory issues
      if (this.queue.length > MAX_QUEUE_SIZE) {
        console.warn(`Queue size exceeded ${MAX_QUEUE_SIZE}, removing oldest items`)
        this.queue = this.queue
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-MAX_QUEUE_SIZE)
      }
      
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue))
      this.updateStats()
    } catch (error) {
      console.error('Error saving offline queue to localStorage:', error)
      
      // If localStorage is full, try to clear old items
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearOldItems()
        try {
          localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue))
        } catch (retryError) {
          console.error('Failed to save queue even after clearing old items:', retryError)
        }
      }
    }
  }

  private clearOldItems() {
    // Remove items older than 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
    this.queue = this.queue.filter(item => 
      new Date(item.created_at) > cutoffTime
    )
    console.log('Cleared old items from queue due to storage limit')
  }

  private updateStats() {
    const now = Date.now()
    const successfulItems = this.queue.filter(item => item.attempt_count === 0)
    const failedItems = this.queue.filter(item => item.attempt_count >= MAX_ATTEMPTS)
    
    this.stats = {
      queueSize: this.queue.length,
      failedItems: failedItems.length,
      successRate: this.queue.length > 0 ? (successfulItems.length / this.queue.length) * 100 : 100,
      averageRetryTime: this.calculateAverageRetryTime(),
      lastSyncTime: this.stats.lastSyncTime,
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing
    }
    
    this.notifyListeners()
  }

  private calculateAverageRetryTime(): number {
    const retryItems = this.queue.filter(item => item.attempt_count > 0)
    if (retryItems.length === 0) return 0
    
    const totalRetryTime = retryItems.reduce((sum, item) => {
      const createdTime = new Date(item.created_at).getTime()
      return sum + (Date.now() - createdTime)
    }, 0)
    
    return totalRetryTime / retryItems.length / 1000 // Convert to seconds
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.stats))
  }

  async enqueue(locationData: Omit<QueuedLocationUpdate, 'id' | 'attempt_count' | 'created_at' | 'priority'>) {
    const newItem: QueuedLocationUpdate = {
      id: uuidv4(),
      ...locationData,
      attempt_count: 0,
      created_at: new Date().toISOString(),
      priority: this.determinePriority(locationData)
    }
    
    // Check for duplicate entries (same location within 30 seconds)
    const duplicate = this.queue.find(item => 
      item.user_id === newItem.user_id &&
      Math.abs(new Date(item.timestamp).getTime() - new Date(newItem.timestamp).getTime()) < 30000 &&
      Math.abs(item.latitude - newItem.latitude) < 0.0001 &&
      Math.abs(item.longitude - newItem.longitude) < 0.0001
    )
    
    if (duplicate) {
      console.log('Duplicate location update detected, skipping')
      return
    }
    
    this.queue.push(newItem)
    this.saveQueue()
    console.log('Location update enqueued:', newItem.id)

    // Try to sync immediately if online
    if (navigator.onLine && !this.isSyncing) {
      setTimeout(() => this.syncQueue(), 100)
    }
  }

  private determinePriority(locationData: any): 'high' | 'medium' | 'low' {
    // High priority for recent updates
    const age = Date.now() - new Date(locationData.timestamp).getTime()
    if (age < 60000) return 'high' // Less than 1 minute
    if (age < 300000) return 'medium' // Less than 5 minutes
    return 'low'
  }

  private startPeriodicSync() {
    // Sync every 30 seconds when online
    setInterval(() => {
      if (navigator.onLine && this.queue.length > 0 && !this.isSyncing) {
        this.syncQueue()
      }
    }, 30000)
  }

  private stopSync() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
    this.isSyncing = false
    this.updateStats()
  }

  async syncQueue() {
    if (this.isSyncing || !navigator.onLine || this.queue.length === 0) {
      return
    }

    this.isSyncing = true
    this.updateStats()
    
    console.log(`Starting sync of ${this.queue.length} offline location updates`)

    // Sort by priority and age
    const sortedQueue = [...this.queue].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      // Then by age (older first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    const successfulSyncs: string[] = []
    const failedSyncs: QueuedLocationUpdate[] = []
    const batchErrors: string[] = []

    // Process in batches
    for (let i = 0; i < sortedQueue.length; i += BATCH_SIZE) {
      const batch = sortedQueue.slice(i, i + BATCH_SIZE)
      
      try {
        await this.processBatch(batch, successfulSyncs, failedSyncs)
        
        // Small delay between batches to prevent overwhelming the server
        if (i + BATCH_SIZE < sortedQueue.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error: any) {
        console.error(`Batch processing error:`, error)
        batchErrors.push(error.message)
        
        // Mark batch items as failed
        batch.forEach(item => {
          item.attempt_count++
          item.last_error = error.message
          failedSyncs.push(item)
        })
      }
    }

    // Update queue
    this.queue = this.queue.filter(item => !successfulSyncs.includes(item.id))
    
    // Update failed items
    failedSyncs.forEach(failedItem => {
      const existingItem = this.queue.find(item => item.id === failedItem.id)
      if (existingItem) {
        existingItem.attempt_count = failedItem.attempt_count
        existingItem.last_error = failedItem.last_error
      }
    })
    
    // Remove items that exceeded max attempts
    const removedItems = this.queue.filter(item => item.attempt_count >= MAX_ATTEMPTS)
    this.queue = this.queue.filter(item => item.attempt_count < MAX_ATTEMPTS)
    
    this.saveQueue()
    this.isSyncing = false
    this.stats.lastSyncTime = new Date().toISOString()
    this.updateStats()

    // Log results
    console.log(`Sync completed: ${successfulSyncs.length} successful, ${failedSyncs.length} failed, ${removedItems.length} removed`)
    
    if (batchErrors.length > 0) {
      console.error('Batch errors:', batchErrors)
    }

    // Schedule retry if there are failed items
    if (this.queue.length > 0) {
      console.warn(`Remaining items in queue: ${this.queue.length}. Retrying in ${RETRY_INTERVAL_MS / 1000} seconds`)
      this.retryTimeout = setTimeout(() => this.syncQueue(), RETRY_INTERVAL_MS)
    } else {
      console.log('Offline queue synced successfully')
    }
  }

  private async processBatch(
    batch: QueuedLocationUpdate[], 
    successfulSyncs: string[], 
    failedSyncs: QueuedLocationUpdate[]
  ) {
    const batchPromises = batch.map(async (item) => {
      try {
        const { error } = await supabase.from('location_tracking').insert({
          user_id: item.user_id,
          latitude: item.latitude,
          longitude: item.longitude,
          accuracy: item.accuracy,
          heading: item.heading,
          speed: item.speed,
          timestamp: item.timestamp,
        })

        if (error) {
          throw error
        }
        
        successfulSyncs.push(item.id)
        console.log(`Successfully synced item: ${item.id}`)
      } catch (error: any) {
        console.error(`Failed to sync item ${item.id}:`, error.message)
        item.attempt_count++
        item.last_error = error.message
        failedSyncs.push(item)
      }
    })

    await Promise.allSettled(batchPromises)
  }

  // Public methods
  getQueueSize(): number {
    return this.queue.length
  }

  getStats(): OfflineQueueStats {
    return { ...this.stats }
  }

  subscribe(listener: (stats: OfflineQueueStats) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  clearQueue() {
    this.queue = []
    this.saveQueue()
    this.updateStats()
    console.log('Offline location queue cleared')
  }

  forceSync() {
    if (navigator.onLine) {
      this.syncQueue()
    }
  }

  // Stress testing methods
  async stressTest(iterations: number = 100) {
    console.log(`Starting stress test with ${iterations} iterations`)
    
    const testResults = {
      totalItems: 0,
      successfulItems: 0,
      failedItems: 0,
      averageSyncTime: 0,
      memoryUsage: 0
    }
    
    const startTime = Date.now()
    
    for (let i = 0; i < iterations; i++) {
      const testItem = {
        user_id: 'test-user',
        latitude: 10.2447 + (Math.random() - 0.5) * 0.01,
        longitude: 123.8445 + (Math.random() - 0.5) * 0.01,
        accuracy: Math.random() * 10,
        timestamp: new Date().toISOString()
      }
      
      await this.enqueue(testItem)
      testResults.totalItems++
    }
    
    // Wait for sync to complete
    while (this.isSyncing) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    const endTime = Date.now()
    testResults.averageSyncTime = (endTime - startTime) / iterations
    testResults.successfulItems = this.queue.filter(item => item.attempt_count === 0).length
    testResults.failedItems = this.queue.filter(item => item.attempt_count >= MAX_ATTEMPTS).length
    
    console.log('Stress test results:', testResults)
    return testResults
  }
}

// Export singleton instance for production use
export const robustOfflineLocationQueueService = RobustOfflineLocationQueueService.getInstance()

// Export class for testing purposes
export { RobustOfflineLocationQueueService }

// React hook for using the service
export function useOfflineLocationQueue() {
  const [stats, setStats] = useState<OfflineQueueStats>(robustOfflineLocationQueueService.getStats())
  
  useEffect(() => {
    const unsubscribe = robustOfflineLocationQueueService.subscribe(setStats)
    return () => {
      unsubscribe()
    }
  }, [])
  
  return {
    stats,
    enqueue: robustOfflineLocationQueueService.enqueue.bind(robustOfflineLocationQueueService),
    clearQueue: robustOfflineLocationQueueService.clearQueue.bind(robustOfflineLocationQueueService),
    forceSync: robustOfflineLocationQueueService.forceSync.bind(robustOfflineLocationQueueService),
    stressTest: robustOfflineLocationQueueService.stressTest.bind(robustOfflineLocationQueueService)
  }
}
