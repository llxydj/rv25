// src/app/api/admin/users/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// ✅ ADMIN CLIENT - Use ONLY for admin operations with SERVICE_ROLE key
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

// ✅ Create auth client with proper cookie handling
async function getAuthClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Cookie setting may fail in route handlers, ignore
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Cookie removal may fail, ignore
          }
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000')
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true'

    // ✅ CRITICAL FIX: Always await getAuthClient()
    const supabase = await getAuthClient()

    // ✅ CRITICAL FIX: Use getUser() instead of getSession()
    // getUser() validates the JWT token server-side every time
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    console.log('Auth check:', { 
      hasUser: !!authUser, 
      userId: authUser?.id,
      authError: authError?.message 
    })

    if (authError || !authUser) {
      console.error('Authentication failed:', authError)
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated. Please log in again.' 
      }, { status: 401 })
    }

    // ✅ Use admin client to check role (avoids RLS issues)
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle()

    console.log('Role check:', { 
      roleRow, 
      roleError: roleError?.message 
    })

    if (roleError) {
      console.error('Role fetch error:', roleError)
      return NextResponse.json({ 
        success: false, 
        code: 'ROLE_FETCH_ERROR',
        message: 'Failed to fetch user role' 
      }, { status: 500 })
    }

    if (!roleRow || roleRow.role !== 'admin') {
      console.error('User is not admin:', { role: roleRow?.role })
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    // ✅ Build query with filters using admin client
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }

    if (searchTerm) {
      query = query.or(
        `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
      )
    }

    // Apply pagination
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }

    query = query.order('created_at', { ascending: false })
    const { data: users, error: usersError, count } = await query

    if (usersError) {
      console.error('Error fetching users from database:', usersError)
      throw usersError
    }

    const usersArray = users || []
    console.log(`Fetched ${usersArray.length} users from database`)

    // Fetch incident counts
    const userIds = usersArray.map((u: any) => u.id)
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

    const usersWithIncidentData = usersArray.map((user: any) => ({
      ...user,
      incident_count: userIncidentCounts[user.id] || 0,
      status: user.status || 'active'
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

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getAuthClient()
    const body = await request.json()
    const { userId, action } = body

    // ✅ CRITICAL FIX: Use getUser() instead of getSession()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated' 
      }, { status: 401 })
    }

    const { data: roleRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

    if (action === 'deactivate') {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)

      if (error) throw error

      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${authUser.id}`,
        user_id: authUser.id
      })

      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } 
    else if (action === 'activate') {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)

      if (error) throw error

      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${authUser.id}`,
        user_id: authUser.id
      })

      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } 
    else {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid action' 
      }, { status: 400 })
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getAuthClient()
    const body = await request.json()
    const { userId } = body

    // ✅ CRITICAL FIX: Use getUser() instead of getSession()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ 
        success: false, 
        code: 'NOT_AUTHENTICATED',
        message: 'User not authenticated' 
      }, { status: 401 })
    }

    const { data: roleRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN',
        message: 'Admin access required' 
      }, { status: 403 })
    }

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

    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${authUser.id}`,
      user_id: authUser.id
    })

    return NextResponse.json({ 
      success: true, 
      message: 'User deactivated and data anonymized successfully' 
    })

  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}