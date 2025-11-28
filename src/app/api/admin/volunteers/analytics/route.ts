// src/app/api/admin/volunteers/analytics/route.ts

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Generate insights and patterns from volunteer data
function generateInsights(analytics: any) {
  const insights: string[] = []
  const recommendations: string[] = []
  const patterns: any = {}
  const performanceScore = calculatePerformanceScore(analytics)

  // Incident Performance Analysis
  if (analytics.incidents.total > 0) {
    const resolutionRate = parseFloat(analytics.incidents.resolution_rate || '0')
    
    if (resolutionRate >= 90) {
      insights.push(`Excellent resolution rate: ${resolutionRate}% - This volunteer consistently resolves incidents effectively`)
      patterns.excellent_resolution = true
    } else if (resolutionRate >= 70) {
      insights.push(`Good resolution rate: ${resolutionRate}% - Above average performance`)
      patterns.good_resolution = true
    } else if (resolutionRate < 50) {
      insights.push(`Low resolution rate: ${resolutionRate}% - Needs improvement in incident resolution`)
      recommendations.push('Provide additional training on incident resolution protocols')
      patterns.low_resolution = true
    }

    // Response Time Analysis
    if (analytics.incidents.response_time?.average) {
      const avgResponse = analytics.incidents.response_time.average
      if (avgResponse <= 30) {
        insights.push(`Fast response time: ${avgResponse} minutes average - Excellent responsiveness`)
        patterns.fast_response = true
      } else if (avgResponse > 60) {
        insights.push(`Slow response time: ${avgResponse} minutes average - Consider optimizing response protocols`)
        recommendations.push('Review and optimize incident response workflow to reduce time')
        patterns.slow_response = true
      }
    }

    // Incident Type Patterns
    if (analytics.incidents.by_type && Object.keys(analytics.incidents.by_type).length > 0) {
      const typeEntries = Object.entries(analytics.incidents.by_type)
      const dominantType = typeEntries.sort(([, a]: any, [, b]: any) => b - a)[0]
      if (dominantType) {
        insights.push(`Primary incident type: ${dominantType[0]} (${dominantType[1]} cases) - Specialized expertise area`)
        patterns.dominant_type = dominantType[0]
      }
    }

    // Geographic Patterns
    if (analytics.incidents.by_barangay && Object.keys(analytics.incidents.by_barangay).length > 0) {
      const barangayEntries = Object.entries(analytics.incidents.by_barangay)
      const topBarangay = barangayEntries.sort(([, a]: any, [, b]: any) => b - a)[0]
      if (topBarangay) {
        insights.push(`Most active area: ${topBarangay[0]} with ${topBarangay[1]} incidents - Geographic specialization`)
        patterns.top_barangay = topBarangay[0]
      }
    }

    // Trend Analysis
    if (analytics.incidents.daily_trend && analytics.incidents.daily_trend.length > 1) {
      const recent = analytics.incidents.daily_trend.slice(-7)
      const earlier = analytics.incidents.daily_trend.slice(0, 7)
      const recentAvg = recent.reduce((sum: number, d: any) => sum + d.count, 0) / recent.length
      const earlierAvg = earlier.reduce((sum: number, d: any) => sum + d.count, 0) / earlier.length
      
      if (recentAvg > earlierAvg * 1.2) {
        insights.push('Increasing activity trend: Recent week shows 20%+ increase in incident handling')
        patterns.increasing_trend = true
        recommendations.push('Consider increasing support resources as activity is rising')
      } else if (recentAvg < earlierAvg * 0.8) {
        insights.push('Decreasing activity trend: Recent week shows decline in incident handling')
        patterns.decreasing_trend = true
      }
    }
  }

  // Schedule Performance Analysis
  if (analytics.schedules.total > 0) {
    const acceptanceRate = parseFloat(analytics.schedules.acceptance_rate || '0')
    const attendanceRate = parseFloat(analytics.schedules.attendance_rate || '0')

    if (acceptanceRate >= 80) {
      insights.push(`High schedule acceptance: ${acceptanceRate}% - Excellent commitment to scheduled activities`)
      patterns.high_acceptance = true
    } else if (acceptanceRate < 50) {
      insights.push(`Low schedule acceptance: ${acceptanceRate}% - May indicate availability or engagement issues`)
      recommendations.push('Discuss schedule preferences and availability with volunteer')
      patterns.low_acceptance = true
    }

    if (attendanceRate >= 90) {
      insights.push(`Excellent attendance: ${attendanceRate}% - Highly reliable volunteer`)
      patterns.excellent_attendance = true
    } else if (attendanceRate < 70 && acceptanceRate > 0) {
      insights.push(`Attendance concerns: ${attendanceRate}% attendance rate - Review attendance patterns`)
      recommendations.push('Address attendance issues to improve reliability')
      patterns.attendance_concern = true
    }
  }

  // Training Performance Analysis
  if (analytics.trainings.total > 0) {
    const avgRating = parseFloat(analytics.trainings.avg_performance_rating || '0')
    if (avgRating >= 4.5) {
      insights.push(`Outstanding training performance: ${avgRating}/5.0 - Exceptional skills and knowledge`)
      patterns.excellent_training = true
    } else if (avgRating < 3.0 && avgRating > 0) {
      insights.push(`Training improvement needed: ${avgRating}/5.0 - Additional training recommended`)
      recommendations.push('Provide additional training and skill development opportunities')
      patterns.training_improvement = true
    }
  }

  // Overall Performance Assessment
  if (performanceScore >= 85) {
    insights.push(`Overall Performance: Excellent (${performanceScore}/100) - Top performer`)
    recommendations.push('Consider this volunteer for leadership roles or advanced assignments')
  } else if (performanceScore >= 70) {
    insights.push(`Overall Performance: Good (${performanceScore}/100) - Solid contributor`)
  } else if (performanceScore < 60) {
    insights.push(`Overall Performance: Needs Improvement (${performanceScore}/100) - Development plan recommended`)
    recommendations.push('Create a performance improvement plan with specific goals and timelines')
  }

  return {
    insights,
    recommendations,
    patterns,
    performance_score: performanceScore,
    performance_level: performanceScore >= 85 ? 'Excellent' : performanceScore >= 70 ? 'Good' : performanceScore >= 60 ? 'Average' : 'Needs Improvement'
  }
}

