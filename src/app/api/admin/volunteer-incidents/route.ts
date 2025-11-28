import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getServerSupabase } from "@/lib/supabase-server"
import type { Database } from "@/types/supabase"

export const runtime = "nodejs"
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: meAuth } = await supabase.auth.getUser()
    const uid = meAuth?.user?.id

    if (!uid) {
      return NextResponse.json({ success: false, code: "NOT_AUTHENTICATED" }, { status: 401 })
    }

    const { data: me, error: meError } = await supabase
      .from("users")
      .select("role")
      .eq("id", uid)
      .maybeSingle()

    if (meError) {
      return NextResponse.json({ success: false, message: meError.message }, { status: 400 })
    }

    if (!me || me.role !== "admin") {
      return NextResponse.json({ success: false, code: "FORBIDDEN" }, { status: 403 })
    }

    const volunteerIdParam = request.nextUrl.searchParams.get("volunteerId")
    const cleanVolunteerId = (volunteerIdParam || "").split("?")[0].trim()

    if (!cleanVolunteerId) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", message: "volunteerId is required" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("incidents")
      .select(
        `
        *,
        reporter:users!incidents_reporter_id_fkey (
          id, first_name, last_name, email, phone_number
        )
      `
      )
      .eq("assigned_to", cleanVolunteerId)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: e?.message || "Failed to fetch volunteer incidents",
      },
      { status: 500 }
    )
  }
}
