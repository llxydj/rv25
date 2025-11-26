// src/lib/push-notification-service.ts

"use client"

import { supabase } from './supabase'

/**
 * Push Notification Service
 * Handles web push notifications for instant volunteer alerts
 * Uses Web Push API with service worker
 */

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

class PushNotificationService {
  private static instance: PushNotificationService
  private registration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService()
    }
    return PushNotificationService.instance
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied'
    }
    return Notification.permission
  }

  /**
   * Request notification permission from user
   * @param skipRequest - If true, only check permission without requesting
   */
  async requestPermission(skipRequest: boolean = false): Promise<NotificationPermission | null> {
    if (!this.isSupported()) {
      console.warn('[push] Push notifications not supported')
      return null
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      console.warn('[push] Notifications blocked by user')
      return 'denied'
    }

    // If skipRequest is true, don't prompt the user
    if (skipRequest) {
      console.log('[push] Permission not yet granted, skipping auto-request')
      return 'default'
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.warn('[push] Notification permission not granted:', permission)
        return permission
      }
      return 'granted'
    } catch (error: any) {
      console.warn('[push] Error requesting permission:', error.message)
      return null
    }
  }

  /**
   * Initialize push notifications
   * Registers service worker and creates push subscription
   * @param requestPermission - If true, will request notification permission. Default: false (check only)
   */
  async initialize(requestPermission: boolean = false): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        console.log('[push] Push notifications not supported in this browser')
        return false
      }

      // Check permission (don't request unless explicitly told to)
      const permission = await this.requestPermission(!requestPermission)
      if (permission !== 'granted') {
        if (permission === 'denied') {
          console.log('[push] Notifications are blocked. User can enable them in browser settings.')
        } else {
          console.log('[push] Notification permission not granted. Will wait for user to enable.')
        }
        return false
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js')
      console.log('[push] Service worker registered')

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready
      console.log('[push] Service worker ready')

      // Check for existing subscription
      this.subscription = await this.registration.pushManager.getSubscription()

      if (!this.subscription) {
        // Create new subscription
        console.log('[push] No existing subscription found, creating new one...')
        const newSubscription = await this.subscribe()
        if (!newSubscription) {
          throw new Error('Failed to create push subscription')
        }
      } else {
        console.log('[push] Existing subscription found, syncing with server...')
        console.log('[push] Subscription endpoint:', this.subscription.endpoint.substring(0, 50) + '...')
        // Send subscription to server (will check auth inside)
        await this.sendSubscriptionToServer(this.subscription)
      }

      return true
    } catch (error: any) {
      console.error('[push] Could not initialize push notifications:', error.message)
      throw error // Re-throw so caller can handle authentication errors
    }
  }

  /**
   * Manually enable push notifications (prompts user for permission)
   * This should be called from a user interaction (button click) for better UX
   * Checks authentication before enabling
   */
  async enable(): Promise<boolean> {
    try {
      // Check authentication first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('[push] Session error:', sessionError.message)
        throw new Error('Failed to verify authentication. Please try logging in again.')
      }

      if (!session?.user?.id) {
        const errorMsg = 'You must be logged in to enable push notifications. Please log in first.'
        console.warn('[push]', errorMsg)
        throw new Error(errorMsg)
      }

      console.log('[push] User authenticated, proceeding with enable:', session.user.id)
      return this.initialize(true)
    } catch (error: any) {
      console.error('[push] Enable failed:', error.message)
      throw error
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        throw new Error('Service worker not registered')
      }

      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-key')
      if (!response.ok) {
        throw new Error('Failed to get VAPID key')
      }

      const { publicKey } = await response.json()
      const convertedKey = this.urlBase64ToUint8Array(publicKey)

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as BufferSource
      })

      console.log('[push] Subscribed to push notifications')

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription)

      return this.subscription
    } catch (error: any) {
      console.log('[push] Could not subscribe:', error.message)
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        return true
      }

      // Unsubscribe from push manager
      const success = await this.subscription.unsubscribe()

      if (success) {
        // Remove subscription from server
        await this.removeSubscriptionFromServer(this.subscription)
        this.subscription = null
        console.log('[push] Unsubscribed from push notifications')
      }

      return success
    } catch (error: any) {
      console.log('[push] Could not unsubscribe:', error.message)
      return false
    }
  }

  /**
   * Send subscription to server for storage
   * Checks authentication before sending
   */
  public async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      // Check if user is authenticated before sending subscription
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('[push] Session error:', sessionError.message)
        throw new Error('Failed to verify authentication session')
      }

      if (!session?.user?.id) {
        const errorMsg = 'User must be logged in to enable push notifications. Please log in first.'
        console.warn('[push]', errorMsg)
        throw new Error(errorMsg)
      }

      console.log('[push] User authenticated:', session.user.id)

      // Store the entire subscription object as JSONB (matches database schema)
      const subscriptionData = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      }

      console.log('[push] Sending subscription to server:', {
        endpoint: subscriptionData.endpoint.substring(0, 50) + '...',
        hasKeys: !!subscriptionData.keys.p256dh && !!subscriptionData.keys.auth,
        userId: session.user.id
      })

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscriptionData
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || `Server returned ${response.status}`
        const errorCode = errorData.code || 'UNKNOWN_ERROR'
        
        console.error('[push] Server error:', {
          status: response.status,
          code: errorCode,
          message: errorMessage,
          userId: session.user.id
        })
        
        // Provide more helpful error messages
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in and try again.')
        } else if (response.status === 400) {
          throw new Error('Invalid subscription data. Please try refreshing the page.')
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.')
        } else {
          throw new Error(errorMessage)
        }
      }

      const result = await response.json().catch(() => ({}))
      console.log('[push] Subscription saved to server successfully:', {
        userId: session.user.id,
        endpoint: subscriptionData.endpoint.substring(0, 50) + '...',
        success: result.success
      })
    } catch (error: any) {
      console.error('[push] Could not save subscription:', error.message)
      throw error
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      })

      if (!response.ok) {
        throw new Error('Failed to remove subscription')
      }

      console.log('[push] Subscription removed from server')
    } catch (error: any) {
      console.log('[push] Could not remove subscription:', error.message)
    }
  }

  /**
   * Show a local notification (for testing)
   */
  async showNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered')
    }

    await this.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      tag: payload.tag || 'default',
      data: payload.data,
      vibrate: [200, 100, 200],
      requireInteraction: true
    } as any)
  }

  /**
   * Get current subscription
   */
  getSubscription(): PushSubscription | null {
    return this.subscription
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

export const pushNotificationService = PushNotificationService.getInstance()
