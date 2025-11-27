// src/lib/push-notification-helper.ts
// Reusable helper for sending push notifications to users
// Works in both development and production

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  requireInteraction?: boolean
  vibrate?: number[]
  actions?: Array<{ action: string; title: string }>
  renotify?: boolean
  silent?: boolean
}

/**
 * Configure webpush with VAPID keys (only needs to be called once)
 */
function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  
  if (!publicKey || !privateKey) {
    console.error('[push-helper] ❌ Missing VAPID keys! Push notifications will not work.')
    return false
  }

  try {
    const vapidEmail = process.env.VAPID_EMAIL || process.env.WEB_PUSH_CONTACT || 'mailto:jlcbelonio.chmsu@gmail.com'
    webpush.setVapidDetails(vapidEmail, publicKey, privateKey)
    return true
  } catch (error: any) {
    console.error('[push-helper] ❌ Failed to configure VAPID keys:', error.message)
    return false
  }
}

/**
 * Send push notifications to specific user IDs
 * @param userIds Array of user IDs to send notifications to
 * @param payload Push notification payload
 * @returns Object with success count and failure count
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ successCount: number; failureCount: number }> {
  if (!userIds || userIds.length === 0) {
    console.log('[push-helper] No user IDs provided')
    return { successCount: 0, failureCount: 0 }
  }

  // Check VAPID keys
  if (!configureWebPush()) {
    console.error('[push-helper] Cannot send push notifications: VAPID keys not configured')
    return { successCount: 0, failureCount: 0 }
  }

  try {
    // Get push subscriptions for all users
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription, user_id, endpoint')
      .in('user_id', userIds)

    if (subError) {
      console.error('[push-helper] Error fetching subscriptions:', subError)
      return { successCount: 0, failureCount: 0 }
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[push-helper] No push subscriptions found for ${userIds.length} user(s)`)
      return { successCount: 0, failureCount: 0 }
    }

    // Filter valid subscriptions
    const validSubscriptions = subscriptions.filter((sub: any) => {
      if (!sub.subscription) return false
      
      let subscriptionObj = sub.subscription
      if (typeof subscriptionObj === 'string') {
        try {
          subscriptionObj = JSON.parse(subscriptionObj)
        } catch {
          return false
        }
      }
      
      return subscriptionObj?.endpoint && subscriptionObj?.keys?.p256dh && subscriptionObj?.keys?.auth
    })

    if (validSubscriptions.length === 0) {
      console.log(`[push-helper] No valid push subscriptions found for ${userIds.length} user(s)`)
      return { successCount: 0, failureCount: 0 }
    }

    console.log(`[push-helper] Sending push notifications to ${validSubscriptions.length} device(s)`)

    // Send push notifications
    const results = await Promise.allSettled(
      validSubscriptions.map(async (sub: any) => {
        try {
          // Parse subscription if needed
          let subscriptionObj = sub.subscription
          if (typeof subscriptionObj === 'string') {
            subscriptionObj = JSON.parse(subscriptionObj)
          }
          
          // Validate subscription structure
          if (!subscriptionObj?.endpoint || !subscriptionObj?.keys?.p256dh || !subscriptionObj?.keys?.auth) {
            throw new Error('Invalid subscription structure')
          }
          
          // Send push notification
          const payloadString = JSON.stringify(payload)
          await webpush.sendNotification(
            subscriptionObj as webpush.PushSubscription,
            payloadString
          )
          
          return { success: true, userId: sub.user_id }
        } catch (error: any) {
          console.error(`[push-helper] Failed to send push to user ${sub.user_id}:`, {
            message: error.message,
            statusCode: error.statusCode
          })
          
          // Remove expired subscriptions (410 = Gone)
          if (error.statusCode === 410 && sub.subscription?.endpoint) {
            try {
              await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.subscription.endpoint)
              console.log(`[push-helper] Removed expired subscription for user ${sub.user_id}`)
            } catch (deleteError) {
              console.error('[push-helper] Failed to delete expired subscription:', deleteError)
            }
          }
          
          return { success: false, userId: sub.user_id, error: error.message }
        }
      })
    )

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failureCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length

    if (successCount > 0) {
      console.log(`[push-helper] ✅ Sent push notifications to ${successCount}/${validSubscriptions.length} device(s)`)
    }
    if (failureCount > 0) {
      console.warn(`[push-helper] ⚠️ Failed to send ${failureCount} push notification(s)`)
    }

    return { successCount, failureCount }
  } catch (error: any) {
    console.error('[push-helper] Error sending push notifications:', error)
    return { successCount: 0, failureCount: 0 }
  }
}

/**
 * Send push notification to a single user
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<boolean> {
  const result = await sendPushToUsers([userId], payload)
  return result.successCount > 0
}

