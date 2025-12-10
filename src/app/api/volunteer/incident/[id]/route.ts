import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/volunteer/incident/[id]
 * Fetch incident by ID with reporter and assigned volunteer names
 * Uses service role key to bypass RLS (like volunteer incidents list does)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Verify user is volunteer
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', uid)
      .single()

    if (!user || user.role !== 'volunteer') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Volunteer access required' 
      }, { status: 403 })
    }

    // Use service role key to bypass RLS (like volunteer incidents list does)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const incidentId = params.id

    // Fetch incident with reporter and assignee names
    const { data: incident, error } = await adminClient
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
      .eq('id', incidentId)
      .single()

    if (error) {
      console.error('❌ Error fetching incident (volunteer):', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          code: 'NOT_FOUND',
          message: 'Incident not found' 
        }, { status: 404 })
      }
      return NextResponse.json({ 
        success: false, 
        code: 'DATABASE_ERROR',
        message: error.message || 'Failed to fetch incident' 
      }, { status: 500 })
    }

    // Verify volunteer has access to this incident (assigned to them)
    if (incident.assigned_to !== uid) {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'You do not have access to this incident' 
      }, { status: 403 })
    }

    return NextResponse.json({ 
      success: true, 
      data: incident 
    })
  } catch (error: any) {
    console.error('❌ Error in volunteer incident API:', error)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

