// /app/api/barangays/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET() {
  try {
    console.log("Fetching barangays from database...")

    const supabase = await getServerSupabase() // server-safe

    const { data, error } = await supabase
      .from("barangays")
      .select("name")
      .order("name")

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("Barangays fetched successfully:", data?.length || 0, "items")

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    console.error("API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
