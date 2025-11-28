import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Notification preferences schema
const NotificationPreferencesSchema = z.object({
  push_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  incident_alerts: z.boolean().optional(),
  status_updates: z.boolean().optional(),
  escalation_alerts: z.boolean().optional(),
  training_reminders: z.boolean().optional(),
  sound_enabled: z.boolean().optional(),
  vibration_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional()
})

// Get notification preferences
export async function GET(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'notifications:preferences:get'), 60)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not authenticated' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Return default preferences if none found
    const defaultPreferences = {
      push_enabled: true,
      sms_enabled: false,
      email_enabled: true,
      incident_alerts: true,
      status_updates: true,
      escalation_alerts: true,
      training_reminders: true,
      sound_enabled: true,
      vibration_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00'
    }

    return NextResponse.json({
      success: true,
      data: data || defaultPreferences
    })

  } catch (error: any) {
    console.error('Notification preferences GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch notification preferences' },
      { status: 500 }
    )
  }
}

// Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'notifications:preferences:put'), 20)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const body = await request.json()
    const parsed = NotificationPreferencesSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid preferences data', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not authenticated' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        ...parsed.data,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'Notification preferences updated successfully'
    })

  } catch (error: any) {
    console.error('Notification preferences PUT error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}

// Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'notifications:read:patch'), 30)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const body = await request.json()
    const { notification_id, read_via = 'WEB' } = body

    if (!notification_id) {
      return NextResponse.json(
        { success: false, message: 'Notification ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Update notification delivery record
    await supabase
      .from('notification_deliveries')
      .update({
        read_at: new Date().toISOString(),
        delivery_status: 'DELIVERED'
      })
      .eq('notification_id', notification_id)
      .eq('user_id', user.id)

    // Create read status record
    await supabase
      .from('notification_read_status')
      .upsert({
        notification_id,
        user_id: user.id,
        read_at: new Date().toISOString(),
        read_via
      }, {
        onConflict: 'notification_id,user_id'
      })

    // Update notification table
    await supabase
      .from('notifications')
      .update({
        read_at: new Date().toISOString()
      })
      .eq('id', notification_id)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read'
    })

  } catch (error: any) {
    console.error('Notification read PATCH error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}