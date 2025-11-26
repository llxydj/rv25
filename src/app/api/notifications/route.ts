import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const unreadOnly = searchParams.get("unread_only") === "true"

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "user_id is required" },
        { status: 400 }
      )
    }

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.is("read_at", null)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Failed to fetch notifications:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, title, body: notificationBody, type, data } = body

    if (!user_id || !title || !notificationBody || !type) {
      return NextResponse.json(
        { success: false, message: "user_id, title, body, and type are required" },
        { status: 400 }
      )
    }

    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        user_id,
        title,
        body: notificationBody,
        type,
        data: data || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: notification })
  } catch (error: any) {
    console.error("Failed to create notification:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create notification" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { notification_id, read_at } = body

    if (!notification_id) {
      return NextResponse.json(
        { success: false, message: "notification_id is required" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: read_at || new Date().toISOString() })
      .eq("id", notification_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Failed to update notification:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update notification" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get("notification_id")

    if (!notificationId) {
      return NextResponse.json(
        { success: false, message: "notification_id is required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)

    if (error) throw error

    return NextResponse.json({ success: true, message: "Notification deleted" })
  } catch (error: any) {
    console.error("Failed to delete notification:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete notification" },
      { status: 500 }
    )
  }
}
