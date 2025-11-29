import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { z } from "zod"

const IncidentsParamsSchema = z.object({
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

    const { id } = IncidentsParamsSchema.parse({ id: params.id })

    // Get incidents assigned to this volunteer
    const { data: incidents, error: incidentsError } = await supabase
      .from("incidents")
      .select(`
        id,
        incident_type,
        description,
        status,
        priority,
        severity,
        location_lat,
        location_lng,
        address,
        barangay,
        assigned_at,
        resolved_at,
        created_at,
        updated_at,
        photo_url,
        photo_urls
      `)
      .eq("assigned_to", id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (incidentsError) throw incidentsError

    return NextResponse.json({
      success: true,
      data: incidents || [],
    })
  } catch (error: any) {
    console.error("Error fetching volunteer incidents:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch incidents" },
      { status: 500 }
    )
  }
}

