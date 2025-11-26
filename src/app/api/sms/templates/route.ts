// src/app/api/sms/templates/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'

export const runtime = 'nodejs'

const SMSTemplateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  content: z.string().min(1),
  variables: z.array(z.string()),
  is_active: z.boolean().optional().default(true)
})

// =======================
// Helper: Admin Access
// =======================
async function verifyAdminAccess(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { authorized: false, error: 'Unauthorized', status: 401 }
    }

    const { data: adminProfile } = await supabase
      .from('admin_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!adminProfile) {
      return { authorized: false, error: 'Admin access required', status: 403 }
    }

    return { authorized: true, user }
  } catch (error: any) {
    return { authorized: false, error: error.message, status: 500 }
  }
}

// =======================
// GET SMS Templates
// =======================
export async function GET(request: NextRequest) {
  try {
    // ✅ Verify Admin
    const auth = await verifyAdminAccess(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      )
    }

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'sms:templates:get'), 60)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const supabase = await getServerSupabase()
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabase
      .from('sms_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('SMS templates GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch SMS templates' },
      { status: 500 }
    )
  }
}

// =======================
// CREATE SMS Template
// =======================
export async function POST(request: NextRequest) {
  try {
    // ✅ Verify Admin
    const auth = await verifyAdminAccess(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      )
    }

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'sms:templates:post'), 20)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const body = await request.json()
    const parsed = SMSTemplateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid template data', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()

    const { data: existing } = await supabase
      .from('sms_templates')
      .select('id')
      .eq('code', parsed.data.code)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Template code already exists' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('sms_templates')
      .insert({
        ...parsed.data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'SMS template created successfully'
    })
  } catch (error: any) {
    console.error('SMS templates POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to create SMS template' },
      { status: 500 }
    )
  }
}

// =======================
// UPDATE SMS Template
// =======================
export async function PUT(request: NextRequest) {
  try {
    // ✅ Verify Admin
    const auth = await verifyAdminAccess(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      )
    }

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'sms:templates:put'), 20)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Template ID is required' },
        { status: 400 }
      )
    }

    const parsed = SMSTemplateSchema.partial().safeParse(updateData)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid template data', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('sms_templates')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'SMS template updated successfully'
    })
  } catch (error: any) {
    console.error('SMS templates PUT error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update SMS template' },
      { status: 500 }
    )
  }
}

// =======================
// DELETE SMS Template
// =======================
export async function DELETE(request: NextRequest) {
  try {
    // ✅ Verify Admin
    const auth = await verifyAdminAccess(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      )
    }

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'sms:templates:delete'), 10)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Template ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()

    const { error } = await supabase
      .from('sms_templates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'SMS template deleted successfully'
    })
  } catch (error: any) {
    console.error('SMS templates DELETE error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete SMS template' },
      { status: 500 }
    )
  }
}
