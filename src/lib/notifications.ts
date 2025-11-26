import { supabase } from './supabase'

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: any
  actions?: NotificationAction[]
}

export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

export interface NotificationPreferences {
  push: boolean
  sound: boolean
  vibration: boolean
  incident_alerts: boolean
  status_updates: boolean
  training_reminders: boolean
}

export class NotificationService {
  private static instance: NotificationService
  private registration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications')
        return false
      }

      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        console.warn('This browser does not support service workers')
        return false
      }

      // Get service worker registration
      this.registration = await navigator.serviceWorker.ready
      
      // Request notification permission
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        console.warn('Notification permission denied')
        return false
      }

      // Subscribe to push notifications
      await this.subscribeToPush()
      
      return true
    } catch (error) {
      console.error('Failed to initialize notification service:', error)
      return false
    }
  }

  /**
   * Request notification permission
   */
  private async requestPermission(): Promise<NotificationPermission> {
    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      return 'denied'
    }

    return await Notification.requestPermission()
  }

  /**
   * Subscribe to push notifications
   */
  private async subscribeToPush(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered')
    }

    try {
      // Subscribe to push manager
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        )
      })

      // Send subscription to server
      await this.saveSubscriptionToServer(this.subscription)
      
      console.log('Successfully subscribed to push notifications')
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      throw error
    }
  }

  /**
   * Save push subscription to server
   */
  private async saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user?.id) throw new Error('No user for subscription')
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, subscription: subscription.toJSON() })
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.message || `Subscribe failed: ${res.status}`)
      }
    } catch (error) {
      console.error('Error saving subscription to server:', error)
      throw error
    }
  }

  /**
   * Send a notification
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered')
    }

    try {
      await this.registration.showNotification(
        payload.title,
        ({
          body: payload.body,
          icon: payload.icon || '/icons/icon-192x192.png',
          badge: payload.badge || '/icons/icon-192x192.png',
          data: payload.data,
          requireInteraction: true,
          silent: false,
          // Some TS DOM lib variants may not include 'actions' in NotificationOptions; cast to any
          actions: payload.actions
        } as any)
      )
    } catch (error) {
      console.error('Failed to show notification:', error)
      throw error
    }
  }

  /**
   * Send notification to specific users
   */
  async sendToUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
    try {
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .in('user_id', userIds)

      if (error) {
        console.error('Failed to fetch subscriptions:', error)
        throw error
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.warn('No subscriptions found for users:', userIds)
        return
      }

      // Send to each subscription
      for (const sub of subscriptions) {
        try {
          await this.sendPushNotification(sub.subscription, payload)
        } catch (error) {
          console.error('Failed to send push notification:', error)
        }
      }
    } catch (error) {
      console.error('Error sending notifications to users:', error)
      throw error
    }
  }

  /**
   * Send push notification via server
   */
  private async sendPushNotification(subscription: any, payload: NotificationPayload): Promise<void> {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          payload
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to send push notification: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error sending push notification:', error)
      throw error
    }
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const res = await fetch(`/api/notifications/preferences?user_id=${encodeURIComponent(userId)}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.message || 'Failed to load preferences')
      const data = json.data
      return data || {
        push: true,
        sound: true,
        vibration: true,
        incident_alerts: true,
        status_updates: true,
        training_reminders: true
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
      throw error
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...preferences })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.message || 'Failed to save preferences')
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      throw error
    }
  }

  /**
   * Send incident alert notification
   */
  async sendIncidentAlert(incident: any, volunteers: any[]): Promise<void> {
    const payload: NotificationPayload = {
      title: '🚨 New Incident Reported',
      body: `${incident.incident_type} in ${incident.barangay}`,
      data: {
        type: 'incident_alert',
        incident_id: incident.id,
        url: `/admin/incidents/${incident.id}`
      },
      actions: [
        {
          action: 'view',
          title: 'View Details'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    }

    const volunteerIds = volunteers.map(v => v.id)
    await this.sendToUsers(volunteerIds, payload)
  }

  /**
   * Send status update notification
   */
  async sendStatusUpdate(incident: any, reporterId: string): Promise<void> {
    const statusMessages = {
      'ASSIGNED': 'Your incident has been assigned to a volunteer',
      'RESPONDING': 'A volunteer is responding to your incident',
      'RESOLVED': 'Your incident has been resolved',
      'CANCELLED': 'Your incident has been cancelled'
    }

    const payload: NotificationPayload = {
      title: '📋 Incident Status Update',
      body: statusMessages[incident.status as keyof typeof statusMessages] || 'Your incident status has been updated',
      data: {
        type: 'status_update',
        incident_id: incident.id,
        status: incident.status,
        url: `/resident/incident/${incident.id}`
      }
    }

    await this.sendToUsers([reporterId], payload)
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  /**
   * Check if notifications are supported and enabled
   */
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator
  }

  /**
   * Check if user has granted permission
   */
  hasPermission(): boolean {
    return Notification.permission === 'granted'
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance()
