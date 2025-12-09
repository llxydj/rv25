import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const barangay = searchParams.get('barangay') || undefined

    // Build base query - get all incidents reported by residents
    let query = supabaseAdmin
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id,
          first_name,
          last_name,
          role,
          barangay
        )
      `)

    // Filter by reporter role = resident
    // We need to join with users table to filter by role
    // Since we can't directly filter on joined table in Supabase, we'll fetch and filter
    
    // Apply date filters
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (barangay) {
      query = query.ilike('barangay', `%${barangay}%`)
    }

    const { data: allIncidents, error } = await query.order('created_at', { ascending: false })

    if (error) {
      // SECURITY FIX: Sanitize error messages in production
      const isProduction = process.env.NODE_ENV === 'production'
      console.error('Error fetching incidents:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch incidents', 
          error: isProduction ? undefined : error.message 
        },
        { status: 500 }
      )
    }

    // Filter to only incidents reported by residents
    const residentIncidents = (allIncidents || []).filter(
      (incident: any) => incident.reporter?.role === 'resident'
    )

    // Calculate total metrics
    const totalIncidents = residentIncidents.length
    const totalEmergency = residentIncidents.filter((i: any) => 
      i.priority === 1 || i.incident_type?.toUpperCase().includes('EMERGENCY')
    ).length
    const totalNonEmergency = totalIncidents - totalEmergency

    // Group by barangay
    const barangayStats: Record<string, {
      total: number
      emergency: number
      nonEmergency: number
      byType: Record<string, number>
      byStatus: Record<string, number>
      bySeverity: Record<string, number>
      avgResponseTime: number | null
      resolved: number
      pending: number
    }> = {}

    residentIncidents.forEach((incident: any) => {
      const brgy = incident.barangay || 'UNKNOWN'
      if (!barangayStats[brgy]) {
        barangayStats[brgy] = {
          total: 0,
          emergency: 0,
          nonEmergency: 0,
          byType: {},
          byStatus: {},
          bySeverity: {},
          avgResponseTime: null,
          resolved: 0,
          pending: 0
        }
      }

      barangayStats[brgy].total++
      
      // Emergency vs Non-emergency
      const isEmergency = incident.priority === 1 || incident.incident_type?.toUpperCase().includes('EMERGENCY')
      if (isEmergency) {
        barangayStats[brgy].emergency++
      } else {
        barangayStats[brgy].nonEmergency++
      }

      // By type
      const type = incident.incident_type || 'Unknown'
      barangayStats[brgy].byType[type] = (barangayStats[brgy].byType[type] || 0) + 1

      // By status
      const status = incident.status || 'PENDING'
      barangayStats[brgy].byStatus[status] = (barangayStats[brgy].byStatus[status] || 0) + 1
      if (status === 'RESOLVED') {
        barangayStats[brgy].resolved++
      } else if (status === 'PENDING') {
        barangayStats[brgy].pending++
      }

      // By severity
      const severity = incident.severity || 'MODERATE'
      barangayStats[brgy].bySeverity[severity] = (barangayStats[brgy].bySeverity[severity] || 0) + 1
    })

    // Calculate response times per barangay
    Object.keys(barangayStats).forEach(brgy => {
      const brgyIncidents = residentIncidents.filter((i: any) => (i.barangay || 'UNKNOWN') === brgy)
      // FIXED: Calculate response times with proper date validation to prevent negative times
      const responseTimes = brgyIncidents
        .filter((i: any) => i.assigned_at && i.resolved_at)
        .map((i: any) => {
          const assigned = new Date(i.assigned_at)
          const resolved = new Date(i.resolved_at)
          // Validate dates and ensure resolved >= assigned
          if (!isNaN(assigned.getTime()) && !isNaN(resolved.getTime()) && resolved >= assigned) {
            const timeDiff = (resolved.getTime() - assigned.getTime()) / (1000 * 60) // minutes
            return timeDiff >= 0 ? timeDiff : null
          }
          return null
        })
        .filter((t: number | null): t is number => t !== null && !isNaN(t) && t > 0)

      if (responseTimes.length > 0) {
        barangayStats[brgy].avgResponseTime = Math.round(
          responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
        )
      }
    })

    // Convert to array and sort by total incidents
    const barangayArray = Object.entries(barangayStats)
      .map(([barangay, stats]) => ({
        barangay,
        ...stats,
        resolutionRate: stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.total - a.total)

    // Calculate trends (daily, weekly, monthly)
    const dailyTrends: Record<string, number> = {}
    const weeklyTrends: Record<string, number> = {}
    const monthlyTrends: Record<string, number> = {}

    residentIncidents.forEach((incident: any) => {
      const date = new Date(incident.created_at)
      
      // Daily
      const dayKey = date.toISOString().split('T')[0]
      dailyTrends[dayKey] = (dailyTrends[dayKey] || 0) + 1

      // Weekly
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      weeklyTrends[weekKey] = (weeklyTrends[weekKey] || 0) + 1

      // Monthly
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyTrends[monthKey] = (monthlyTrends[monthKey] || 0) + 1
    })

    // Overall statistics
    const overallStats = {
      totalIncidents,
      totalEmergency,
      totalNonEmergency,
      totalResolved: residentIncidents.filter((i: any) => i.status === 'RESOLVED').length,
      totalPending: residentIncidents.filter((i: any) => i.status === 'PENDING').length,
      totalAssigned: residentIncidents.filter((i: any) => i.status === 'ASSIGNED').length,
      totalResponding: residentIncidents.filter((i: any) => i.status === 'RESPONDING').length,
      avgResponseTime: (() => {
        // FIXED: Calculate with proper date validation to prevent negative times
        const times = residentIncidents
          .filter((i: any) => i.assigned_at && i.resolved_at)
          .map((i: any) => {
            const assigned = new Date(i.assigned_at)
            const resolved = new Date(i.resolved_at)
            // Validate dates and ensure resolved >= assigned
            if (!isNaN(assigned.getTime()) && !isNaN(resolved.getTime()) && resolved >= assigned) {
              const timeDiff = (resolved.getTime() - assigned.getTime()) / (1000 * 60)
              return timeDiff >= 0 ? timeDiff : null
            }
            return null
          })
          .filter((t: number | null): t is number => t !== null && !isNaN(t) && t > 0)
        return times.length > 0
          ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length)
          : null
      })(),
      byType: (() => {
        const types: Record<string, number> = {}
        residentIncidents.forEach((i: any) => {
          const type = i.incident_type || 'Unknown'
          types[type] = (types[type] || 0) + 1
        })
        return types
      })(),
      byStatus: (() => {
        const statuses: Record<string, number> = {}
        residentIncidents.forEach((i: any) => {
          const status = i.status || 'PENDING'
          statuses[status] = (statuses[status] || 0) + 1
        })
        return statuses
      })(),
      bySeverity: (() => {
        const severities: Record<string, number> = {}
        residentIncidents.forEach((i: any) => {
          const severity = i.severity || 'MODERATE'
          severities[severity] = (severities[severity] || 0) + 1
        })
        return severities
      })()
    }

    return NextResponse.json({
      success: true,
      data: {
        overall: overallStats,
        byBarangay: barangayArray,
        trends: {
          daily: Object.entries(dailyTrends)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          weekly: Object.entries(weeklyTrends)
            .map(([week, count]) => ({ week, count }))
            .sort((a, b) => a.week.localeCompare(b.week)),
          monthly: Object.entries(monthlyTrends)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month))
        },
        summary: {
          totalBarangays: barangayArray.length,
          topBarangay: barangayArray[0]?.barangay || null,
          topBarangayCount: barangayArray[0]?.total || 0,
          dateRange: {
            start: startDate || null,
            end: endDate || null
          }
        }
      }
    })
  } catch (error: any) {
    // SECURITY FIX: Sanitize error messages in production
    const isProduction = process.env.NODE_ENV === 'production'
    console.error('Error in resident incidents analytics:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to generate analytics', 
        error: isProduction ? undefined : error.message 
      },
      { status: 500 }
    )
  }
}

