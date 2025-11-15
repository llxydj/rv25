import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ReportCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  report_type: z.enum(['INCIDENT_REPORT', 'ACTIVITY_REPORT', 'SITUATION_REPORT']),
  description: z.string().min(1, 'Description is required'),
  incident_id: z.string().optional(),
  created_by: z.string()
})

const ReportUpdateSchema = z.object({
  id: z.string(),
  status: z.enum(['SUBMITTED', 'REVIEWED', 'REJECTED']).optional(),
  review_notes: z.string().optional(),
  reviewed_by: z.string().optional()
})

export async function GET(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'reports:get'), 60)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const created_by = searchParams.get('created_by')
    const report_type = searchParams.get('report_type')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (created_by) {
      query = query.eq('created_by', created_by)
    }

    if (report_type) {
      query = query.eq('report_type', report_type)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch reports' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'reports:post'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = ReportCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('reports')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to create report' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'reports:put'), 20)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = ReportUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const { id, ...updateData } = parsed.data

    // Auto-set reviewed_at when status is set to REVIEWED/REJECTED
    if (updateData.status && (updateData.status === 'REVIEWED' || updateData.status === 'REJECTED')) {
      (updateData as any).reviewed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to update report' }, { status: 500 })
  }
}

