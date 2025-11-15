import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    console.log("Fetching barangays from database...")
    
    const { data, error } = await supabase.from("barangays").select("name").order("name")

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("Barangays fetched successfully:", data?.length || 0, "items")
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
