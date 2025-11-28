import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// Complete volunteer activity analytics - schedules, trainings, attendance
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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const volunteerId = searchParams.get('volunteer_id')
    const activityType = searchParams.get('activity_type') // 'schedule' or 'training'

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'Start date and end date are required' }, { status: 400 })
    }

    // Get ALL schedules with complete details
    let schedulesQuery = supabaseAdmin
      .from('schedules')
      .select(`
        *,
        volunteer:users!schedules_volunteer_id_fkey (
          id, first_name, last_name, email, phone_number, barangay
        ),
        creator:users!schedules_created_by_fkey (
          id, first_name, last_name, email
        )
      `)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: false })

    if (volunteerId) schedulesQuery = schedulesQuery.eq('volunteer_id', volunteerId)

    const { data: schedules, error: schedulesError } = await schedulesQuery

    if (schedulesError) {
      return NextResponse.json({ success: false, message: schedulesError.message }, { status: 500 })
    }

    // Get ALL trainings with complete details
    let trainingsQuery = supabaseAdmin
      .from('trainings')
      .select(`
        *,
        enrollments:training_enrollments (
          *,
          user:users!training_enrollments_user_id_fkey (
            id, first_name, last_name, email, phone_number
          )
        ),
        evaluations:training_evaluations_admin (
          *,
          user:users!training_evaluations_admin_user_id_fkey (
            id, first_name, last_name
          )
        )
      `)
      .gte('start_at', startDate)
      .lte('start_at', endDate)
      .order('start_at', { ascending: false })

    const { data: trainings, error: trainingsError } = await trainingsQuery

    if (trainingsError) {
      return NextResponse.json({ success: false, message: trainingsError.message }, { status: 500 })
    }

    // Calculate schedule statistics
    const totalSchedules = schedules?.length || 0
    const acceptedSchedules = schedules?.filter((s: any) => s.is_accepted === true).length || 0
    const declinedSchedules = schedules?.filter((s: any) => s.is_accepted === false).length || 0
    const pendingResponse = schedules?.filter((s: any) => s.is_accepted === null).length || 0
    const attendanceMarked = schedules?.filter((s: any) => s.attendance_marked === true).length || 0
    const presentCount = schedules?.filter((s: any) => 
      s.attendance_marked && s.attendance_notes?.startsWith('PRESENT')
    ).length || 0
    const absentCount = attendanceMarked - presentCount
    const completedSchedules = schedules?.filter((s: any) => s.status === 'COMPLETED').length || 0

    // Calculate training statistics
    const totalTrainings = trainings?.length || 0
    const scheduledTrainings = trainings?.filter((t: any) => t.status === 'SCHEDULED').length || 0
    const ongoingTrainings = trainings?.filter((t: any) => t.status === 'ONGOING').length || 0
    const completedTrainings = trainings?.filter((t: any) => t.status === 'COMPLETED').length || 0
    const cancelledTrainings = trainings?.filter((t: any) => t.status === 'CANCELLED').length || 0

    // Get all enrollments
    const allEnrollments = trainings?.flatMap((t: any) => t.enrollments || []) || []
    const totalEnrollments = allEnrollments.length
    const uniqueVolunteersEnrolled = new Set(allEnrollments.map((e: any) => e.user_id)).size

    // Get all evaluations
    const allEvaluations = trainings?.flatMap((t: any) => t.evaluations || []) || []
    const totalEvaluations = allEvaluations.length
    const avgPerformanceRating = allEvaluations.length > 0
      ? allEvaluations.reduce((sum: number, e: any) => sum + (e.performance_rating || 0), 0) / allEvaluations.length
      : 0

    // Group schedules by volunteer
    const schedulesByVolunteer: Record<string, any> = {}
    schedules?.forEach((schedule: any) => {
      if (schedule.volunteer_id && schedule.volunteer) {
        const volId = schedule.volunteer_id
        if (!schedulesByVolunteer[volId]) {
          schedulesByVolunteer[volId] = {
            volunteer_id: volId,
            volunteer_name: `${schedule.volunteer.first_name} ${schedule.volunteer.last_name}`,
            total: 0,
            accepted: 0,
            declined: 0,
            pending: 0,
            present: 0,
            absent: 0,
            completed: 0,
            schedules: []
          }
        }
        schedulesByVolunteer[volId].total++
        if (schedule.is_accepted === true) schedulesByVolunteer[volId].accepted++
        if (schedule.is_accepted === false) schedulesByVolunteer[volId].declined++
        if (schedule.is_accepted === null) schedulesByVolunteer[volId].pending++
        if (schedule.attendance_marked && schedule.attendance_notes?.startsWith('PRESENT')) {
          schedulesByVolunteer[volId].present++
        }
        if (schedule.attendance_marked && !schedule.attendance_notes?.startsWith('PRESENT')) {
          schedulesByVolunteer[volId].absent++
        }
        if (schedule.status === 'COMPLETED') schedulesByVolunteer[volId].completed++
        schedulesByVolunteer[volId].schedules.push(schedule.id)
      }
    })

    // Group schedules by activity type/title
    const schedulesByActivity: Record<string, any> = {}
    schedules?.forEach((schedule: any) => {
      const activity = schedule.title || 'Unknown'
      if (!schedulesByActivity[activity]) {
        schedulesByActivity[activity] = {
          activity_name: activity,
          total: 0,
          accepted: 0,
          declined: 0,
          present: 0,
          absent: 0,
          schedules: []
        }
      }
      schedulesByActivity[activity].total++
      if (schedule.is_accepted === true) schedulesByActivity[activity].accepted++
      if (schedule.is_accepted === false) schedulesByActivity[activity].declined++
      if (schedule.attendance_marked && schedule.attendance_notes?.startsWith('PRESENT')) {
        schedulesByActivity[activity].present++
      }
      if (schedule.attendance_marked && !schedule.attendance_notes?.startsWith('PRESENT')) {
        schedulesByActivity[activity].absent++
      }
      schedulesByActivity[activity].schedules.push(schedule.id)
    })

    // Group trainings by volunteer (through enrollments)
    const trainingsByVolunteer: Record<string, any> = {}
    trainings?.forEach((training: any) => {
      training.enrollments?.forEach((enrollment: any) => {
        if (enrollment.user_id && enrollment.user) {
          const volId = enrollment.user_id
          if (!trainingsByVolunteer[volId]) {
            trainingsByVolunteer[volId] = {
              volunteer_id: volId,
              volunteer_name: `${enrollment.user.first_name} ${enrollment.user.last_name}`,
              total_enrollments: 0,
              total_evaluations: 0,
              avg_rating: 0,
              trainings: []
            }
          }
          trainingsByVolunteer[volId].total_enrollments++
          trainingsByVolunteer[volId].trainings.push({
            training_id: training.id,
            training_title: training.title,
            status: training.status,
            enrolled_at: enrollment.enrolled_at
          })
        }
      })

      // Add evaluations
      training.evaluations?.forEach((evaluation: any) => {
        if (evaluation.user_id && evaluation.user) {
          const volId = evaluation.user_id
          if (!trainingsByVolunteer[volId]) {
            trainingsByVolunteer[volId] = {
              volunteer_id: volId,
              volunteer_name: `${evaluation.user.first_name} ${evaluation.user.last_name}`,
              total_enrollments: 0,
              total_evaluations: 0,
              avg_rating: 0,
              trainings: []
            }
          }
          trainingsByVolunteer[volId].total_evaluations++
        }
      })
    })

    // Calculate avg rating per volunteer
    Object.keys(trainingsByVolunteer).forEach(volId => {
      const volEvaluations = allEvaluations.filter((e: any) => e.user_id === volId)
      if (volEvaluations.length > 0) {
        trainingsByVolunteer[volId].avg_rating = volEvaluations.reduce((sum: number, e: any) => 
          sum + (e.performance_rating || 0), 0) / volEvaluations.length
      }
    })

    // Time-based patterns for schedules
    const scheduleByDate: Record<string, any> = {}
    const scheduleByMonth: Record<string, number> = {}
    schedules?.forEach((schedule: any) => {
      const date = new Date(schedule.start_time)
      const dateKey = date.toISOString().split('T')[0]
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!scheduleByDate[dateKey]) {
        scheduleByDate[dateKey] = { total: 0, accepted: 0, present: 0 }
      }
      scheduleByDate[dateKey].total++
      if (schedule.is_accepted) scheduleByDate[dateKey].accepted++
      if (schedule.attendance_marked && schedule.attendance_notes?.startsWith('PRESENT')) {
        scheduleByDate[dateKey].present++
      }

      scheduleByMonth[monthKey] = (scheduleByMonth[monthKey] || 0) + 1
    })

    // Time-based patterns for trainings
    const trainingByDate: Record<string, number> = {}
    const trainingByMonth: Record<string, number> = {}
    trainings?.forEach((training: any) => {
      const date = new Date(training.start_at)
      const dateKey = date.toISOString().split('T')[0]
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      trainingByDate[dateKey] = (trainingByDate[dateKey] || 0) + 1
      trainingByMonth[monthKey] = (trainingByMonth[monthKey] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date: startDate, end_date: endDate },
        filters: { volunteer_id: volunteerId, activity_type: activityType },
        schedules: {
          summary: {
            total: totalSchedules,
            accepted: acceptedSchedules,
            declined: declinedSchedules,
            pending_response: pendingResponse,
            attendance_marked: attendanceMarked,
            present: presentCount,
            absent: absentCount,
            completed: completedSchedules,
            acceptance_rate: totalSchedules > 0 ? (acceptedSchedules / totalSchedules) * 100 : 0,
            attendance_rate: acceptedSchedules > 0 ? (presentCount / acceptedSchedules) * 100 : 0,
            completion_rate: totalSchedules > 0 ? (completedSchedules / totalSchedules) * 100 : 0
          },
          by_volunteer: schedulesByVolunteer,
          by_activity: schedulesByActivity,
          time_patterns: {
            by_date: scheduleByDate,
            by_month: scheduleByMonth
          },
          details: schedules || []
        },
        trainings: {
          summary: {
            total: totalTrainings,
            scheduled: scheduledTrainings,
            ongoing: ongoingTrainings,
            completed: completedTrainings,
            cancelled: cancelledTrainings,
            total_enrollments: totalEnrollments,
            unique_volunteers_enrolled: uniqueVolunteersEnrolled,
            total_evaluations: totalEvaluations,
            avg_performance_rating: avgPerformanceRating
          },
          by_volunteer: trainingsByVolunteer,
          time_patterns: {
            by_date: trainingByDate,
            by_month: trainingByMonth
          },
          details: trainings || []
        },
        overall: {
          total_activities: totalSchedules + totalTrainings,
          total_participants: new Set([
            ...(schedules?.map((s: any) => s.volunteer_id).filter(Boolean) || []),
            ...(allEnrollments.map((e: any) => e.user_id).filter(Boolean) || [])
          ]).size,
          overall_acceptance_rate: totalSchedules > 0 ? (acceptedSchedules / totalSchedules) * 100 : 0,
          overall_attendance_rate: acceptedSchedules > 0 ? (presentCount / acceptedSchedules) * 100 : 0
        }
      }
    })
  } catch (e: any) {
    console.error('Complete volunteer activity analytics error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch complete volunteer activity analytics' }, { status: 500 })
  }
}