// Calculate overall performance score (0-100)
function calculatePerformanceScore(analytics: any): number {
  let score = 0
  let factors = 0

  // Resolution Rate (40 points)
  if (analytics.incidents.total > 0) {
    const resolutionRate = parseFloat(analytics.incidents.resolution_rate || '0')
    score += (resolutionRate / 100) * 40
    factors++
  }

  // Response Time (20 points)
  if (analytics.incidents.response_time?.average) {
    const avgResponse = analytics.incidents.response_time.average
    // 30 minutes = 20 points, 60 minutes = 10 points, 120+ minutes = 0 points
    const responseScore = Math.max(0, 20 - ((avgResponse - 30) / 30) * 10)
    score += responseScore
    factors++
  }

  // Schedule Acceptance (20 points)
  if (analytics.schedules.total > 0) {
    const acceptanceRate = parseFloat(analytics.schedules.acceptance_rate || '0')
    score += (acceptanceRate / 100) * 20
    factors++
  }

  // Attendance Rate (10 points)
  if (analytics.schedules.accepted > 0) {
    const attendanceRate = parseFloat(analytics.schedules.attendance_rate || '0')
    score += (attendanceRate / 100) * 10
    factors++
  }

  // Training Performance (10 points)
  if (analytics.trainings.evaluations > 0) {
    const avgRating = parseFloat(analytics.trainings.avg_performance_rating || '0')
    score += (avgRating / 5) * 10
    factors++
  }

  // Normalize if no factors
  if (factors === 0) return 0

  return Math.round(score)
}

