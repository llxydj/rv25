import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/incidents/[id]
 * Fetch incident by ID with reporter and assigned volunteer names
 * Uses service role key to bypass RLS (like user management does)
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

    const incidentId = params.id

    console.log('🔍 [Admin Incident API] Fetching incident:', incidentId)

    // Fetch full incident data
    const { data: incidentFull, error: incidentError } = await adminClient
      .from('incidents')
      .select('*')
      .eq('id', incidentId)
      .single()

    if (incidentError || !incidentFull) {
      console.error('❌ Error fetching incident (admin):', incidentError)
      if (incidentError?.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          code: 'NOT_FOUND',
          message: 'Incident not found' 
        }, { status: 404 })
      }
      return NextResponse.json({ 
        success: false, 
        code: 'DATABASE_ERROR',
        message: incidentError?.message || 'Failed to fetch incident' 
      }, { status: 500 })
    }

    console.log('🔍 [Admin Incident API] Incident basic info:', {
      id: incidentFull.id,
      reporter_id: incidentFull.reporter_id,
      assigned_to: incidentFull.assigned_to
    })

    // Fetch reporter separately (more reliable than joins with service role key)
    let reporter = null
    if (incidentFull.reporter_id) {
      const { data: reporterData, error: reporterError } = await adminClient
        .from('users')
        .select('id, first_name, last_name, email, phone_number, role')
        .eq('id', incidentFull.reporter_id)
        .single()
      
      if (reporterError) {
        console.error('❌ Error fetching reporter:', reporterError)
      } else {
        reporter = reporterData
        console.log('✅ [Admin Incident API] Reporter fetched:', {
          id: reporter.id,
          name: `${reporter.first_name} ${reporter.last_name}`,
          email: reporter.email
        })
      }
    } else {
      console.warn('⚠️ [Admin Incident API] No reporter_id found')
    }

    // Fetch assignee separately (more reliable than joins with service role key)
    let assignee = null
    if (incidentFull.assigned_to) {
      const { data: assigneeData, error: assigneeError } = await adminClient
        .from('users')
        .select('id, first_name, last_name, email, phone_number')
        .eq('id', incidentFull.assigned_to)
        .single()
      
      if (assigneeError) {
        console.error('❌ Error fetching assignee:', assigneeError)
      } else {
        assignee = assigneeData
        console.log('✅ [Admin Incident API] Assignee fetched:', {
          id: assignee.id,
          name: `${assignee.first_name} ${assignee.last_name}`,
          email: assignee.email
        })
      }
    } else {
      console.warn('⚠️ [Admin Incident API] No assigned_to found')
    }

    console.log('✅ [Admin Incident API] Final result:', {
      hasReporter: !!reporter,
      hasAssignee: !!assignee
    })

    return NextResponse.json({ 
      success: true, 
      data: {
        ...incidentFull,
        reporter,
        assignee
      }
    })
  } catch (error: any) {
    console.error('❌ Error in admin incident API:', error)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
