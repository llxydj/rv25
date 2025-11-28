import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'

// Trainings feature is enabled by default
const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED !== 'false'

// CRITICAL: Use service role key to bypass RLS policies
// Get this from: Supabase Dashboard > Project Settings > API > service_role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only - NEVER expose to client
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Public client for reads
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Validation schema
const TrainingCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  start_at: z.string().datetime('Invalid datetime format'),
  description: z.string().nullable().optional(),
  end_at: z.string().datetime('Invalid datetime format').nullable().optional(),
  location: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED']).default('SCHEDULED').optional(),
  created_by: z.string().nullable().optional()
})

export async function GET(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'trainings:get'), 60)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any }
      )
    }

    // Use public client for reads (RLS allows public SELECT)
    const { data, error } = await supabasePublic
      .from('trainings')
      .select('*')
      .order('start_at', { ascending: false })

    if (error) {
      console.error('❌ Supabase GET error:', error)
      throw error
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    console.error('❌ GET /api/trainings error:', e)
    return NextResponse.json(
      { 
        success: false, 
        message: e?.message || 'Failed to fetch trainings',
        error: e?.code || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    if (!FEATURE_ENABLED) {
      return NextResponse.json(
        { success: false, message: 'Trainings feature is disabled' },
        { status: 404 }
      )
    }

    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'trainings:post'), 20)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any }
      )
    }

    // Parse request body
    let body: any
    try {
      body = await request.json()
      console.log('📥 Received training data:', body)
    } catch (e) {
      console.error('❌ JSON parse error:', e)
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate
    const parsed = TrainingCreateSchema.safeParse(body)
    
    if (!parsed.success) {
      console.error('❌ Validation error:', parsed.error.flatten())
      
      const errorMessages = Object.entries(parsed.error.flatten().fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
        .join('; ')
      
      return NextResponse.json(
        {
          success: false,
          message: `Validation failed: ${errorMessages}`,
          issues: parsed.error.flatten(),
          fieldErrors: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { title, description, start_at, end_at, location, created_by } = parsed.data

    console.log('✅ Validation passed, inserting:', {
      title,
      start_at,
      has_description: !!description,
      has_end_at: !!end_at,
      has_location: !!location,
      has_created_by: !!created_by
    })

    const { capacity, status } = body

    const insertData = {
      title: title.trim(),
      description: description || null,
      start_at: start_at,
      end_at: end_at || null,
      location: location || null,
      capacity: capacity ? parseInt(capacity) : null,
      status: status || 'SCHEDULED',
      created_by: created_by || null
    }

    console.log('📤 Inserting with SERVICE ROLE (bypasses RLS):', insertData)

    // CRITICAL: Use admin client to bypass RLS policies
    const { data, error } = await supabaseAdmin
      .from('trainings')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase INSERT error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })

      let userMessage = 'Failed to create training'
      
      if (error.code === '23505') {
        userMessage = 'A training with this information already exists'
      } else if (error.code === '23503') {
        userMessage = 'Invalid reference - check foreign key constraints'
      } else if (error.code === '42501') {
        userMessage = 'Permission denied - service role should bypass this!'
      } else if (error.code === '42703') {
        userMessage = 'Database column mismatch'
      } else if (error.message) {
        userMessage = error.message
      }

      return NextResponse.json(
        {
          success: false,
          message: userMessage,
          error: error.code,
          details: error.details,
          hint: error.hint
        },
        { status: 500 }
      )
    }

    if (!data) {
      console.error('❌ No data returned after insert')
      return NextResponse.json(
        { success: false, message: 'Training created but no data returned' },
        { status: 500 }
      )
    }

    console.log('✅ Training created successfully:', data.id)

    // Send notifications to enrolled volunteers (if any enrollments exist)
    // This will be handled when volunteers enroll, but we can add bulk notification here if needed

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )
  } catch (e: any) {
    console.error('❌ POST /api/trainings unexpected error:', {
      message: e?.message,
      stack: e?.stack,
      name: e?.name
    })

    return NextResponse.json(
      {
        success: false,
        message: e?.message || 'An unexpected error occurred',
        error: e?.name || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    )
  }
}