// Get volunteer analytics including incidents, schedules, attendance, training performance
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const volunteerId = searchParams.get('volunteer_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!volunteerId) {
      return NextResponse.json({ success: false, message: 'volunteer_id is required' }, { status: 400 })
    }

    // Get volunteer incidents
    let incidentsQuery = supabaseAdmin
      .from('incidents')
      .select('id, incident_type, status, created_at, resolved_at, assigned_at, reference_id, priority, severity, barangay')
      .eq('assigned_to', volunteerId)
      .order('created_at', { ascending: false })

    if (startDate) incidentsQuery = incidentsQuery.gte('created_at', startDate)
    if (endDate) incidentsQuery = incidentsQuery.lte('created_at', endDate)

    const { data: incidents } = await incidentsQuery

    // Get schedules and attendance
    let schedulesQuery = supabaseAdmin
      .from('schedules')
      .select('id, title, start_time, end_time, is_accepted, attendance_marked, attendance_notes, status')
      .eq('volunteer_id', volunteerId)
      .order('start_time', { ascending: false })

    if (startDate) schedulesQuery = schedulesQuery.gte('start_time', startDate)
    if (endDate) schedulesQuery = schedulesQuery.lte('start_time', endDate)

    const { data: schedules } = await schedulesQuery

    // Get training enrollments and evaluations
    const { data: enrollments } = await supabaseAdmin
      .from('training_enrollments')
      .select(`
        *,
        training:trainings (
          id, title, start_at, end_at, status
        )
      `)
      .eq('user_id', volunteerId)

    const { data: evaluations } = await supabaseAdmin
      .from('training_evaluations_admin')
      .select(`
        *,
        training:trainings (
          id, title
        )
      `)
      .eq('user_id', volunteerId)

    // Calculate statistics
    const totalIncidents = incidents?.length || 0
    const resolvedIncidents = incidents?.filter((i: any) => i.status === 'RESOLVED').length || 0
    const pendingIncidents = incidents?.filter((i: any) => i.status === 'PENDING' || i.status === 'ASSIGNED').length || 0
    const respondingIncidents = incidents?.filter((i: any) => i.status === 'RESPONDING').length || 0
    
    // Calculate response times
    const responseTimes = incidents
      ?.filter((i: any) => i.assigned_at && i.resolved_at)
      .map((i: any) => {
        const assigned = new Date(i.assigned_at).getTime()
        const resolved = new Date(i.resolved_at).getTime()
        return Math.round((resolved - assigned) / (1000 * 60)) // minutes
      }) || []
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : null
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : null
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : null
    
    // Group by type
    const incidentsByType: Record<string, number> = {}
    incidents?.forEach((i: any) => {
      const type = i.incident_type || 'Unknown'
      incidentsByType[type] = (incidentsByType[type] || 0) + 1
    })
    
    // Group by severity
    const incidentsBySeverity: Record<string, number> = {}
    incidents?.forEach((i: any) => {
      const severity = i.severity || 'UNKNOWN'
      incidentsBySeverity[severity] = (incidentsBySeverity[severity] || 0) + 1
    })
    
    // Group by barangay
    const incidentsByBarangay: Record<string, number> = {}
    incidents?.forEach((i: any) => {
      const barangay = i.barangay || 'Unknown'
      incidentsByBarangay[barangay] = (incidentsByBarangay[barangay] || 0) + 1
    })
    
    // Daily trend (last 30 days)
    const dailyTrend: Record<string, number> = {}
    incidents?.forEach((i: any) => {
      const date = new Date(i.created_at).toISOString().split('T')[0]
      dailyTrend[date] = (dailyTrend[date] || 0) + 1
    })
    const dailyTrendData = Object.entries(dailyTrend)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Last 30 days

    // Weekly trend
    const weeklyTrend: Record<string, number> = {}
    incidents?.forEach((i: any) => {
      const date = new Date(i.created_at)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      weeklyTrend[weekKey] = (weeklyTrend[weekKey] || 0) + 1
    })
    const weeklyTrendData = Object.entries(weeklyTrend)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week))

    // Hourly pattern (when incidents are assigned)
    const hourlyPattern: Record<number, number> = {}
    incidents?.forEach((i: any) => {
      if (i.assigned_at) {
        const hour = new Date(i.assigned_at).getHours()
        hourlyPattern[hour] = (hourlyPattern[hour] || 0) + 1
      }
    })
    const hourlyPatternData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyPattern[i] || 0
    }))
    
    const totalSchedules = schedules?.length || 0
    const acceptedSchedules = schedules?.filter((s: any) => s.is_accepted === true).length || 0
    const attendanceMarked = schedules?.filter((s: any) => s.attendance_marked === true).length || 0
    const presentCount = schedules?.filter((s: any) => 
      s.attendance_marked && s.attendance_notes?.startsWith('PRESENT')
    ).length || 0
    const totalTrainings = enrollments?.length || 0
    const avgPerformanceRating = evaluations && evaluations.length > 0
      ? evaluations.reduce((sum: number, e: any) => sum + (e.performance_rating || 0), 0) / evaluations.length
      : 0

    const baseAnalytics = {
      volunteer_id: volunteerId,
      period: { start_date: startDate, end_date: endDate },
      incidents: {
        total: totalIncidents,
        resolved: resolvedIncidents,
        pending: pendingIncidents,
        responding: respondingIncidents,
        resolution_rate: totalIncidents > 0 ? ((resolvedIncidents / totalIncidents) * 100).toFixed(1) : '0.0',
        response_time: {
          average: avgResponseTime,
          min: minResponseTime,
          max: maxResponseTime,
          unit: 'minutes'
        },
        by_type: incidentsByType,
        by_severity: incidentsBySeverity,
        by_barangay: incidentsByBarangay,
        daily_trend: dailyTrendData,
        weekly_trend: weeklyTrendData,
        hourly_pattern: hourlyPatternData,
        list: incidents || []
      },
      schedules: {
        total: totalSchedules,
        accepted: acceptedSchedules,
        declined: totalSchedules - acceptedSchedules,
        acceptance_rate: totalSchedules > 0 ? ((acceptedSchedules / totalSchedules) * 100).toFixed(1) : '0.0',
        attendance_marked: attendanceMarked,
        present: presentCount,
        absent: attendanceMarked - presentCount,
        attendance_rate: acceptedSchedules > 0 ? ((presentCount / acceptedSchedules) * 100).toFixed(1) : '0.0',
        list: schedules || []
      },
      trainings: {
        total: totalTrainings,
        evaluations: evaluations?.length || 0,
        avg_performance_rating: avgPerformanceRating.toFixed(1),
        enrollments: enrollments || [],
        evaluations: evaluations || []
      }
    }

    // Generate insights and patterns
    const analysis = generateInsights(baseAnalytics)

    return NextResponse.json({
      success: true,
      data: {
        ...baseAnalytics,
        insights: analysis.insights,
        recommendations: analysis.recommendations,
        patterns: analysis.patterns,
        performance: {
          score: analysis.performance_score,
          level: analysis.performance_level
        }
      }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch analytics' }, { status: 500 })
  }
}
