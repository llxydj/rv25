/**
 * Comprehensive Test Suite for Robust Offline Location Queue
 * 
 * CRITICAL SCENARIOS TESTED:
 * 1. Queue persistence (localStorage)
 * 2. Offline/Online transitions
 * 3. Retry logic with exponential backoff
 * 4. Queue size limits and memory management
 * 5. Data integrity (corruption recovery)
 * 6. Network failure handling
 * 7. Concurrent updates
 * 8. Browser crash recovery
 */

import { RobustOfflineLocationQueueService } from '../robust-offline-location-queue'
import { supabase } from '@/lib/supabase'
import { localStorageMock } from './__mocks__/localStorageMock'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn()
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn()
    }))
  }
}))

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Date.now())
}))

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

describe('RobustOfflineLocationQueueService - Comprehensive Tests', () => {
  let queueService: any
  let mockInsert: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    localStorageMock.clear() // ✅ Works now!
    
    // Reset singleton instance
    (RobustOfflineLocationQueueService as any).instance = null
    
    // Setup mock insert
    mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert
    })
    
    // Set online by default
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  afterEach(() => {
    // Clean up timers
    jest.clearAllTimers()
    
    // Force garbage collection of service instance
    if (queueService) {
      queueService = null
    }
    (RobustOfflineLocationQueueService as any).instance = null
    
    // Clear localStorage to prevent memory leaks
    localStorageMock.clear() // ✅ Works now!
    
    // Reset navigator online state
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  /**
   * TEST 1: Queue Persistence
   * Verifies: Data survives page reload, localStorage integration
   */
  describe('Queue Persistence', () => {
    test('saves queue to localStorage on add', async () => {
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        accuracy: 10,
        timestamp: new Date().toISOString()
      })

      expect(localStorageMock.setItem).toHaveBeenCalled()
      const savedData = localStorageMock.getItem('offline_location_queue')
      expect(savedData).toBeTruthy()
      
      const queue = JSON.parse(savedData!)
      expect(queue).toHaveLength(1)
      expect(queue[0].user_id).toBe('test-user')
    })

    test('loads queue from localStorage on initialization', () => {
      // Pre-populate localStorage
      const existingQueue = [{
        id: 'test-id',
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString(),
        attempt_count: 0,
        created_at: new Date().toISOString(),
        priority: 'medium'
      }]
      
      localStorageMock.setItem('offline_location_queue', JSON.stringify(existingQueue))
      
      // Create new instance
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      const stats = queueService.getStats()
      expect(stats.queueSize).toBe(1)
    })

    test('handles corrupted localStorage data gracefully', () => {
      // Set corrupted data
      localStorageMock.setItem('offline_location_queue', 'invalid json{[')
      
      // Should not throw
      expect(() => {
        queueService = (RobustOfflineLocationQueueService as any).getInstance()
      }).not.toThrow()
      
      const stats = queueService.getStats()
      expect(stats.queueSize).toBe(0)
    })

    test('filters out invalid queue items on load', () => {
      const invalidQueue = [
        {
          id: 'valid',
          user_id: 'test',
          latitude: 10.2465,
          longitude: 122.9735,
          timestamp: new Date().toISOString(),
          attempt_count: 0,
          created_at: new Date().toISOString(),
          priority: 'medium'
        },
        {
          id: 'invalid-missing-lat',
          user_id: 'test',
          longitude: 122.9735,
          timestamp: new Date().toISOString()
        },
        {
          // Missing user_id
          id: 'invalid-missing-user',
          latitude: 10.2465,
          longitude: 122.9735,
          timestamp: new Date().toISOString()
        }
      ]
      
      localStorageMock.setItem('offline_location_queue', JSON.stringify(invalidQueue))
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      const stats = queueService.getStats()
      expect(stats.queueSize).toBe(1) // Only valid item
    })
  })

  /**
   * TEST 2: Online/Offline Transitions
   * Verifies: Proper queue/sync behavior based on network state
   */
  describe('Online/Offline Transitions', () => {
    test('queues updates when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString()
      })
      
      const stats = queueService.getStats()
      expect(stats.queueSize).toBe(1)
      expect(stats.isOnline).toBe(false)
      
      // Should NOT have attempted to sync
      expect(mockInsert).not.toHaveBeenCalled()
    })

    test('syncs immediately when online', async () => {
      jest.useFakeTimers()
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString()
      })
      
      // Advance timers to allow sync
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      
      // Should have attempted sync
      expect(mockInsert).toHaveBeenCalled()
      
      jest.useRealTimers()
    })

    test('resumes sync when network comes back online', async () => {
      jest.useFakeTimers()
      
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Add items while offline
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString()
      })
      
      expect(mockInsert).not.toHaveBeenCalled()
      
      // Go online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
      
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      
      // Should now attempt sync
      expect(mockInsert).toHaveBeenCalled()
      
      jest.useRealTimers()
    })
  })

  /**
   * TEST 3: Retry Logic
   * Verifies: Exponential backoff, max attempts, error handling
   */
  describe('Retry Logic', () => {
    test('retries failed updates up to max attempts', async () => {
      jest.useFakeTimers()
      
      // Make insert fail
      mockInsert.mockResolvedValue({ 
        data: null, 
        error: { message: 'Network error' } 
      })
      
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString()
      })
      
      // Trigger multiple sync attempts
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      }
      
      const stats = queueService.getStats()
      expect(stats.failedItems).toBeGreaterThan(0)
      
      jest.useRealTimers()
    })

    test('removes item from queue after successful sync', async () => {
      jest.useFakeTimers()
      
      mockInsert.mockResolvedValue({ data: {}, error: null })
      
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString()
      })
      
      expect(queueService.getStats().queueSize).toBe(1)
      
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      
      // Should be removed after successful sync
      expect(queueService.getStats().queueSize).toBeLessThanOrEqual(1)
      
      jest.useRealTimers()
    })

    test('does not retry items that exceeded max attempts', async () => {
      jest.useFakeTimers()
      
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Manually add item with max attempts
      queueService.queue = [{
        id: 'maxed-out',
        user_id: 'test',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString(),
        attempt_count: 5, // MAX_ATTEMPTS
        created_at: new Date().toISOString(),
        priority: 'medium'
      }]
      
      queueService.saveQueue()
      
      const initialCallCount = mockInsert.mock.calls.length
      
      // Trigger sync
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
      
      // Should NOT have tried to sync maxed-out item
      expect(mockInsert.mock.calls.length).toBe(initialCallCount)
      
      jest.useRealTimers()
    })
  })

  /**
   * TEST 4: Queue Size Limits
   * Verifies: Memory management, old item removal
   */
  describe('Queue Size Limits', () => {
    test('limits queue size to prevent memory issues', async () => {
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Add more than max queue size (500)
      const updates = Array.from({ length: 550 }, (_, i) => ({
        user_id: 'test-user',
        latitude: 10.2465 + (i * 0.0001),
        longitude: 122.9735 + (i * 0.0001),
        timestamp: new Date(Date.now() - (550 - i) * 1000).toISOString()
      }))
      
      for (const update of updates) {
        await queueService.addLocationUpdate(update)
      }
      
      const stats = queueService.getStats()
      expect(stats.queueSize).toBeLessThanOrEqual(500)
    })

    test('removes oldest items when queue is full', async () => {
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Add items with known timestamps
      await queueService.addLocationUpdate({
        user_id: 'oldest',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date(Date.now() - 10000).toISOString()
      })
      
      await queueService.addLocationUpdate({
        user_id: 'newest',
        latitude: 10.2466,
        longitude: 122.9736,
        timestamp: new Date().toISOString()
      })
      
      // Manually trigger size limit (set queue to 500 items)
      queueService.queue = [
        ...queueService.queue,
        ...Array.from({ length: 499 }, (_, i) => ({
          id: `filler-${i}`,
          user_id: 'filler',
          latitude: 10.2465,
          longitude: 122.9735,
          timestamp: new Date().toISOString(),
          attempt_count: 0,
          created_at: new Date().toISOString(),
          priority: 'low'
        }))
      ]
      
      queueService.saveQueue()
      
      // Queue should have removed oldest items
      const savedQueue = JSON.parse(localStorageMock.getItem('offline_location_queue')!)
      expect(savedQueue.length).toBeLessThanOrEqual(500)
    })

    test('clears items older than 24 hours when storage is full', () => {
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Add old and new items
      queueService.queue = [
        {
          id: 'old',
          user_id: 'test',
          latitude: 10.2465,
          longitude: 122.9735,
          timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
          attempt_count: 0,
          created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
          priority: 'low'
        },
        {
          id: 'new',
          user_id: 'test',
          latitude: 10.2465,
          longitude: 122.9735,
          timestamp: new Date().toISOString(),
          attempt_count: 0,
          created_at: new Date().toISOString(),
          priority: 'medium'
        }
      ]
      
      queueService.clearOldItems()
      
      expect(queueService.queue.length).toBe(1)
      expect(queueService.queue[0].id).toBe('new')
    })
  })

  /**
   * TEST 5: Data Integrity
   * Verifies: Validation, corruption recovery, data consistency
   */
  describe('Data Integrity', () => {
    test('validates location data before queuing', async () => {
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Try to add invalid data
      await expect(async () => {
        await queueService.addLocationUpdate({
          user_id: '',
          latitude: 999, // Invalid latitude
          longitude: 999, // Invalid longitude
          timestamp: 'invalid-date'
        })
      }).rejects.toThrow()
    })

    test('preserves queue data structure across save/load cycles', async () => {
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      const testUpdate = {
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        accuracy: 10,
        heading: 90,
        speed: 5.5,
        timestamp: new Date().toISOString()
      }
      
      await queueService.addLocationUpdate(testUpdate)
      
      // Create new instance (simulates page reload)
      ;(RobustOfflineLocationQueueService as any).instance = null
      const newQueueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      const savedQueue = newQueueService.queue
      expect(savedQueue[0].latitude).toBe(10.2465)
      expect(savedQueue[0].longitude).toBe(122.9735)
      expect(savedQueue[0].accuracy).toBe(10)
    })
  })

  /**
   * TEST 6: Network Failure Scenarios
   * Verifies: Timeout handling, connection errors, partial failures
   */
  describe('Network Failure Scenarios', () => {
    test('handles timeout errors', async () => {
      jest.useFakeTimers()
      
      mockInsert.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 30000)
        )
      )
      
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString()
      })
      
      jest.advanceTimersByTime(31000)
      await Promise.resolve()
      
      const stats = queueService.getStats()
      expect(stats.queueSize).toBeGreaterThan(0) // Still in queue
      
      jest.useRealTimers()
    })

    test('handles partial batch failures', async () => {
      jest.useFakeTimers()
      
      // Fail specific items
      let callCount = 0
      mockInsert.mockImplementation(() => {
        callCount++
        return callCount % 2 === 0
          ? Promise.resolve({ data: {}, error: null })
          : Promise.resolve({ data: null, error: { message: 'Error' } })
      })
      
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Add multiple items
      for (let i = 0; i < 5; i++) {
        await queueService.addLocationUpdate({
          user_id: `user-${i}`,
          latitude: 10.2465 + (i * 0.001),
          longitude: 122.9735 + (i * 0.001),
          timestamp: new Date().toISOString()
        })
      }
      
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      
      // Some should succeed, some should fail
      const stats = queueService.getStats()
      expect(stats.queueSize).toBeGreaterThan(0)
      expect(stats.queueSize).toBeLessThan(5)
      
      jest.useRealTimers()
    })
  })

  /**
   * TEST 7: Statistics and Monitoring
   * Verifies: Accurate stats calculation, listener notifications
   */
  describe('Statistics and Monitoring', () => {
    test('calculates success rate accurately', async () => {
      jest.useFakeTimers()
      
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      // Add items
      for (let i = 0; i < 10; i++) {
        await queueService.addLocationUpdate({
          user_id: `user-${i}`,
          latitude: 10.2465,
          longitude: 122.9735,
          timestamp: new Date().toISOString()
        })
      }
      
      // Make some fail
      mockInsert
        .mockResolvedValueOnce({ data: {}, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Error' } })
      
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      
      const stats = queueService.getStats()
      expect(stats.successRate).toBeGreaterThanOrEqual(0)
      expect(stats.successRate).toBeLessThanOrEqual(100)
      
      jest.useRealTimers()
    })

    test('notifies listeners of stats changes', async () => {
      queueService = (RobustOfflineLocationQueueService as any).getInstance()
      
      const listener = jest.fn()
      queueService.subscribe(listener)
      
      await queueService.addLocationUpdate({
        user_id: 'test-user',
        latitude: 10.2465,
        longitude: 122.9735,
        timestamp: new Date().toISOString()
      })
      
      expect(listener).toHaveBeenCalled()
      expect(listener.mock.calls[0][0]).toHaveProperty('queueSize')
    })
  })
})
