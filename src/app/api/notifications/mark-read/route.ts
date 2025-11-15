import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { notification_ids, user_id } = body

    if (!notification_ids && !user_id) {
      return NextResponse.json(
        { success: false, message: "Either notification_ids or user_id is required" },
        { status: 400 }
      )
    }

    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })

    if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      query = query.in("id", notification_ids)
    } else if (user_id) {
      // Mark all unread notifications for user as read
      query = query.eq("user_id", user_id).is("read_at", null)
    }

    const { data, error } = await query.select()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      data, 
      message: `Marked ${data?.length || 0} notification(s) as read` 
    })
  } catch (error: any) {
    console.error("Failed to mark notifications as read:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to mark notifications as read" },
      { status: 500 }
    )
  }
}
