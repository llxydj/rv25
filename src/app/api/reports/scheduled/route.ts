import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Get all scheduled reports
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

    // Get scheduled reports - users see their own, admins see all
    const query = supabase
      .from('scheduled_pdf_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (userData?.role !== 'admin') {
      query.eq('created_by', user.id)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('Error fetching scheduled reports:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch scheduled reports' },
      { status: 500 }
    )
  }
}

// Create a new scheduled report
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
    const { report_type, title, schedule_type, schedule_config, filters, recipients = [] } = body

    if (!report_type || !title || !schedule_type || !schedule_config || !filters) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate next_run_at based on schedule_type
    const nextRunAt = calculateNextRun(schedule_type, schedule_config)

    const { data, error } = await supabase
      .from('scheduled_pdf_reports')
      .insert({
        created_by: user.id,
        report_type,
        title,
        schedule_type,
        schedule_config,
        filters,
        recipients,
        next_run_at: nextRunAt,
        enabled: true
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
    console.error('Error creating scheduled report:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create scheduled report' },
      { status: 500 }
    )
  }
}

// Update scheduled report
export async function PUT(request: NextRequest) {
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
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Report ID is required' },
        { status: 400 }
      )
    }

    // Recalculate next_run_at if schedule changed
    if (updates.schedule_type || updates.schedule_config) {
      updates.next_run_at = calculateNextRun(
        updates.schedule_type || body.schedule_type,
        updates.schedule_config || body.schedule_config
      )
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('scheduled_pdf_reports')
      .update(updates)
      .eq('id', id)
      .eq('created_by', user.id) // Only allow updating own reports
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
    console.error('Error updating scheduled report:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update scheduled report' },
      { status: 500 }
    )
  }
}

// Delete scheduled report
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Report ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('scheduled_pdf_reports')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id) // Only allow deleting own reports

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting scheduled report:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete scheduled report' },
      { status: 500 }
    )
  }
}

// Helper function to calculate next run time
function calculateNextRun(scheduleType: string, config: any): string {
  const now = new Date()
  const nextRun = new Date()

  switch (scheduleType) {
    case 'daily':
      nextRun.setHours(config.time?.split(':')[0] || 9, config.time?.split(':')[1] || 0, 0, 0)
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'weekly':
      const dayOfWeek = config.day_of_week || 1 // Monday = 1
      const currentDay = now.getDay() === 0 ? 7 : now.getDay()
      const daysUntilNext = (dayOfWeek - currentDay + 7) % 7 || 7
      nextRun.setDate(now.getDate() + daysUntilNext)
      nextRun.setHours(config.time?.split(':')[0] || 9, config.time?.split(':')[1] || 0, 0, 0)
      break

    case 'monthly':
      const dayOfMonth = config.day_of_month || 1
      nextRun.setDate(dayOfMonth)
      nextRun.setHours(config.time?.split(':')[0] || 9, config.time?.split(':')[1] || 0, 0, 0)
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1)
      }
      break

    case 'custom':
      // For custom, use the provided next_run_at or default to tomorrow
      if (config.next_run_at) {
        return new Date(config.next_run_at).toISOString()
      }
      nextRun.setDate(now.getDate() + 1)
      break

    default:
      nextRun.setDate(now.getDate() + 1)
  }

  return nextRun.toISOString()
}

