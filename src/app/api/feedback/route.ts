import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Feedback submission schema
const FeedbackSchema = z.object({
  incident_id: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional()
})

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

// Submit feedback
export async function POST(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'feedback:post'), 10)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const body = await request.json()
    const parsed = FeedbackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid feedback data', issues: parsed.error.flatten() },
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

    const { incident_id, rating, comment } = parsed.data

    // Check if incident exists
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('id, status')
      .eq('id', incident_id)
      .single()

    if (incidentError || !incident) {
      return NextResponse.json(
        { success: false, message: 'Incident not found' },
        { status: 404 }
      )
    }

    // Check if feedback already exists
    const { data: existingFeedback } = await supabase
      .from('incident_feedback')
      .select('id')
      .eq('incident_id', incident_id)
      .eq('user_id', user.id)
      .single()

    let result
    if (existingFeedback) {
      // Update existing feedback
      result = await supabase
        .from('incident_feedback')
        .update({
          rating,
          comment: comment || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingFeedback.id)
        .select()
        .single()
    } else {
      // Create new feedback
      result = await supabase
        .from('incident_feedback')
        .insert({
          incident_id,
          user_id: user.id,
          rating,
          comment: comment || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) throw result.error

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Feedback submitted successfully'
    })

  } catch (error: any) {
    console.error('Feedback API error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

// Get feedback for incident
export async function GET(request: NextRequest) {
  try {
    // Increased limit for GET requests (read-only, less critical) - 120 requests per minute
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'feedback:get'), 120)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const { searchParams } = new URL(request.url)
    const incidentId = searchParams.get('incident_id')

    if (!incidentId) {
      return NextResponse.json(
        { success: false, message: 'Incident ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('incident_feedback')
      .select(`
        id,
        rating,
        comment,
        created_at,
        updated_at,
        users!incident_feedback_user_id_fkey (
          first_name,
          last_name,
          role
        )
      `)
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error: any) {
    console.error('Feedback GET API error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}