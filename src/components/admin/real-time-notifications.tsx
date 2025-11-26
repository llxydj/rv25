"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Bell, X, Settings } from "lucide-react"
import { subscribeToIncidents, getAllIncidents } from "@/lib/incidents"
import { notificationService } from "@/lib/notifications"
import { useRouter } from "next/navigation"
import { NotificationPreferencesComponent } from "@/components/notification-preferences"

export const RealTimeNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [notificationSupported, setNotificationSupported] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Initialize notification service
    const initNotifications = async () => {
      const supported = notificationService.isSupported()
      setNotificationSupported(supported)
      
      if (supported) {
        await notificationService.initialize()
      }
    }

    initNotifications()

    // Initial fetch of pending incidents
    const fetchPendingIncidents = async () => {
      const result = await getAllIncidents()
      if (result.success) {
        const pendingIncidents = (result.data || [])
          .filter((incident: any) => incident.status === "PENDING")
          .map((incident: any) => ({
            id: incident.id,
            type: incident.incident_type,
            barangay: incident.barangay,
            time: new Date(incident.created_at),
            isNew: false,
          }))
        setNotifications(pendingIncidents)
      }
    }

    fetchPendingIncidents()

    // Subscribe to real-time updates
    const subscription = subscribeToIncidents(async (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload

      // Handle new incident
      if (eventType === "INSERT" && newRecord.status === "PENDING") {
        const newNotification = {
          id: newRecord.id,
          type: newRecord.incident_type,
          barangay: newRecord.barangay,
          time: new Date(newRecord.created_at),
          isNew: true,
        }

        // Play notification sound (fallback to WebAudio if asset missing)
        const playTone = () => {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const o = ctx.createOscillator()
            const g = ctx.createGain()
            o.type = 'sine'
            o.frequency.value = 880
            g.gain.value = 0.05
            o.connect(g)
            g.connect(ctx.destination)
            o.start()
            setTimeout(() => { o.stop(); ctx.close() }, 250)
          } catch { void 0 }
        }
        const audio = new Audio("/notification-sound.mp3")
        audio.play().catch(() => playTone())

        // Send push notification if supported
        if (notificationSupported && notificationService.hasPermission()) {
          try {
            await notificationService.sendNotification({
              title: "🚨 New Incident Reported",
              body: `${newRecord.incident_type} in ${newRecord.barangay}`,
              data: {
                type: 'incident_alert',
                incident_id: newRecord.id,
                url: `/admin/incidents/${newRecord.id}`
              },
              actions: [
                {
                  action: 'view',
                  title: 'View Details'
                },
                {
                  action: 'dismiss',
                  title: 'Dismiss'
                }
              ]
            })
          } catch (error) {
            console.error('Failed to send push notification:', error)
          }
        }

        setNotifications((prev) => [newNotification, ...prev])
      }

      // Handle status update
      if (eventType === "UPDATE" && oldRecord.status === "PENDING" && newRecord.status !== "PENDING") {
        setNotifications((prev) => prev.filter((notif) => notif.id !== newRecord.id))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [notificationSupported])

  const handleNotificationClick = (id: string) => {
    router.push(`/admin/incidents/${id}`)
    setShowNotifications(false)
  }

  const dismissNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setNotifications((prev) => prev.filter((notif) => notif.id !== id))
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          className="relative p-2 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell className="h-6 w-6 text-gray-600" />
          {notifications.length > 0 && (
            <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
              {notifications.length}
            </span>
          )}
        </button>
        
        {notificationSupported && (
          <button
            className="p-2 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setShowPreferences(true)}
            title="Notification Settings"
          >
            <Settings className="h-5 w-5 text-gray-600" />
          </button>
        )}
      </div>

      {showNotifications && (
        <div className="fixed right-4 top-16 w-80 bg-white rounded-md shadow-xl z-[100] max-h-[80vh] overflow-y-auto border border-gray-200">
          <div className="p-3 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {notificationSupported && (
              <button
                onClick={() => setShowPreferences(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Settings
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No new notifications</div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex justify-between ${
                    notification.isNew ? "bg-blue-50" : ""
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

      {showPreferences && (
        <NotificationPreferencesComponent />
      )}
    </div>
  )
}
