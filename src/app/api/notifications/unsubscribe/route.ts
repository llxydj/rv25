import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user_id, endpoint } = await request.json()

    if (!user_id || !endpoint) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: 'user_id and endpoint required' },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()

    // Must be authenticated user
    if (!me?.user?.id || me.user.id !== user_id) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Delete subscription matching this endpoint
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: e.message || 'Failed to unsubscribe' },
      { status: 500 }
    )
  }
}
