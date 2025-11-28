import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Get report history
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get report history - users see their own, admins see all
    const query = supabase
      .from('pdf_report_history')
      .select('*')
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (userData?.role !== 'admin') {
      query.eq('created_by', user.id)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })
  } catch (error: any) {
    console.error('Error fetching report history:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch report history' },
      { status: 500 }
    )
  }
}

// Save report to history (called after PDF generation)
export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      scheduled_report_id, 
      report_type, 
      title, 
      file_name, 
      file_url, 
      file_size, 
      filters,
      expires_at 
    } = body

    if (!report_type || !title || !file_name || !file_url || !filters) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('pdf_report_history')
      .insert({
        scheduled_report_id: scheduled_report_id || null,
        created_by: user.id,
        report_type,
        title,
        file_name,
        file_url,
        file_size: file_size || null,
        filters,
        expires_at: expires_at || null
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: any) {
    console.error('Error saving report to history:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save report to history' },
      { status: 500 }
    )
  }
}

// Increment download count
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Report ID is required' },
        { status: 400 }
      )
    }

    // Increment download count
    const { data, error } = await supabase.rpc('increment_report_download', { report_id: id })

    if (error) {
      // If RPC doesn't exist, do manual update
      const { data: report } = await supabase
        .from('pdf_report_history')
        .select('download_count')
        .eq('id', id)
        .single()

      const { error: updateError } = await supabase
        .from('pdf_report_history')
        .update({ download_count: (report?.download_count || 0) + 1 })
        .eq('id', id)

      if (updateError) {
        throw updateError
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Download count updated'
    })
  } catch (error: any) {
    console.error('Error updating download count:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update download count' },
      { status: 500 }
    )
  }
}

