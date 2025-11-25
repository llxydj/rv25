// src/app/api/notifications/send/route.ts

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
    const { user_id, payload } = await req.json()
    if (!user_id || !payload) {
      return NextResponse.json(
        { success: false, message: 'Missing user_id or payload' },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (!subscriptions?.length) {
      return NextResponse.json({ success: false, message: 'No subscriptions found' })
    }

    const results = await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload))
        return { success: true, endpoint: sub.subscription.endpoint }
      } catch (err: any) {
        if (err.statusCode === 410) {
          // Remove expired subscription from DB
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.subscription.endpoint)
        }
        return { success: false, error: err.message }
      }
    }))

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to send notification', error: error.message },
      { status: 500 }
    )
  }
}
