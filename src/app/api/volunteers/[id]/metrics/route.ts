import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { z } from "zod"

const MetricsParamsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getServerSupabase()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify user is admin or the volunteer themselves
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData || (userData.role !== "admin" && user.id !== params.id)) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      )
    }

    const { id } = MetricsParamsSchema.parse({ id: params.id })

    // Get incidents assigned to this volunteer
    const { data: incidents, error: incidentsError } = await supabase
      .from("incidents")
      .select("id, status, assigned_at, resolved_at, created_at, severity")
      .eq("assigned_to", id)
      .order("created_at", { ascending: false })

    if (incidentsError) throw incidentsError

    // Get schedules for this volunteer
    const { data: schedules, error: schedulesError } = await supabase
      .from("schedules")
      .select("id, start_time, end_time, status, completed_at")
      .eq("volunteer_id", id)
      .order("start_time", { ascending: false })

    if (schedulesError) throw schedulesError

    // Get feedback for incidents resolved by this volunteer
    const { data: feedback, error: feedbackError } = await supabase
      .from("incident_feedback")
      .select("rating, comment")
      .in(
        "incident_id",
        incidents?.filter((i) => i.status === "RESOLVED").map((i) => i.id) || []
      )

    if (feedbackError) throw feedbackError

    // Calculate metrics
    const resolvedIncidents = incidents?.filter((i) => i.status === "RESOLVED") || []
    const totalIncidents = incidents?.length || 0
    const resolutionRate = totalIncidents > 0 ? (resolvedIncidents.length / totalIncidents) * 100 : 0

    // Calculate response times (time from assignment to resolution)
    const responseTimes = resolvedIncidents
      .filter((i) => i.assigned_at && i.resolved_at)
      .map((i) => {
        const assigned = new Date(i.assigned_at!).getTime()
        const resolved = new Date(i.resolved_at!).getTime()
        return resolved - assigned
      })

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0

    const fastestResponseTime = responseTimes.length > 0
      ? Math.min(...responseTimes)
      : 0

    // Calculate total hours volunteered from schedules
    const totalHours = schedules
      ?.filter((s) => s.status === "COMPLETED" && s.start_time && s.end_time)
      .reduce((total, s) => {
        const start = new Date(s.start_time).getTime()
        const end = new Date(s.end_time).getTime()
        const hours = (end - start) / (1000 * 60 * 60)
        return total + hours
      }, 0) || 0

    // Calculate active days (unique days with activity)
    const activeDaysSet = new Set<string>()
    incidents?.forEach((i) => {
      if (i.created_at) {
        activeDaysSet.add(new Date(i.created_at).toISOString().split("T")[0])
      }
    })
    schedules?.forEach((s) => {
      if (s.start_time) {
        activeDaysSet.add(new Date(s.start_time).toISOString().split("T")[0])
      }
    })
    const activeDaysCount = activeDaysSet.size

    // Get last activity date
    const lastActivityDates = [
      ...(incidents?.map((i) => i.created_at).filter(Boolean) || []),
      ...(schedules?.map((s) => s.start_time).filter(Boolean) || []),
    ]
    const lastActivityDate = lastActivityDates.length > 0
      ? new Date(Math.max(...lastActivityDates.map((d) => new Date(d!).getTime())))
      : null

    // Calculate average feedback rating
    const ratings = feedback?.map((f) => f.rating).filter((r) => r != null) || []
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0

    const positiveFeedbackCount = feedback?.filter((f) => f.rating && f.rating >= 4).length || 0

    return NextResponse.json({
      success: true,
      data: {
        responseMetrics: {
          averageResponseTime: Math.round(avgResponseTime / (1000 * 60)), // in minutes
          fastestResponseTime: fastestResponseTime > 0 ? Math.round(fastestResponseTime / (1000 * 60)) : 0, // in minutes
          totalResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / (1000 * 60)), // in minutes
        },
        resolutionMetrics: {
          totalResolved: resolvedIncidents.length,
          resolutionRate: Math.round(resolutionRate * 100) / 100,
          averageResolutionTime: avgResponseTime > 0 ? Math.round(avgResponseTime / (1000 * 60 * 60)) : 0, // in hours
        },
        activityMetrics: {
          totalHoursVolunteered: Math.round(totalHours * 100) / 100,
          activeDaysCount,
          lastActivityDate: lastActivityDate?.toISOString() || null,
        },
        qualityMetrics: {
          averageFeedbackRating: Math.round(avgRating * 100) / 100,
          positiveFeedbackCount,
          totalFeedbackCount: feedback?.length || 0,
        },
      },
    })
  } catch (error: any) {
    console.error("Error fetching volunteer metrics:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}

