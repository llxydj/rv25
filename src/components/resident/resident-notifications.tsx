"use client"

import React from "react"
import { useAuth } from "@/lib/auth"
import { NotificationBell } from "@/components/notification-bell"
import { useRouter } from "next/navigation"

export function ResidentNotifications() {
  const { user } = useAuth()
  const router = useRouter()

  if (!user?.id) return null

  const handleNotificationClick = (notification: any) => {
    // Custom navigation for resident notifications
    const data = notification.data || {}
    
    if (data.incident_id) {
      // Navigate to incident history with the specific incident
      router.push(`/resident/history?incident=${data.incident_id}`)
    } else if (data.url) {
      router.push(data.url)
    }
  }

  return (
    <NotificationBell
      userId={user.id}
      userRole="resident"
      onNotificationClick={handleNotificationClick}
    />
  )
}
