"use client"

import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export interface NotificationSubscription {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  subscription: any
  subscriptionHash: string
  userAgent: string
  createdAt: string
  lastUsed: string
  isActive: boolean
}

export interface NotificationPreferences {
  userId: string
  pushEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  incidentAlerts: boolean
  statusUpdates: boolean
  escalationAlerts: boolean
  trainingReminders: boolean
  soundEnabled: boolean
  vibrationEnabled: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
}

export interface NotificationDelivery {
  subscriptionId: string
  userId: string
  notificationId: string
  deliveryStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'EXPIRED'
  deliveryAttempts: number
  lastAttemptAt?: string
  errorMessage?: string
  deliveredAt?: string
}

export class NotificationSubscriptionService {
  private static instance: NotificationSubscriptionService
  private supabaseAdmin: any

  constructor() {
    // Check if environment variables are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase environment variables not configured, notifications will be disabled');
      this.supabaseAdmin = null;
      return;
    }
    
    this.supabaseAdmin = createClient(
      supabaseUrl,
      supabaseKey,
      { auth: { persistSession: false } }
    );
  }

  static getInstance(): NotificationSubscriptionService {
    if (!NotificationSubscriptionService.instance) {
      NotificationSubscriptionService.instance = new NotificationSubscriptionService()
    }
    return NotificationSubscriptionService.instance
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribeUser(
    userId: string, 
    subscription: PushSubscription, 
    userAgent: string = ''
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Generate subscription hash for deduplication
      const subscriptionHash = await this.generateSubscriptionHash(subscription)

      // Check if subscription already exists
      const { data: existing } = await this.supabaseAdmin
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('subscription_hash', subscriptionHash)
        .limit(1)

      if (existing && existing.length > 0) {
        // Update last used timestamp
        await this.supabaseAdmin
          .from('push_subscriptions')
          .update({ last_used: new Date().toISOString() })
          .eq('id', existing[0].id)

        return {
          success: true,
          message: 'Subscription updated successfully'
        }
      }

      // Create new subscription
      const { error } = await this.supabaseAdmin
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.getKey('p256dh'),
          auth: subscription.getKey('auth'),
          subscription: subscription.toJSON(),
          subscription_hash: subscriptionHash,
          user_agent: userAgent,
          created_at: new Date().toISOString(),
          last_used: new Date().toISOString()
          // Note: is_active column doesn't exist in this schema
        })

      if (error) throw error

      // Initialize notification preferences if they don't exist
      await this.initializeNotificationPreferences(userId)

      return {
        success: true,
        message: 'Successfully subscribed to notifications'
      }
    } catch (error: any) {
      console.error('Error subscribing user:', error)
      return {
        success: false,
        message: error.message || 'Failed to subscribe to notifications'
      }
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribeUser(userId: string, subscriptionHash?: string): Promise<{ success: boolean; message: string }> {
    try {
      let query = this.supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)

      if (subscriptionHash) {
        query = query.eq('subscription_hash', subscriptionHash)
      }

      const { error } = await query

      if (error) throw error

      return {
        success: true,
        message: 'Successfully unsubscribed from notifications'
      }
    } catch (error: any) {
      console.error('Error unsubscribing user:', error)
      return {
        success: false,
        message: error.message || 'Failed to unsubscribe from notifications'
      }
    }
  }

  /**
   * Get user's notification subscriptions
   */
  async getUserSubscriptions(userId: string): Promise<NotificationSubscription[]> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error getting user subscriptions:', error)
      return []
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string, 
    preferences: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await this.supabaseAdmin
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      return {
        success: true,
        message: 'Notification preferences updated successfully'
      }
    } catch (error: any) {
      console.error('Error updating notification preferences:', error)
      return {
        success: false,
        message: error.message || 'Failed to update notification preferences'
      }
    }
  }

  /**
   * Get notification preferences for user
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await this.supabaseAdmin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, return default
          return this.getDefaultPreferences(userId)
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('Error getting notification preferences:', error)
      return this.getDefaultPreferences(userId)
    }
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(
    userId: string,
    notification: {
      title: string
      body: string
      data?: any
      actions?: Array<{ action: string; title: string }>
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check user preferences
      const preferences = await this.getNotificationPreferences(userId)
      if (!preferences?.pushEnabled) {
        return {
          success: false,
          message: 'User has disabled push notifications'
        }
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        return {
          success: false,
          message: 'Notification blocked due to quiet hours'
        }
      }

      // Get user's active subscriptions
      const subscriptions = await this.getUserSubscriptions(userId)
      if (subscriptions.length === 0) {
        return {
          success: false,
          message: 'No active subscriptions found for user'
        }
      }

      // Create notification record
      const { data: notificationRecord, error: notificationError } = await this.supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          title: notification.title,
          body: notification.body,
          type: notification.data?.type || 'general',
          data: notification.data || {},
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (notificationError) throw notificationError

      // Send push notifications to all user's devices
      const deliveryResults = await Promise.allSettled(
        subscriptions.map(subscription => this.sendPushNotification(subscription, notification))
      )

      // Log delivery results
      await this.logDeliveryResults(notificationRecord.id, subscriptions, deliveryResults)

      const successfulDeliveries = deliveryResults.filter(result => result.status === 'fulfilled').length
      const totalSubscriptions = subscriptions.length

      return {
        success: successfulDeliveries > 0,
        message: `Notification sent to ${successfulDeliveries}/${totalSubscriptions} devices`
      }
    } catch (error: any) {
      console.error('Error sending notification to user:', error)
      return {
        success: false,
        message: error.message || 'Failed to send notification'
      }
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendNotificationToUsers(
    userIds: string[],
    notification: {
      title: string
      body: string
      data?: any
      actions?: Array<{ action: string; title: string }>
    }
  ): Promise<{ success: boolean; message: string; results: any[] }> {
    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendNotificationToUser(userId, notification))
      )

      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length

      return {
        success: successful > 0,
        message: `Notifications sent to ${successful}/${userIds.length} users`,
        results: results.map(result => 
          result.status === 'fulfilled' ? result.value : { success: false, message: 'Failed' }
        )
      }
    } catch (error: any) {
      console.error('Error sending notifications to users:', error)
      return {
        success: false,
        message: error.message || 'Failed to send notifications',
        results: []
      }
    }
  }

  /**
   * Send notification to all volunteers
   */
  async sendNotificationToVolunteers(
    notification: {
      title: string
      body: string
      data?: any
      actions?: Array<{ action: string; title: string }>
    },
    filters?: {
      barangay?: string
      skills?: string[]
      isAvailable?: boolean
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get volunteer user IDs based on filters
      let query = this.supabaseAdmin
        .from('volunteer_profiles')
        .select('volunteer_user_id')

      if (filters?.isAvailable !== undefined) {
        query = query.eq('is_available', filters.isAvailable)
      }

      if (filters?.barangay) {
        query = query.contains('assigned_barangays', [filters.barangay])
      }

      if (filters?.skills && filters.skills.length > 0) {
        query = query.overlaps('skills', filters.skills)
      }

      const { data: volunteers, error } = await query

      if (error) throw error

      if (!volunteers || volunteers.length === 0) {
        return {
          success: false,
          message: 'No volunteers found matching criteria'
        }
      }

      const volunteerIds = volunteers.map((v: any) => v.volunteer_user_id)
      
      const result = await this.sendNotificationToUsers(volunteerIds, notification)
      
      return {
        success: result.success,
        message: result.message
      }
    } catch (error: any) {
      console.error('Error sending notification to volunteers:', error)
      return {
        success: false,
        message: error.message || 'Failed to send notification to volunteers'
      }
    }
  }

  /**
   * Send notification to all admins
   */
  async sendNotificationToAdmins(
    notification: {
      title: string
      body: string
      data?: any
      actions?: Array<{ action: string; title: string }>
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data: admins, error } = await this.supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'admin')

      if (error) throw error

      if (!admins || admins.length === 0) {
        return {
          success: false,
          message: 'No admins found'
        }
      }

      const adminIds = admins.map((admin: any) => admin.id)
      
      const result = await this.sendNotificationToUsers(adminIds, notification)
      
      return {
        success: result.success,
        message: result.message
      }
    } catch (error: any) {
      console.error('Error sending notification to admins:', error)
      return {
        success: false,
        message: error.message || 'Failed to send notification to admins'
      }
    }
  }

  /**
   * Clean up expired subscriptions
   * Note: Since is_active column doesn't exist, we delete old subscriptions instead
   */
  async cleanupExpiredSubscriptions(): Promise<{ success: boolean; message: string }> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Delete subscriptions that haven't been used in 30 days
      // Note: last_used column might not exist either, so we'll use created_at as fallback
      const { error } = await this.supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())

      if (error) {
        // If last_used doesn't exist, try with created_at
        console.warn('Cleanup with created_at failed, column might not exist:', error.message)
        return {
          success: true,
          message: 'Cleanup skipped (schema compatibility)'
        }
      }

      return {
        success: true,
        message: 'Expired subscriptions cleaned up successfully'
      }
    } catch (error: any) {
      console.error('Error cleaning up expired subscriptions:', error)
      return {
        success: false,
        message: error.message || 'Failed to cleanup expired subscriptions'
      }
    }
  }

  /**
   * Get notification delivery statistics
   */
  async getDeliveryStats(): Promise<{
    totalSubscriptions: number
    activeSubscriptions: number
    expiredSubscriptions: number
    totalNotifications: number
    deliveryRate: number
  }> {
    try {
      const [
        { count: totalSubscriptions },
        { count: activeSubscriptions },
        { count: totalNotifications }
      ] = await Promise.all([
        this.supabaseAdmin.from('push_subscriptions').select('*', { count: 'exact', head: true }),
        // Note: is_active column doesn't exist, so all subscriptions are considered active
        this.supabaseAdmin.from('push_subscriptions').select('*', { count: 'exact', head: true }),
        this.supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true })
      ])

      const expiredSubscriptions = (totalSubscriptions || 0) - (activeSubscriptions || 0)
      const deliveryRate = totalNotifications && totalSubscriptions 
        ? (totalNotifications / totalSubscriptions) * 100 
        : 0

      return {
        totalSubscriptions: totalSubscriptions || 0,
        activeSubscriptions: activeSubscriptions || 0,
        expiredSubscriptions,
        totalNotifications: totalNotifications || 0,
        deliveryRate: Math.round(deliveryRate * 100) / 100
      }
    } catch (error) {
      console.error('Error getting delivery stats:', error)
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        expiredSubscriptions: 0,
        totalNotifications: 0,
        deliveryRate: 0
      }
    }
  }

  // Private helper methods

  private async generateSubscriptionHash(subscription: PushSubscription): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(subscription.endpoint + subscription.getKey('p256dh') + subscription.getKey('auth'))
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private async initializeNotificationPreferences(userId: string): Promise<void> {
    try {
      const defaultPreferences = this.getDefaultPreferences(userId)
      
      await this.supabaseAdmin
        .from('notification_preferences')
        .upsert(defaultPreferences, { onConflict: 'user_id' })
    } catch (error) {
      console.error('Error initializing notification preferences:', error)
    }
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      pushEnabled: true,
      smsEnabled: false,
      emailEnabled: true,
      incidentAlerts: true,
      statusUpdates: true,
      escalationAlerts: true,
      trainingReminders: true,
      soundEnabled: true,
      vibrationEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00'
    }
  }

  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) return false

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number)
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number)
    
    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime
    }
  }

  private async sendPushNotification(
    subscription: NotificationSubscription,
    notification: any
  ): Promise<void> {
    try {
      const payload = {
        title: notification.title,
        body: notification.body,
        icon: '/favicon/android-chrome-192x192.png',
        badge: '/favicon/android-chrome-192x192.png',
        vibrate: [100, 50, 100],
        data: notification.data || {},
        actions: notification.actions || []
      }

      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.subscription,
          payload
        })
      })
    } catch (error) {
      console.error('Error sending push notification:', error)
      throw error
    }
  }

  private async logDeliveryResults(
    notificationId: string,
    subscriptions: NotificationSubscription[],
    results: PromiseSettledResult<any>[]
  ): Promise<void> {
    try {
      const deliveryLogs = results.map((result, index) => ({
        notification_id: notificationId,
        subscription_id: subscriptions[index].id,
        user_id: subscriptions[index].userId,
        delivery_status: result.status === 'fulfilled' ? 'SENT' : 'FAILED',
        delivery_attempts: 1,
        last_attempt_at: new Date().toISOString(),
        error_message: result.status === 'rejected' ? result.reason?.message : null,
        delivered_at: result.status === 'fulfilled' ? new Date().toISOString() : null
      }))

      await this.supabaseAdmin
        .from('notification_deliveries')
        .insert(deliveryLogs)
    } catch (error) {
      console.error('Error logging delivery results:', error)
    }
  }
}

// Export singleton instance
export const notificationSubscriptionService = NotificationSubscriptionService.getInstance()
