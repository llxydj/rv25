import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

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

// Create audit log
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { action, details, user_id } = await request.json()

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Insert audit log
    const { error: insertError } = await supabaseAdmin
      .from('system_logs')
      .insert({
        action,
        details,
        user_id: user_id || uid
      })
    
    if (insertError) throw insertError
    
    return NextResponse.json({ 
      success: true, 
      message: 'Audit log created successfully' 
    })
  } catch (e: any) {
    console.error('Error creating audit log:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to create audit log' 
    }, { status: 500 })
  }
}

// Get audit logs
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Get audit logs
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (logsError) throw logsError
    
    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from('system_logs')
      .select('*', { count: 'exact', head: true })
    
    if (countError) throw countError
    
    return NextResponse.json({ 
      success: true, 
      data: logs,
      total: count
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