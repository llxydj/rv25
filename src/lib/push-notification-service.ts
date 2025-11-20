"use client"

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
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications not supported')
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      throw new Error('Notification permission denied')
    }

    const permission = await Notification.requestPermission()
    return permission
  }

  /**
   * Initialize push notifications
   * Registers service worker and creates push subscription
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        console.warn('[push] Push notifications not supported')
        return false
      }

      // Request permission
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        console.warn('[push] Permission not granted:', permission)
        return false
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js')
      console.log('[push] Service worker registered')

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready

      // Check for existing subscription
      this.subscription = await this.registration.pushManager.getSubscription()

      if (!this.subscription) {
        // Create new subscription
        await this.subscribe()
      } else {
        console.log('[push] Existing subscription found')
        // Send subscription to server
        await this.sendSubscriptionToServer(this.subscription)
      }

      return true
    } catch (error: any) {
      console.error('[push] Initialization error:', error)
      return false
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
        applicationServerKey: convertedKey
      })

      console.log('[push] Subscribed to push notifications')

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription)

      return this.subscription
    } catch (error: any) {
      console.error('[push] Subscription error:', error)
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
      console.error('[push] Unsubscribe error:', error)
      return false
    }
  }

  /**
   * Send subscription to server for storage
   */
  async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      // Store the entire subscription object as JSONB (matches database schema)
      const subscriptionData = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscriptionData // Send as JSONB object
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save subscription')
      }

      console.log('[push] Subscription saved to server')
    } catch (error: any) {
      console.error('[push] Error saving subscription:', error)
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
      console.error('[push] Error removing subscription:', error)
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
      actions: payload.actions,
      vibrate: [200, 100, 200],
      requireInteraction: true
    })
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
