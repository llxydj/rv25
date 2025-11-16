import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a server client with timeout configuration
const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (input, init) => {
          // Set a reasonable timeout (30 seconds)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)
          
          return fetch(input, {
            ...init,
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId))
        }
      }
    }
  )
}

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
    // Use server client instead of browser client
    const supabase = createServerClient()
    
    const { searchParams } = new URL(request.url)
    const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10)))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Load incidents in window
    const { data: incidents, error: incErr } = await supabase
      .from('incidents')
      .select('id, created_at, assigned_at, resolved_at')
      .gte('created_at', since)

    if (incErr) throw incErr

    // Load updates for ASSIGNED/RESPONDING in window
    const { data: updates, error: updErr } = await supabase
      .from('incident_updates')
      .select('incident_id, new_status, created_at')
      .in('new_status', ['ASSIGNED', 'RESPONDING'] as any)
      .gte('created_at', since)

    if (updErr) throw updErr

    const byIncident: Record<string, { firstAssigned?: string; firstResponding?: string }> = {}
    ;(updates as UpdateRow[] | null || []).forEach(u => {
      const b = byIncident[u.incident_id] || (byIncident[u.incident_id] = {})
      if (u.new_status === 'ASSIGNED' && !b.firstAssigned) b.firstAssigned = u.created_at
      if (u.new_status === 'RESPONDING' && !b.firstResponding) b.firstResponding = u.created_at
    })

    const assignDurations: number[] = []
    const respondDurations: number[] = []
    const resolveDurations: number[] = []

    ;(incidents as IncidentRow[] | null || []).forEach(inc => {
      const base = new Date(inc.created_at).getTime()
      const b = byIncident[inc.id]
      const assignedAt = b?.firstAssigned || inc.assigned_at || null
      if (assignedAt) assignDurations.push((new Date(assignedAt).getTime() - base) / 60000)
      const respondingAt = b?.firstResponding || null
      if (respondingAt) respondDurations.push((new Date(respondingAt).getTime() - base) / 60000)
      if (inc.resolved_at) resolveDurations.push((new Date(inc.resolved_at).getTime() - base) / 60000)
    })

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
    const result = {
      days,
      count: incidents?.length || 0,
      avg_minutes_to_assign: avg(assignDurations),
      avg_minutes_to_respond: avg(respondDurations),
      avg_minutes_to_resolve: avg(resolveDurations),
    }

    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to compute response times' }, { status: 500 })
  }
}