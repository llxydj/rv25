import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/incidents
 * Fetch all incidents with reporter and assigned volunteer names
 * Uses service role key to bypass RLS (like user management does)
 */
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    
    if (!uid) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'Not authenticated' 
      }, { status: 401 })
    }

    // Verify user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', uid)
      .single()

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    // Use service role key to bypass RLS (like user management does)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limitParam = parseInt(searchParams.get('limit') || '', 10)
    const offsetParam = parseInt(searchParams.get('offset') || '', 10)
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, limitParam)) : 100
    const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0

    // Build query with joins to get reporter and assignee names
    let query = adminClient
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          role
        ),
        assignee:users!incidents_assigned_to_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching incidents (admin):', error)
      return NextResponse.json({ 
        success: false, 
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to fetch incidents' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: data || [] 
    })
  } catch (error: any) {
    console.error('❌ Error in admin incidents API:', error)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

