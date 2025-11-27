// src/components/notification-bell.tsx

"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Bell, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface Notification {
  id: string
  title: string
  body: string
  type: string
  data?: any
  read_at: string | null
  created_at: string
}

interface NotificationBellProps {
  userId: string
  userRole: "admin" | "volunteer" | "resident" | "barangay"
  onNotificationClick?: (notification: Notification) => void
}

export function NotificationBell({ userId, userRole, onNotificationClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const [channelStatus, setChannelStatus] = useState<string>('connecting')
  const router = useRouter()

  // Send notification to Service Worker for system notification
  const triggerSystemNotification = useCallback(async (notification: Notification) => {
    try {
      // Check if service worker is registered
      if (!("serviceWorker" in navigator)) {
        console.warn("⚠️ Service workers not supported")
        return
      }

      const registration = await navigator.serviceWorker.ready
      
      if (!registration) {
        console.warn("⚠️ Service worker not ready")
        return
      }

      const controller = navigator.serviceWorker.controller
      if (!controller) {
        console.warn("⚠️ No active service worker controller")
        return
      }

      // Post message to service worker with notification data
      controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: {
          title: notification.title,
          body: notification.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: notification.id,
          url: notification.data?.incident_id 
            ? `/${userRole}/incident/${notification.data.incident_id}`
            : `/${userRole}/notifications`,
          data: notification.data || {}
        }
      })

      console.log('📤 Posted notification to SW:', notification.title)
    } catch (error) {
      console.error('❌ Failed to send notification to SW:', error)
    }
  }, [userRole])

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error("❌ Failed to fetch notifications:", error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Subscribe to real-time notification updates
  useEffect(() => {
    if (!userId) return

    // Initial fetch
    fetchNotifications()

    // Create a unique channel name to avoid conflicts
    const channelName = `notifications:${userId}:${Date.now()}`
    let channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📬 Notification realtime event:', payload.eventType, payload.new?.id)
          
          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as Notification
            
            // Update notifications list
            setNotifications((prev) => {
              // Prevent duplicates
              if (prev.some(n => n.id === newNotif.id)) {
                console.log('⚠️ Duplicate notification ignored:', newNotif.id)
                return prev
              }
              console.log('✅ New notification added:', newNotif.title)
              return [newNotif, ...prev]
            })
            
            // Trigger pulse animation
            setHasNewNotification(true)
            setTimeout(() => setHasNewNotification(false), 2000)
            
            // TRIGGER SYSTEM NOTIFICATION VIA SERVICE WORKER
            triggerSystemNotification(newNotif)
            
            // Also try browser Notification API as fallback (if not using SW)
            if (typeof window !== 'undefined' && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                try {
                  new Notification(newNotif.title, {
                    body: newNotif.body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    tag: newNotif.id
                  })
                } catch (err) {
                  console.error('❌ Notification API error:', err)
                }
              }
            }
          } else if (payload.eventType === "UPDATE") {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n))
            )
          } else if (payload.eventType === "DELETE") {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id))
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🔔 Notification channel status:', status)
        setChannelStatus(status)
        
        if (err) {
          console.error('❌ Notification channel error:', err)
        }
        
        // If channel closed or timed out, try to reconnect
        if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.log('🔄 Channel disconnected, reconnecting in 2 seconds...')
          setTimeout(() => {
            fetchNotifications() // Refresh notifications immediately
          }, 2000)
        } else if (status === 'SUBSCRIBED') {
          console.log('✅ Notification channel connected')
        }
      })

    // Set up periodic refresh as backup (every 30 seconds)
    const refreshInterval = setInterval(() => {
      fetchNotifications()
    }, 30000)

    return () => {
      clearInterval(refreshInterval)
      try {
        supabase.removeChannel(channel)
      } catch (err) {
        console.error('Error removing channel:', err)
      }
    }
  }, [userId, fetchNotifications, triggerSystemNotification])

  // Request notification permissions on mount and set up service worker listener
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = Notification.permission
      console.log('🔔 Current notification permission:', permission)
      
      if (permission === 'default') {
        Notification.requestPermission().then(newPermission => {
          console.log('🔔 Notification permission after request:', newPermission)
        })
      } else if (permission === 'granted') {
        console.log('✅ Notification permission granted')
      } else {
        console.warn('⚠️ Notification permission denied - user needs to enable in browser settings')
      }
    }
    
    // Listen for push notifications from service worker
    if ('serviceWorker' in navigator) {
      // Check service worker status
      navigator.serviceWorker.ready.then((registration) => {
        console.log('✅ Service worker ready for push notifications')
        console.log('📡 Service worker scope:', registration.scope)
      }).catch((err) => {
        console.error('❌ Service worker not ready:', err)
      })
      
      // Listen for messages from service worker
      const messageHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
          console.log('📬 Received push notification message from service worker:', event.data.notification)
          
          // Refresh notifications to get the latest from database
          fetchNotifications()
          
          // Trigger pulse animation
          setHasNewNotification(true)
          setTimeout(() => setHasNewNotification(false), 2000)
        }
      }
      
      navigator.serviceWorker.addEventListener('message', messageHandler)
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', messageHandler)
      }
    }
  }, [fetchNotifications])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() } as any)
        .eq("id", notificationId)

      if (error) throw error
    } catch (error) {
      console.error("❌ Failed to mark notification as read:", error)
    }
  }, [])

  // Handle notification click
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read
      if (!notification.read_at) {
        markAsRead(notification.id)
      }

      // Custom handler or default navigation
      if (onNotificationClick) {
        onNotificationClick(notification)
      } else {
        // Default navigation based on notification type
        const data = notification.data || {}
        if (data.incident_id) {
          const path = `/${userRole}/incident/${data.incident_id}`
          router.push(path)
        }
      }

      setShowDropdown(false)
    },
    [markAsRead, onNotificationClick, router, userRole]
  )

  // Dismiss notification
  const dismissNotification = useCallback(
    async (e: React.MouseEvent, notificationId: string) => {
      e.stopPropagation()
      try {
        const { error } = await supabase.from("notifications").delete().eq("id", notificationId)
        if (error) throw error
      } catch (error) {
        console.error("❌ Failed to delete notification:", error)
      }
    },
    []
  )

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
      if (unreadIds.length === 0) return

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() } as any)
        .in("id", unreadIds)

      if (error) throw error
    } catch (error) {
      console.error("❌ Failed to mark all as read:", error)
    }
  }, [notifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <div className="relative">
      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .pulse-badge {
          animation: pulse-ring 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
      
      <button
        className="relative p-2 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="Notifications"
      >
        <Bell className={`h-6 w-6 text-gray-600 transition-transform ${hasNewNotification ? 'animate-bounce' : ''}`} />
        {unreadCount > 0 && (
          <>
            {hasNewNotification && (
              <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 pulse-badge"></span>
            )}
            <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow-lg">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </>
        )}
      </button>

      {showDropdown && (
        <div className="fixed right-4 top-16 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl z-[100] max-h-[80vh] overflow-hidden border border-gray-200">
          <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {channelStatus !== 'SUBSCRIBED' && (
                <span className="text-xs text-yellow-600" title="Real-time connection issue - using polling">
                  ⚠️
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setLoading(true)
                  fetchNotifications()
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                title="Refresh notifications"
              >
                ↻
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read_at ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {notification.title}
                          </p>
                          {!notification.read_at && (
                            <span className="flex-shrink-0 h-2 w-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                          {notification.body}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => dismissNotification(e, notification.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1"
                        aria-label="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  router.push(`/${userRole}/notifications`)
                  setShowDropdown(false)
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium text-center"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}