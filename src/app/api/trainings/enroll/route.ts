import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { smsService } from '@/lib/sms-service'
import webpush from 'web-push'

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { training_id } = body

    if (!training_id) {
      return NextResponse.json(
        { success: false, message: 'Training ID is required' },
        { status: 400 }
      )
    }

    // Check if training exists and is enrollable
    const { data: training, error: trainingError } = await supabaseAdmin
      .from('trainings')
      .select('id, status, capacity')
      .eq('id', training_id)
      .single()

    if (trainingError || !training) {
      return NextResponse.json(
        { success: false, message: 'Training not found' },
        { status: 404 }
      )
    }

    if (training.status !== 'SCHEDULED') {
      return NextResponse.json(
        { success: false, message: 'Training is not available for enrollment' },
        { status: 400 }
      )
    }

    // Check capacity
    if (training.capacity) {
      const { count } = await supabaseAdmin
        .from('training_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('training_id', training_id)

      if (count && count >= training.capacity) {
        return NextResponse.json(
          { success: false, message: 'Training is full' },
          { status: 400 }
        )
      }
    }

    // Check if already enrolled
    const { data: existing } = await supabaseAdmin
      .from('training_enrollments')
      .select('id')
      .eq('training_id', training_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Already enrolled in this training' },
        { status: 400 }
      )
    }

    // Get full training details for notification
    const { data: trainingDetails } = await supabaseAdmin
      .from('trainings')
      .select('title, start_at, end_at, location')
      .eq('id', training_id)
      .single()

    // Get user details for SMS
    const { data: userDetails } = await supabaseAdmin
      .from('users')
      .select('phone_number, first_name, last_name')
      .eq('id', user.id)
      .single()

    // Enroll
    const { data, error } = await supabaseAdmin
      .from('training_enrollments')
      .insert({
        training_id,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Enrollment error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to enroll' },
        { status: 500 }
      )
    }

    // Send SMS notification (fire-and-forget)
    if (userDetails?.phone_number && trainingDetails) {
      try {
        const trainingDate = new Date(trainingDetails.start_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })
        const trainingTime = trainingDetails.start_at 
          ? `${new Date(trainingDetails.start_at).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}${trainingDetails.end_at ? ` - ${new Date(trainingDetails.end_at).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}` : ''}`
          : ''
        const locationText = trainingDetails.location ? ` at ${trainingDetails.location}` : ''

        await smsService.sendSMS(
          userDetails.phone_number,
          'TEMPLATE_TRAINING_NOTIFY',
          {
            title: trainingDetails.title,
            date: trainingDate,
            time: trainingTime,
            location: locationText
          },
          {
            incidentId: training_id.toString(),
            referenceId: training_id.toString().substring(0, 8),
            triggerSource: 'Training_Enrollment',
            recipientUserId: user.id
          }
        )
      } catch (smsErr) {
        console.error('Failed to send SMS for training enrollment:', smsErr)
        // Don't fail the request if SMS fails
      }
    }

    // Send push notification (fire-and-forget)
    try {
      const configured = Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && 
        process.env.VAPID_PRIVATE_KEY
      )
      if (configured) {
        webpush.setVapidDetails(
          process.env.WEB_PUSH_CONTACT || 'mailto:admin@example.com',
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        )

        const { data: subs } = await supabaseAdmin
          .from('push_subscriptions')
          .select('endpoint, subscription')
          .eq('user_id', user.id)

        if (subs && subs.length > 0) {
          await Promise.allSettled(
            subs.map(async (s) => {
              try {
                const subscription = s.subscription as unknown as webpush.PushSubscription
                await webpush.sendNotification(
                  subscription,
                  JSON.stringify({
                    title: 'Training Enrollment Confirmed',
                    body: `${trainingDetails?.title || 'Training'} • ${trainingDate}`,
                    url: '/volunteer/trainings'
                  })
                )
              } catch {}
            })
          )
        }
      }
    } catch (pushErr) {
      console.error('Failed to send push notification for training enrollment:', pushErr)
      // Don't fail the request if push fails
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('❌ POST /api/trainings/enroll error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to enroll' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const training_id = searchParams.get('training_id')

    if (!training_id) {
      return NextResponse.json(
        { success: false, message: 'Training ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('training_enrollments')
      .delete()
      .eq('training_id', training_id)
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ Unenrollment error:', error)
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to unenroll' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('❌ DELETE /api/trainings/enroll error:', e)
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed to unenroll' },
      { status: 500 }
    )
  }
}

