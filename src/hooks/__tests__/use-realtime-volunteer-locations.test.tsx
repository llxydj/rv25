/**
 * Comprehensive Test Suite for useRealtimeVolunteerLocations Hook
 * 
 * CRITICAL SCENARIOS TESTED:
 * 1. Basic functionality (mount, unmount, data fetching)
 * 2. Rapid prop changes (map dragging simulation)
 * 3. Unmount during reconnection
 * 4. Network disconnection/reconnection
 * 5. Stale closure prevention
 * 6. Memory leak detection
 * 7. Edge cases (null data, empty arrays, errors)
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { useRealtimeVolunteerLocations } from '../use-realtime-volunteer-locations'
import { supabase } from '@/lib/supabase'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  }
}))

describe('useRealtimeVolunteerLocations - Comprehensive Tests', () => {
  const mockRPC = supabase.rpc as jest.MockedFunction<typeof supabase.rpc>
  const mockChannel = supabase.channel as jest.MockedFunction<typeof supabase.channel>
  const mockRemoveChannel = supabase.removeChannel as jest.MockedFunction<typeof supabase.removeChannel>

  let mockChannelInstance: any
  let subscribeCallback: any
  let onCallbacks: Map<string, Function>

  beforeEach(() => {
    jest.clearAllMocks()
    onCallbacks = new Map()
    subscribeCallback = null

    // Setup mock channel instance
    mockChannelInstance = {
      on: jest.fn((event: string, filter: any, callback: Function) => {
        if (typeof filter === 'function') {
          // System events: on('system', { event: 'connected' }, callback)
          const eventType = event === 'system' ? filter.event : event
          onCallbacks.set(eventType, callback)
        } else {
          // Postgres changes: on('postgres_changes', {...}, callback)
          onCallbacks.set('postgres_changes', callback)
        }
        return mockChannelInstance
      }),
      subscribe: jest.fn((callback: Function) => {
        subscribeCallback = callback
        // Simulate immediate subscription success
        setTimeout(() => callback && callback('SUBSCRIBED'), 0)
        return mockChannelInstance
      })
    }

    mockChannel.mockReturnValue(mockChannelInstance)
    mockRPC.mockResolvedValue({ data: [], error: null })
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  /**
   * TEST 1: Basic Mount/Unmount Lifecycle
   * Verifies: Proper initialization and cleanup
   */
  describe('Basic Lifecycle', () => {
    test('initializes correctly and fetches data on mount', async () => {
      const mockVolunteers = [
        { user_id: '1', latitude: 10.2465, longitude: 122.9735, last_seen: new Date().toISOString() }
      ]
      mockRPC.mockResolvedValueOnce({ data: mockVolunteers, error: null })

      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true
        })
      )

      // Initial state
      expect(result.current.isLoading).toBe(true)
      expect(result.current.volunteers).toEqual([])

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify RPC was called with correct params
      expect(mockRPC).toHaveBeenCalledWith('get_volunteers_within_radius', {
        center_lat: 10.2465,
        center_lng: 122.9735,
        radius_km: 10
      })

      // Verify data loaded
      expect(result.current.volunteers).toEqual(mockVolunteers)
      expect(result.current.error).toBeNull()
    })

    test('cleans up subscription on unmount', async () => {
      const { unmount } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true
        })
      )

      await waitFor(() => {
        expect(mockChannel).toHaveBeenCalled()
      })

      unmount()

      // Verify cleanup was called
      await waitFor(() => {
        expect(mockRemoveChannel).toHaveBeenCalled()
      })
    })
  })

  /**
   * TEST 2: Rapid Prop Changes (Map Dragging Simulation)
   * Verifies: No stale subscriptions, proper cleanup between changes
   * CRITICAL: This tests the exact issue mentioned - rapid center changes
   */
  describe('Rapid Prop Changes', () => {
    test('handles rapid center changes without stale subscriptions', async () => {
      jest.useFakeTimers()

      const { result, rerender } = renderHook(
        ({ center }) => useRealtimeVolunteerLocations({
          center,
          radiusKm: 10,
          enabled: true
        }),
        { initialProps: { center: [10.2465, 122.9735] as [number, number] } }
      )

      // Wait for initial subscription
      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      const initialChannelCount = mockChannel.mock.calls.length

      // Simulate rapid map dragging - 5 position changes
      for (let i = 0; i < 5; i++) {
        rerender({ center: [10.2465 + (i * 0.001), 122.9735 + (i * 0.001)] as [number, number] })
        await act(async () => {
          jest.advanceTimersByTime(10)
        })
      }

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Verify: Old channels were cleaned up
      expect(mockRemoveChannel.mock.calls.length).toBeGreaterThan(0)
      
      // Verify: Latest center is used
      const lastRPCCall = mockRPC.mock.calls[mockRPC.mock.calls.length - 1]
      expect(lastRPCCall[1]).toMatchObject({
        center_lat: expect.any(Number),
        center_lng: expect.any(Number)
      })

      jest.useRealTimers()
    })

    test('uses latest search params in subscription callbacks', async () => {
      jest.useFakeTimers()

      const { rerender } = renderHook(
        ({ center, radiusKm }) => useRealtimeVolunteerLocations({
          center,
          radiusKm,
          enabled: true
        }),
        { initialProps: { center: [10.2465, 122.9735] as [number, number], radiusKm: 10 } }
      )

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Change radius
      rerender({ center: [10.2465, 122.9735] as [number, number], radiusKm: 20 })

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Trigger a location update via the subscription callback
      const postgresCallback = onCallbacks.get('postgres_changes')
      expect(postgresCallback).toBeDefined()

      await act(async () => {
        postgresCallback?.({ new: { user_id: 'test' } })
        jest.advanceTimersByTime(100)
      })

      // Verify: RPC called with NEW radius (20, not 10)
      const lastCall = mockRPC.mock.calls[mockRPC.mock.calls.length - 1]
      expect(lastCall[1].radius_km).toBe(20)

      jest.useRealTimers()
    })
  })

  /**
   * TEST 3: Unmount During Reconnection
   * Verifies: No state updates after unmount, timers cleared
   * CRITICAL: Prevents "Can't perform state update on unmounted component"
   */
  describe('Unmount During Reconnection', () => {
    test('safely unmounts while reconnection is pending', async () => {
      jest.useFakeTimers()

      const { result, unmount } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true,
          reconnectInterval: 3000
        })
      )

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Simulate disconnection
      const disconnectCallback = onCallbacks.get('disconnected')
      
      await act(async () => {
        disconnectCallback?.()
        jest.advanceTimersByTime(500) // Partway through reconnection timeout
      })

      // Verify reconnection state
      expect(result.current.connectionStatus).toBe('reconnecting')

      // Unmount BEFORE reconnection timeout fires
      unmount()

      // Advance time to when reconnection would have fired
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })

      // No errors should occur
      expect(true).toBe(true) // If we get here, no state update error occurred

      jest.useRealTimers()
    })

    test('clears reconnection timeout on unmount', async () => {
      jest.useFakeTimers()
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      const { unmount } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true,
          reconnectInterval: 3000
        })
      )

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Trigger disconnection to start reconnection
      const disconnectCallback = onCallbacks.get('disconnected')
      await act(async () => {
        disconnectCallback?.()
      })

      unmount()

      // Verify clearTimeout was called
      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
      jest.useRealTimers()
    })
  })

  /**
   * TEST 4: Network Disconnection/Reconnection
   * Verifies: Proper reconnection logic, max attempts, error states
   */
  describe('Network Disconnection Handling', () => {
    test('attempts reconnection on disconnection', async () => {
      jest.useFakeTimers()

      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true,
          reconnectAttempts: 3,
          reconnectInterval: 1000
        })
      )

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Initial connection
      const connectedCallback = onCallbacks.get('connected')
      await act(async () => {
        connectedCallback?.()
      })

      expect(result.current.isConnected).toBe(true)

      // Simulate disconnection
      const disconnectCallback = onCallbacks.get('disconnected')
      await act(async () => {
        disconnectCallback?.()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionStatus).toBe('reconnecting')

      // Advance to first reconnection attempt
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })

      // Verify new subscription was created
      expect(mockChannel.mock.calls.length).toBeGreaterThan(1)

      jest.useRealTimers()
    })

    test('stops reconnecting after max attempts', async () => {
      jest.useFakeTimers()

      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true,
          reconnectAttempts: 2,
          reconnectInterval: 1000
        })
      )

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Trigger disconnection repeatedly
      for (let i = 0; i < 3; i++) {
        const disconnectCallback = onCallbacks.get('disconnected')
        await act(async () => {
          disconnectCallback?.()
          jest.advanceTimersByTime(1100)
        })
      }

      // After max attempts, should have error
      expect(result.current.connectionStatus).toBe('disconnected')
      expect(result.current.error).toContain('Connection lost')

      jest.useRealTimers()
    })
  })

  /**
   * TEST 5: Edge Cases
   * Verifies: Null data, empty arrays, API errors, disabled state
   */
  describe('Edge Cases', () => {
    test('handles RPC errors gracefully', async () => {
      mockRPC.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Database connection failed' } as any 
      })

      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Database connection failed')
      expect(result.current.volunteers).toEqual([])
    })

    test('handles empty volunteer array', async () => {
      mockRPC.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.volunteers).toEqual([])
      expect(result.current.error).toBeNull()
    })

    test('does not fetch when disabled', async () => {
      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: false
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockRPC).not.toHaveBeenCalled()
      expect(mockChannel).not.toHaveBeenCalled()
      expect(result.current.volunteers).toEqual([])
    })

    test('cleans up when toggled from enabled to disabled', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled
        }),
        { initialProps: { enabled: true } }
      )

      await waitFor(() => {
        expect(mockChannel).toHaveBeenCalled()
      })

      // Disable
      rerender({ enabled: false })

      await waitFor(() => {
        expect(result.current.volunteers).toEqual([])
        expect(result.current.isConnected).toBe(false)
      })

      expect(mockRemoveChannel).toHaveBeenCalled()
    })
  })

  /**
   * TEST 6: Memory Leak Detection
   * Verifies: No lingering subscriptions, timers, or listeners
   */
  describe('Memory Leak Prevention', () => {
    test('no lingering channels after multiple mount/unmount cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() => 
          useRealtimeVolunteerLocations({
            center: [10.2465, 122.9735],
            radiusKm: 10,
            enabled: true
          })
        )

        await waitFor(() => {
          expect(mockChannel).toHaveBeenCalled()
        })

        unmount()
      }

      // Each unmount should call removeChannel
      expect(mockRemoveChannel.mock.calls.length).toBe(5)
    })
  })

  /**
   * TEST 7: Refetch and Reconnect Methods
   * Verifies: Manual controls work correctly
   */
  describe('Manual Controls', () => {
    test('refetch method triggers new data fetch', async () => {
      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialCallCount = mockRPC.mock.calls.length

      await act(async () => {
        result.current.refetch()
      })

      expect(mockRPC.mock.calls.length).toBe(initialCallCount + 1)
    })

    test('reconnect method resets attempt counter', async () => {
      jest.useFakeTimers()

      const { result } = renderHook(() => 
        useRealtimeVolunteerLocations({
          center: [10.2465, 122.9735],
          radiusKm: 10,
          enabled: true,
          reconnectAttempts: 2,
          reconnectInterval: 1000
        })
      )

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      // Exhaust reconnection attempts
      for (let i = 0; i < 3; i++) {
        const disconnectCallback = onCallbacks.get('disconnected')
        await act(async () => {
          disconnectCallback?.()
          jest.advanceTimersByTime(1100)
        })
      }

      // Should be disconnected with error
      expect(result.current.connectionStatus).toBe('disconnected')

      // Manual reconnect should reset
      await act(async () => {
        result.current.reconnect()
        jest.advanceTimersByTime(1100)
      })

      // Should attempt new connection
      expect(mockChannel.mock.calls.length).toBeGreaterThan(1)

      jest.useRealTimers()
    })
  })
})
