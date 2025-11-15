import { NextRequest, NextResponse } from 'next/server'
import { smsService } from '@/lib/sms-service'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// SMS Send API Endpoint
export async function POST(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'sms:send:post'), 10)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const body = await request.json()
    const { 
      phoneNumber, 
      templateCode, 
      variables, 
      context 
    } = body

    // Validate required fields
    if (!phoneNumber || !templateCode || !context) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: phoneNumber, templateCode, context' },
        { status: 400 }
      )
    }

    // Validate context
    const { incidentId, referenceId, triggerSource, recipientUserId } = context
    if (!incidentId || !referenceId || !triggerSource || !recipientUserId) {
      return NextResponse.json(
        { success: false, message: 'Invalid context: missing required fields' },
        { status: 400 }
      )
    }

    // Send SMS
    const result = await smsService.sendSMS(
      phoneNumber,
      templateCode,
      variables || {},
      context
    )

    return NextResponse.json({
      success: result.success,
      message: result.success ? 'SMS sent successfully' : result.error,
      retryable: result.retryable
    })

  } catch (error: any) {
    console.error('SMS API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// SMS Logs API Endpoint
export async function GET(request: NextRequest) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'sms:logs:get'), 60)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const incidentId = searchParams.get('incident_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = await getServerSupabase()

    let query = supabase
      .from('sms_logs')
      .select('*')
      .order('timestamp_sent', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('delivery_status', status.toUpperCase())
    }

    if (incidentId) {
      query = query.eq('incident_id', incidentId)
    }

    if (startDate) {
      query = query.gte('timestamp_sent', startDate)
    }

    if (endDate) {
      query = query.lte('timestamp_sent', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error: any) {
    console.error('SMS logs API error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch SMS logs' },
      { status: 500 }
    )
  }
}
