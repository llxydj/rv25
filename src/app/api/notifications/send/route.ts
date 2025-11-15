import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@rvois.talisaycity.gov.ph',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { subscription, payload } = await request.json()

    if (!subscription || !payload) {
      return NextResponse.json(
        { success: false, message: 'Missing subscription or payload' },
        { status: 400 }
      )
    }

    // Send push notification
    await webpush.sendNotification(subscription, JSON.stringify(payload))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    
    // Handle specific web-push errors
    if (error.statusCode === 410) {
      // Subscription is no longer valid, should be removed
      return NextResponse.json(
        { success: false, message: 'Subscription expired' },
        { status: 410 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
