"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { subscribeToVolunteerIncidents } from "@/lib/incidents"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"

export const VolunteerNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    // Subscribe to real-time updates for volunteer assignments
    const subscription = subscribeToVolunteerIncidents(user.id, (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload

      // Handle new assignment
      // Check both direct ID and joined user object
      const newAssignedUserId = newRecord.assigned_to || (newRecord.assignee && newRecord.assignee.id) || null;
      const oldAssignedUserId = oldRecord.assigned_to || (oldRecord.assignee && oldRecord.assignee.id) || null;
      
      if (
        (eventType === "INSERT" && newAssignedUserId === user.id) ||
        (eventType === "UPDATE" && oldAssignedUserId !== user.id && newAssignedUserId === user.id)
      ) {
        const newNotification = {
          id: newRecord.id,
          type: newRecord.incident_type,
          barangay: newRecord.barangay,
          time: new Date(newRecord.updated_at || newRecord.created_at),
          isNew: true,
        }

        // Play notification sound (fallback tone)
        const playTone = () => {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            o.type = 'square'
            o.frequency.value = 660
            g.gain.value = 0.05
            o.connect(g)
            g.connect(ctx.destination)
            o.start()
            setTimeout(() => { o.stop(); ctx.close() }, 250)
          } catch { void 0 }
        }
        const audio = new Audio("/volunteer-alert.mp3")
        audio.play().catch(() => playTone())

        // Show browser notification if permission granted
        if (Notification.permission === "granted") {
          new Notification("New Incident Assignment", {
            body: `You've been assigned to a ${newRecord.incident_type} in ${newRecord.barangay}`,
            icon: "/icons/icon-192x192.png",
          })
        }

        // Vibrate if available (mobile devices)
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }

        setNotifications((prev) => [newNotification, ...prev])
      }
    })

    // Request notification permission
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission()
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [user])

  const handleNotificationClick = (id: string) => {
    router.push(`/volunteer/incident/${id}`)
    setShowNotifications(false)
  }

  const dismissNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setNotifications((prev) => prev.filter((notif) => notif.id !== id))
  }

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
        onClick={() => setShowNotifications(!showNotifications)}
      >
        <Bell className="h-6 w-6 text-gray-600" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
            {notifications.length}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold">Assignments</h3>
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No new assignments</div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex justify-between ${
                    notification.isNew ? "bg-green-50" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div>
                    <p className="text-sm font-medium">{notification.type}</p>
                    <p className="text-xs text-gray-500">
                      {notification.barangay} • {notification.time.toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={(e) => dismissNotification(e, notification.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
