import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { z } from "zod"
import { calculateProfileCompleteness } from "@/lib/profile-completeness"

const CompletenessParamsSchema = z.object({
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

    const { id } = CompletenessParamsSchema.parse({ id: params.id })

    // Get user data
    const { data: userInfo, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .eq("role", "volunteer")
      .single()

    if (userError) throw userError

    // Get volunteer profile
    const { data: profile, error: profileError } = await supabase
      .from("volunteer_profiles")
      .select("*")
      .eq("volunteer_user_id", id)
      .single()

    // Get document count
    const { count: documentCount } = await supabase
      .from("volunteer_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id)

    // Combine user and profile data
    const combinedProfile = {
      ...userInfo,
      role: "volunteer" as const,
      volunteer_profiles: profile || null,
    }

    // Calculate completeness with document count
    const completeness = calculateProfileCompleteness(combinedProfile, documentCount || 0)

    return NextResponse.json({
      success: true,
      data: completeness,
    })
  } catch (error: any) {
    console.error("Error fetching profile completeness:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch completeness" },
      { status: 500 }
    )
  }
}

