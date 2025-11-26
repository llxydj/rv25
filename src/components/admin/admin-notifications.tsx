"use client"

import React from "react"
import { useAuth } from "@/lib/auth"
import { NotificationBell } from "@/components/notification-bell"
import { useRouter } from "next/navigation"

export function AdminNotifications() {
  const { user } = useAuth()
  const router = useRouter()

  if (!user?.id) return null

  const handleNotificationClick = (notification: any) => {
    // Custom navigation for admin notifications
    const data = notification.data || {}
    
    if (data.incident_id) {
      // Navigate to incident details
      router.push(`/admin/incidents/${data.incident_id}`)
    } else if (data.url) {
      router.push(data.url)
    }
  }

  return (
    <NotificationBell
      userId={user.id}
      userRole="admin"
      onNotificationClick={handleNotificationClick}
    />
  )
}
