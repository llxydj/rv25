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

// Automated archiving - run by cron job or manually
export async function POST(request: Request) {
  try {
    // Allow internal requests or authenticated admin requests
    const authHeader = request.headers.get('authorization')
    const isInternalRequest = authHeader === `Bearer ${process.env.CRON_AUTH_TOKEN}`
    
    // If not internal, verify requester is admin
    if (!isInternalRequest) {
      const supabase = await getServerSupabase()
      const { data: me } = await supabase.auth.getUser()
      const uid = me?.user?.id
      if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
      
      const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
      if (!roleRow || roleRow.role !== 'admin') {
        return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
      }
    }

    const { yearsToArchive } = await request.json()
    
    // If no specific years provided, archive previous years automatically
    let targetYears: number[] = []
    
    if (yearsToArchive && Array.isArray(yearsToArchive) && yearsToArchive.length > 0) {
      targetYears = yearsToArchive.map(y => parseInt(y)).filter(y => !isNaN(y))
    } else {
      // Get schedule configuration
      const { data: scheduleConfig, error: configError } = await supabaseAdmin
        .from('auto_archive_schedule')
        .select('*')
        .limit(1)
        .single()
      
      // If config table doesn't exist, continue with defaults
      if (configError && (configError.code === '42P01' || configError.message.includes('does not exist'))) {
        console.warn('Auto-archive schedule table not found, using defaults')
      }
      
      // Use configured years old setting or default to 2
      const yearsOld = (scheduleConfig && !configError) ? scheduleConfig?.years_old : 2
      
      // Automatically archive years that are specified years old
      const currentYear = new Date().getFullYear()
      const cutoffYear = currentYear - yearsOld
      
      // Get all years with incident data
      const { data: yearsData, error: yearsError } = await supabaseAdmin
        .from('incidents')
        .select('created_at')
        .order('created_at', { ascending: true })
      
      if (yearsError) throw yearsError
      
      // Extract unique years that are older than cutoff
      const allYears = Array.from(
        new Set((yearsData as any[]).map(incident => new Date(incident.created_at).getFullYear()))
      ) as number[]
      
      targetYears = allYears.filter((year: number) => year <= cutoffYear)
    }
    
    if (targetYears.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No years to archive',
        archivedYears: []
      })
    }
    
    const archivedYears: number[] = []
    const errors: string[] = []
    
    // Archive each year
    for (const yearNum of targetYears) {
      try {
        const startDate = new Date(yearNum, 0, 1).toISOString()
        const endDate = new Date(yearNum + 1, 0, 1).toISOString()
        
        // Check if already archived
        const { data: existingArchived } = await supabaseAdmin
          .from('reports')
          .select('id')
          .gte('created_at', startDate)
          .lt('created_at', endDate)
          .eq('archived', true)
          .limit(1)
        
        if (existingArchived && existingArchived.length > 0) {
          console.log(`Reports for ${yearNum} are already archived`)
          continue
        }
        
        // Archive reports for the year
        const { error: updateError } = await supabaseAdmin
          .from('reports')
          .update({ archived: true })
          .gte('created_at', startDate)
          .lt('created_at', endDate)
        
        if (updateError) throw updateError
        
        // Log the action
        const userId = isInternalRequest ? 'system' : 'admin'
        await supabaseAdmin.from('system_logs').insert({
          action: 'REPORTS_AUTO_ARCHIVED',
          details: `Reports for year ${yearNum} auto-archived by ${userId}`,
          user_id: userId
        })
        
        archivedYears.push(yearNum)
        console.log(`Successfully archived reports for ${yearNum}`)
      } catch (yearError: any) {
        console.error(`Error archiving reports for ${yearNum}:`, yearError)
        errors.push(`Failed to archive ${yearNum}: ${yearError.message}`)
      }
    }
    
    // Update schedule with last run time
    if (isInternalRequest) {
      try {
        const nextRun = new Date()
        nextRun.setDate(nextRun.getDate() + 1) // Next day
        
        const { error: updateError } = await supabaseAdmin
          .from('auto_archive_schedule')
          .update({ 
            last_run: new Date().toISOString(),
            next_run: nextRun.toISOString()
          })
          .neq('id', '00000000-0000-0000-0000-000000000000') // Update any record
        
        if (updateError && !(updateError.code === '42P01' || updateError.message.includes('does not exist'))) {
          console.error('Error updating auto-archive schedule:', updateError)
        }
      } catch (scheduleError) {
        console.error('Error updating schedule:', scheduleError)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Auto-archiving completed. Archived ${archivedYears.length} years.`,
      archivedYears,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (e: any) {
    console.error('Error in auto-archiving:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to auto-archive reports' 
    }, { status: 500 })
  }
}

// Get auto-archive configuration
export async function GET() {
  try {
    // Get current configuration
    const { data: scheduleConfig, error } = await supabaseAdmin
      .from('auto_archive_schedule')
      .select('*')
      .limit(1)
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ 
      success: true, 
      data: scheduleConfig
    })
  } catch (e: any) {
    console.error('Error fetching auto-archive config:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch auto-archive configuration' 
    }, { status: 500 })
  }
}

// Update auto-archive configuration
export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    
    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }
    
    const body = await request.json()
    
    // Update the schedule configuration
    const { data: updatedConfig, error } = await supabaseAdmin
      .from('auto_archive_schedule')
      .update(body)
      .neq('id', '00000000-0000-0000-0000-000000000000') // Update any record
      .select()
      .single()
    
    if (error) throw error
    
    // Calculate next run time if enabled
    if (updatedConfig.enabled) {
      const nextRun = new Date()
      if (updatedConfig.schedule_frequency === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1)
      } else if (updatedConfig.schedule_frequency === 'weekly') {
        nextRun.setDate(nextRun.getDate() + 7)
      } else if (updatedConfig.schedule_frequency === 'monthly') {
        nextRun.setMonth(nextRun.getMonth() + 1)
      }
      
      // Set the time
      const [hours, minutes] = updatedConfig.schedule_time.split(':')
      nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      
      await supabaseAdmin
        .from('auto_archive_schedule')
        .update({ next_run: nextRun.toISOString() })
        .eq('id', updatedConfig.id)
    }
    
    return NextResponse.json({ 
      success: true, 
      data: updatedConfig
    })
  } catch (e: any) {
    console.error('Error updating auto-archive config:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update auto-archive configuration' 
    }, { status: 500 })
  }
}