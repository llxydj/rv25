import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { z } from "zod"

const TrainingsParamsSchema = z.object({
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

    const { id } = TrainingsParamsSchema.parse({ id: params.id })

    // Get training enrollments for this volunteer
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("training_enrollments")
      .select(`
        id,
        enrolled_at,
        attended,
        training:trainings (
          id,
          title,
          description,
          start_at,
          end_at,
          location,
          status
        )
      `)
      .eq("user_id", id)
      .order("enrolled_at", { ascending: false })

    if (enrollmentsError) throw enrollmentsError

    // Get training evaluations for this volunteer
    const { data: evaluations, error: evaluationsError } = await supabase
      .from("training_evaluations")
      .select(`
        id,
        rating,
        comments,
        created_at,
        training_id
      `)
      .eq("user_id", id)
      .order("created_at", { ascending: false })

    if (evaluationsError) throw evaluationsError

    // Get admin evaluations for this volunteer
    const { data: adminEvaluations, error: adminEvalError } = await supabase
      .from("training_evaluations_admin")
      .select(`
        id,
        performance_rating,
        skills_assessment,
        comments,
        created_at,
        training_id,
        evaluated_by
      `)
      .eq("user_id", id)
      .order("created_at", { ascending: false })

    if (adminEvalError) throw adminEvalError

    // Combine enrollments with evaluations
    const trainings = (enrollments || []).map((enrollment: any) => {
      const training = enrollment.training
      const userEvaluation = evaluations?.find((e) => e.training_id === training?.id)
      const adminEvaluation = adminEvaluations?.find((e) => e.training_id === training?.id)

      return {
        enrollmentId: enrollment.id,
        enrolledAt: enrollment.enrolled_at,
        attended: enrollment.attended,
        training: {
          id: training?.id,
          title: training?.title,
          description: training?.description,
          startAt: training?.start_at,
          endAt: training?.end_at,
          location: training?.location,
          status: training?.status,
        },
        userEvaluation: userEvaluation ? {
          rating: userEvaluation.rating,
          comments: userEvaluation.comments,
          createdAt: userEvaluation.created_at,
        } : null,
        adminEvaluation: adminEvaluation ? {
          performanceRating: adminEvaluation.performance_rating,
          skillsAssessment: adminEvaluation.skills_assessment,
          comments: adminEvaluation.comments,
          evaluatedBy: adminEvaluation.evaluated_by,
          createdAt: adminEvaluation.created_at,
        } : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: trainings,
    })
  } catch (error: any) {
    console.error("Error fetching volunteer trainings:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch trainings" },
      { status: 500 }
    )
  }
}

