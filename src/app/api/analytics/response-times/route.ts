import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin dashboard to bypass RLS and get accurate data
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

type IncidentRow = {
  id: string
  created_at: string
  assigned_at: string | null
  resolved_at: string | null
}

type UpdateRow = {
  incident_id: string
  new_status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED'
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10)))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Load incidents in window
    // Use admin client to bypass RLS for accurate admin dashboard data
    // Handle pagination to ensure we get all incidents
    let allIncidents: IncidentRow[] = []
    let page = 0
    const pageSize = 1000
    
    while (true) {
      const { data, error: incErr } = await supabaseAdmin
        .from('incidents')
        .select('id, created_at, assigned_at, resolved_at')
        .gte('created_at', since)
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (incErr) throw incErr
      if (!data || data.length === 0) break
      
      allIncidents = allIncidents.concat(data as IncidentRow[])
      if (data.length < pageSize) break
      page++
    }

    // Load updates for ASSIGNED/RESPONDING in window
    // Handle pagination for updates as well
    let allUpdates: UpdateRow[] = []
    page = 0
    
    while (true) {
      const { data, error: updErr } = await supabaseAdmin
        .from('incident_updates')
        .select('incident_id, new_status, created_at')
        .in('new_status', ['ASSIGNED', 'RESPONDING'] as any)
        .gte('created_at', since)
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (updErr) throw updErr
      if (!data || data.length === 0) break
      
      allUpdates = allUpdates.concat(data as UpdateRow[])
      if (data.length < pageSize) break
      page++
    }
    
    const incidents = allIncidents
    const updates = allUpdates

    const byIncident: Record<string, { firstAssigned?: string; firstResponding?: string }> = {}
    updates.forEach(u => {
      const b = byIncident[u.incident_id] || (byIncident[u.incident_id] = {})
      if (u.new_status === 'ASSIGNED' && !b.firstAssigned) b.firstAssigned = u.created_at
      if (u.new_status === 'RESPONDING' && !b.firstResponding) b.firstResponding = u.created_at
    })

    const assignDurations: number[] = []
    const respondDurations: number[] = []
    const resolveDurations: number[] = []

    incidents.forEach(inc => {
      const base = new Date(inc.created_at).getTime()
      const baseDate = new Date(inc.created_at)
      
      // Validate base date
      if (isNaN(base)) return
      
      const b = byIncident[inc.id]
      const assignedAt = b?.firstAssigned || inc.assigned_at || null
      const respondingAt = b?.firstResponding || null
      const resolvedAt = inc.resolved_at || null
      
      // FIXED: Calculate assignment time with full validation
      if (assignedAt) {
        const assignedDate = new Date(assignedAt)
        // Validate: assigned date should be after creation date
        if (!isNaN(assignedDate.getTime()) && assignedDate >= baseDate) {
          const timeDiff = (assignedDate.getTime() - base) / 60000 // minutes
          if (timeDiff >= 0) {
            assignDurations.push(timeDiff)
          }
        }
      }
      
      // FIXED: Calculate responding time with full validation
      // Responding should be after creation, and ideally after assignment
      if (respondingAt) {
        const respondingDate = new Date(respondingAt)
        // Validate: responding date should be after creation date
        // Also validate against assigned date if it exists
        const isValid = !isNaN(respondingDate.getTime()) && 
                       respondingDate >= baseDate &&
                       (!assignedAt || respondingDate >= new Date(assignedAt))
        if (isValid) {
          const timeDiff = (respondingDate.getTime() - base) / 60000 // minutes
          if (timeDiff >= 0) {
            respondDurations.push(timeDiff)
          }
        }
      }
      
      // FIXED: Calculate resolution time with full validation
      // Resolved should be after creation, and ideally after assignment
      if (resolvedAt) {
        const resolvedDate = new Date(resolvedAt)
        // Validate: resolved date should be after creation date
        // Also validate against assigned date if it exists (resolved should be after assigned)
        const isValid = !isNaN(resolvedDate.getTime()) && 
                       resolvedDate >= baseDate &&
                       (!assignedAt || resolvedDate >= new Date(assignedAt))
        if (isValid) {
          const timeDiff = (resolvedDate.getTime() - base) / 60000 // minutes
          if (timeDiff >= 0) {
            resolveDurations.push(timeDiff)
          }
        }
      }
    })

    // Calculate averages with proper rounding
    const avg = (arr: number[]) => {
      if (arr.length === 0) return null
      const sum = arr.reduce((a, b) => a + b, 0)
      const average = sum / arr.length
      // Round to 2 decimal places for display
      return Math.round(average * 100) / 100
    }
    
    const result = {
      days,
      count: incidents?.length || 0,
      avg_minutes_to_assign: avg(assignDurations),
      avg_minutes_to_respond: avg(respondDurations),
      avg_minutes_to_resolve: avg(resolveDurations),
      // Add counts for transparency
      assignment_count: assignDurations.length,
      responding_count: respondDurations.length,
      resolution_count: resolveDurations.length,
    }

    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to compute response times' }, { status: 500 })
  }
}






