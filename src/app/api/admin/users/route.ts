import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
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

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Fetch users with pagination
    const { data: users, error: usersError, count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (usersError) throw usersError

    // For residents, also fetch their incident count
    const residentIds = users.filter((u: any) => u.role === 'resident').map((u: any) => u.id)
    const residentIncidentCounts: Record<string, number> = {}
    
    if (residentIds.length > 0) {
      const { data: incidentCounts, error: incidentError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', residentIds)
      
      if (!incidentError && incidentCounts) {
        // Count incidents per reporter
        incidentCounts.forEach((item: any) => {
          residentIncidentCounts[item.reporter_id] = (residentIncidentCounts[item.reporter_id] || 0) + 1
        })
      }
    }

    // Merge incident counts with users
    const usersWithIncidentData = users.map((user: any) => ({
      ...user,
      incident_count: residentIncidentCounts[user.id] || 0
    }))

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count,
        current_page: page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users' 
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId, action } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } else if (action === 'activate') {
      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Instead of deleting the user, we'll deactivate them
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'inactive',
        email: `deactivated_${Date.now()}_${userId}@example.com`,
        phone_number: null,
        address: null,
        first_name: '[DEACTIVATED]',
        last_name: '[USER]'
      })
      .eq('id', userId)
    
    if (updateError) throw updateError

    // Anonymize incidents reported by this user
    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: 'User deactivated and data anonymized successfully' })
  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}