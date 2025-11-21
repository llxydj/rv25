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
    const limit = parseInt(url.searchParams.get('limit') || '1000') // Increased default to show more users
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true' // Option to get all users without pagination

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    
    // Only apply status filter if statusFilter is provided and not 'all'
    // Note: If status column doesn't exist, this will be handled gracefully
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }
    
    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }
    
    if (searchTerm) {
      // Search in name and email using or filter
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply pagination only if not getting all
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data: users, error: usersError, count } = await query

    if (usersError) {
      console.error('Error fetching users from database:', usersError)
      // If error is about missing column, try without status filter
      if (usersError.message?.includes('status') || usersError.message?.includes('column')) {
        console.log('Retrying query without status filter...')
        // Retry without status filter
        let retryQuery = supabaseAdmin
          .from('users')
          .select('*', { count: 'exact' })
        
        if (roleFilter && roleFilter !== 'all') {
          retryQuery = retryQuery.eq('role', roleFilter)
        }
        
        if (barangayFilter && barangayFilter !== 'all') {
          retryQuery = retryQuery.eq('barangay', barangayFilter)
        }
        
        if (searchTerm) {
          retryQuery = retryQuery.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        }
        
        if (!getAll) {
          retryQuery = retryQuery.range(offset, offset + limit - 1)
        }
        
        retryQuery = retryQuery.order('created_at', { ascending: false })
        
        const retryResult = await retryQuery
        if (retryResult.error) {
          throw retryResult.error
        }
        
        // Use retry result
        const retryUsers = retryResult.data || []
        const retryCount = retryResult.count || 0
        
        // Continue with retryUsers
        const userIds = retryUsers.map((u: any) => u.id)
        const userIncidentCounts: Record<string, number> = {}
        
        if (userIds.length > 0) {
          const { data: reportedIncidents } = await supabaseAdmin
            .from('incidents')
            .select('reporter_id')
            .in('reporter_id', userIds)
          
          if (reportedIncidents) {
            reportedIncidents.forEach((item: any) => {
              if (item.reporter_id) {
                userIncidentCounts[item.reporter_id] = (userIncidentCounts[item.reporter_id] || 0) + 1
              }
            })
          }
          
          const { data: assignedIncidents } = await supabaseAdmin
            .from('incidents')
            .select('assigned_to')
            .in('assigned_to', userIds)
          
          if (assignedIncidents) {
            assignedIncidents.forEach((item: any) => {
              if (item.assigned_to) {
                userIncidentCounts[item.assigned_to] = (userIncidentCounts[item.assigned_to] || 0) + 1
              }
            })
          }
        }
        
        const usersWithIncidentData = retryUsers.map((user: any) => ({
          ...user,
          incident_count: userIncidentCounts[user.id] || 0,
          status: user.status || 'active'
        }))
        
        return NextResponse.json({ 
          success: true, 
          data: usersWithIncidentData,
          meta: {
            total_count: retryCount || usersWithIncidentData.length,
            current_page: getAll ? 1 : page,
            per_page: getAll ? retryCount || usersWithIncidentData.length : limit,
            total_pages: getAll ? 1 : Math.ceil((retryCount || 0) / limit)
          }
        })
      }
      throw usersError
    }

    // Ensure users is an array
    const usersArray = users || []
    console.log(`Fetched ${usersArray.length} users from database`)
    
    // Fetch incident counts for all users (residents report, volunteers are assigned)
    const userIds = usersArray.map((u: any) => u.id)
    const userIncidentCounts: Record<string, number> = {}
    
    if (userIds.length > 0) {
      // Count incidents reported by users (for residents)
      const { data: reportedIncidents, error: reportedError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', userIds)
      
      if (!reportedError && reportedIncidents) {
        reportedIncidents.forEach((item: any) => {
          if (item.reporter_id) {
            userIncidentCounts[item.reporter_id] = (userIncidentCounts[item.reporter_id] || 0) + 1
          }
        })
      }
      
      // Count incidents assigned to users (for volunteers)
      const { data: assignedIncidents, error: assignedError } = await supabaseAdmin
        .from('incidents')
        .select('assigned_to')
        .in('assigned_to', userIds)
      
      if (!assignedError && assignedIncidents) {
        assignedIncidents.forEach((item: any) => {
          if (item.assigned_to) {
            userIncidentCounts[item.assigned_to] = (userIncidentCounts[item.assigned_to] || 0) + 1
          }
        })
      }
    }

    // Merge incident counts with users and ensure status field exists
    const usersWithIncidentData = usersArray.map((user: any) => ({
      ...user,
      incident_count: userIncidentCounts[user.id] || 0,
      status: user.status || 'active' // Default to active if status column doesn't exist
    }))

    console.log(`Returning ${usersWithIncidentData.length} users with incident data`)

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count || usersWithIncidentData.length,
        current_page: getAll ? 1 : page,
        per_page: getAll ? count || usersWithIncidentData.length : limit,
        total_pages: getAll ? 1 : Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    console.error('Error details:', {
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint
    })
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? {
        message: e?.message,
        code: e?.code,
        details: e?.details
      } : undefined
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