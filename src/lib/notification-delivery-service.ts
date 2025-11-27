"use client"

import { createClient } from '@supabase/supabase-js'

export interface NotificationDelivery {
  id: string
  user_id: string
  notification_id: string
  delivery_status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'EXPIRED'
  delivery_attempts: number
  last_attempt_at?: string
  error_message?: string
  delivered_at?: string
  read_at?: string
}

export interface NotificationReadStatus {
  notificationId: string
  userId: string
  readAt: string
  readVia: 'PUSH' | 'WEB' | 'SMS'
}

export class NotificationDeliveryService {
  private static instance: NotificationDeliveryService
  private supabaseAdmin: any

  constructor() {
    this.supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }

  static getInstance(): NotificationDeliveryService {
    if (!NotificationDeliveryService.instance) {
      NotificationDeliveryService.instance = new NotificationDeliveryService()
    }
    return NotificationDeliveryService.instance
  }

  /**
   * Track notification delivery
   */
  async trackDelivery(
    userId: string,
    notificationId: string,
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'EXPIRED',
    errorMessage?: string
  ): Promise<void> {
    try {
      const deliveryData = {
        user_id: userId,
        notification_id: notificationId,
        delivery_status: status,
        delivery_attempts: 1,
        last_attempt_at: new Date().toISOString(),
        error_message: errorMessage,
        delivered_at: status === 'DELIVERED' ? new Date().toISOString() : null
      }

      // Check if delivery record already exists
      const { data: existing } = await this.supabaseAdmin
        .from('notification_deliveries')
        .select('id, delivery_attempts')
        .eq('user_id', userId)
        .eq('notification_id', notificationId)
        .single()

      if (existing) {
        // Update existing record
        await this.supabaseAdmin
          .from('notification_deliveries')
          .update({
            delivery_status: status,
            delivery_attempts: existing.delivery_attempts + 1,
            last_attempt_at: new Date().toISOString(),
            error_message: errorMessage,
            delivered_at: status === 'DELIVERED' ? new Date().toISOString() : existing.delivered_at
          })
          .eq('id', existing.id)
      } else {
        // Create new record
        await this.supabaseAdmin
          .from('notification_deliveries')
          .insert(deliveryData)
      }
    } catch (error) {
      console.error('Error tracking notification delivery:', error)
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string,
    readVia: 'PUSH' | 'WEB' | 'SMS' = 'WEB'
  ): Promise<void> {
    try {
      // Update notification delivery record
      await this.supabaseAdmin
        .from('notification_deliveries')
        .update({
          read_at: new Date().toISOString(),
          delivery_status: 'DELIVERED'
        })
        .eq('notification_id', notificationId)
        .eq('user_id', userId)

      // Create read status record
      await this.supabaseAdmin
        .from('notification_read_status')
        .upsert({
          notification_id: notificationId,
          user_id: userId,
          read_at: new Date().toISOString(),
          read_via: readVia
        }, {
          onConflict: 'notification_id,user_id'
        })

      // Update notification table
      await this.supabaseAdmin
        .from('notifications')
        .update({
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)

    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting unread notifications:', error)
      return []
    }
  }

  /**
   * Get notification delivery status
   */
  async getDeliveryStatus(notificationId: string, userId: string): Promise<NotificationDelivery | null> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('notification_deliveries')
        .select('*')
        .eq('notification_id', notificationId)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting delivery status:', error)
      return null
    }
  }

  /**
   * Check if user has notification preferences enabled
   */
  async checkNotificationPreferences(userId: string, notificationType: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('notification_preferences')
        .select('push_enabled, incident_alerts, status_updates, escalation_alerts, training_reminders')
        .eq('user_id', userId)
        .single()

      if (error) {
        // If no preferences found, default to enabled
        return true
      }

      // Check if push notifications are enabled
      if (!data.push_enabled) {
        return false;
      }

      // Check specific notification type
      switch (notificationType) {
        case 'incident_alert':
          return data.incident_alerts !== false
        case 'status_update':
          return data.status_updates !== false
        case 'escalation_alert':
          return data.escalation_alerts !== false
        case 'training_reminder':
          return data.training_reminders !== false
        case 'assignment_alert':
          return data.incident_alerts !== false
        default:
          return true
      }
    } catch (error) {
      console.error('Error checking notification preferences:', error)
      return true // Default to enabled if error
    }
  }

  /**
   * Send notification with delivery tracking
   */
  async sendNotificationWithTracking(
    userId: string,
    notification: {
      title: string
      body: string
      type: string
      data?: any
    }
  ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    try {
      // Check if user has notifications enabled
      const notificationsEnabled = await this.checkNotificationPreferences(userId, notification.type)
      if (!notificationsEnabled) {
        return {
          success: false,
          error: 'User has disabled notifications'
        }
      }

      // Create notification record
      const { data: notificationRecord, error: notificationError } = await this.supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          data: notification.data || {},
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (notificationError) throw notificationError

      // Track delivery as pending
      await this.trackDelivery(userId, notificationRecord.id, 'PENDING')

      // Send push notification
      const { data: subscriptions } = await this.supabaseAdmin
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId)
        .limit(1)

      if (subscriptions && subscriptions.length > 0) {
        try {
          const payload = {
            title: notification.title,
            body: notification.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
              ...notification.data,
              notificationId: notificationRecord.id
            }
          }

          await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: subscriptions[0].subscription,
              payload
            })
          })

          // Track as sent
          await this.trackDelivery(userId, notificationRecord.id, 'SENT')

        } catch (pushError: unknown) {
          // Track as failed
          await this.trackDelivery(userId, notificationRecord.id, 'FAILED', (pushError as Error).message)
        }
      } else {
        // No active subscription
        await this.trackDelivery(userId, notificationRecord.id, 'FAILED', 'No active push subscription')
      }

      return {
        success: true,
        notificationId: notificationRecord.id
      }

    } catch (error: any) {
      console.error('Error sending notification with tracking:', error)
      return {
        success: false,
        error: error.message || 'Failed to send notification'
      }
    }
  }

  /**
   * Get notification statistics for user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number
    unread: number
    read: number
    failed: number
  }> {
    try {
      const { data: notifications } = await this.supabaseAdmin
        .from('notifications')
        .select('id, read_at')
        .eq('user_id', userId)

      const { data: deliveries } = await this.supabaseAdmin
        .from('notification_deliveries')
        .select('delivery_status')
        .eq('user_id', userId)

      const total = notifications?.length || 0
      const unread = notifications?.filter((n: { read_at: string | null }) => !n.read_at).length || 0
      const read = notifications?.filter((n: { read_at: string | null }) => n.read_at).length || 0
      const failed = deliveries?.filter((d: { delivery_status: string }) => d.delivery_status === 'FAILED').length || 0

      return { total, unread, read, failed }
    } catch (error) {
      console.error('Error getting notification stats:', error)
      return { total: 0, unread: 0, read: 0, failed: 0 }
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      // Delete old notifications
      await this.supabaseAdmin
        .from('notifications')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      // Delete old delivery records
      await this.supabaseAdmin
        .from('notification_deliveries')
        .delete()
        .lt('last_attempt_at', cutoffDate.toISOString())

      // Delete old read status records
      await this.supabaseAdmin
        .from('notification_read_status')
        .delete()
        .lt('read_at', cutoffDate.toISOString())

    } catch (error) {
      console.error('Error cleaning up old notifications:', error)
    }
  }
}

// Export singleton instance
export const notificationDeliveryService = NotificationDeliveryService.getInstance()
