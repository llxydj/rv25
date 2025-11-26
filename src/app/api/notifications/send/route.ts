import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getServerSupabase } from '@/lib/supabase-server'

// Configure web-push
webpush.setVapidDetails(
  'mailto:jlcbelonio.chmsu@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { user_id, payload, subscription } = body
    
    // Handle both client-side direct subscription sending and server-side user_id based sending
    if (!user_id && !subscription) {
      console.error('[send] Missing required fields:', {
        hasUserId: !!user_id,
        hasSubscription: !!subscription,
        hasPayload: !!payload
      })
      return NextResponse.json(
        { success: false, message: 'Missing user_id or subscription' },
        { status: 400 }
      )
    }

    if (!payload) {
      console.error('[send] Missing payload')
      return NextResponse.json(
        { success: false, message: 'Missing payload' },
        { status: 400 }
      )
    }

    if (!payload.title || !payload.body) {
      console.error('[send] Invalid payload:', {
        hasTitle: !!payload.title,
        hasBody: !!payload.body
      })
      return NextResponse.json(
        { success: false, message: 'Payload must include title and body' },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()
    let subscriptions: any[] = []

    // If subscription is provided directly (from client), use it
    if (subscription) {
      subscriptions = [{ subscription }]
    } 
    // If user_id is provided (from server), fetch subscriptions from database
    else if (user_id) {
      const { data, error: queryError } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', user_id)

      if (queryError) {
        console.error('[send] Database query error:', {
          message: queryError.message,
          code: queryError.code,
          userId: user_id
        })
        return NextResponse.json(
          { success: false, message: 'Failed to query subscriptions', error: queryError.message },
          { status: 500 }
        )
      }

      if (!data || data.length === 0) {
        console.warn('[send] No subscriptions found for user:', {
          userId: user_id,
          message: 'User needs to enable push notifications first'
        })
        return NextResponse.json({ 
          success: false, 
          message: 'No push subscriptions found for this user. The user needs to enable push notifications first.',
          code: 'NO_SUBSCRIPTIONS',
          hint: 'User should log in and click "Enable Notifications" button'
        }, { status: 404 })
      }

      subscriptions = data
    }

    console.log('[send] Found', subscriptions.length, 'subscription(s)')

    interface SubscriptionRow {
      subscription: {
        endpoint: string
        keys: {
          p256dh: string
          auth: string
        }
      }
    }

    const results = await Promise.all(subscriptions.map(async (sub: SubscriptionRow) => {
      try {
        if (!sub.subscription || !sub.subscription.endpoint) {
          console.warn('[send] Invalid subscription object:', sub)
          return { success: false, error: 'Invalid subscription data' }
        }

        await webpush.sendNotification(sub.subscription, JSON.stringify(payload))
        console.log('[send] Notification sent successfully to:', sub.subscription.endpoint.substring(0, 50) + '...')
        return { success: true, endpoint: sub.subscription.endpoint }
      } catch (err: any) {
        const endpoint = sub.subscription?.endpoint
        console.error('[send] Failed to send notification:', {
          endpoint: endpoint?.substring(0, 50) + '...' || 'unknown',
          statusCode: err.statusCode,
          message: err.message
        })
        
        if (err.statusCode === 410 && endpoint) {
          // Remove expired subscription from DB
          console.log('[send] Removing expired subscription:', endpoint.substring(0, 50) + '...')
          await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
          return { success: false, error: 'Subscription expired and removed', endpoint }
        }
        
        return { success: false, error: err.message || 'Unknown error', endpoint: endpoint || 'unknown' }
      }
    }))

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    
    console.log('[send] Notification send results:', {
      total: subscriptions.length,
      successful: successCount,
      failed: failureCount
    })

    return NextResponse.json({ 
      success: successCount > 0, 
      results,
      summary: {
        total: subscriptions.length,
        successful: successCount,
        failed: failureCount
      }
    })
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to send notification', error: error.message },
      { status: 500 }
    )
  }
}