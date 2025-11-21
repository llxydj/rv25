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

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Fetch audit logs related to user management using service role (bypasses RLS)
    const { data, error, count } = await supabaseAdmin
      .from("system_logs")
      .select("*", { count: "exact" })
      .or("action.eq.USER_DEACTIVATED,action.eq.USER_ACTIVATED,action.eq.USER_SOFT_DELETED")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error

    // Get user emails for display
    const userIds = Array.from(new Set(data.map((log: any) => log.user_id)))
    const userEmails: Record<string, string> = {}
    
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, email")
        .in("id", userIds)
      
      if (!usersError && usersData) {
        usersData.forEach((user: any) => {
          userEmails[user.id] = user.email
        })
      }
    }

    // Merge user emails with audit logs
    const logsWithEmails = data.map((log: any) => ({
      ...log,
      user_email: userEmails[log.user_id] || "Unknown User"
    }))

    return NextResponse.json({
      success: true,
      data: logsWithEmails,
      meta: {
        total_count: count || 0,
        current_page: page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching audit logs:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch audit logs' 
    }, { status: 500 })
  }
}

