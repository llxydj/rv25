// src/components/push-notification-toggle.tsx

"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { notificationService } from "@/lib/notifications"
import { useToast } from "@/components/ui/use-toast"

/**
 * Universal Push Notification Toggle
 * Works for all user roles: Admin, Volunteer, Resident, Barangay
 * 
 * Usage:
 * ```tsx
 * import { PushNotificationToggle } from "@/components/push-notification-toggle"
 * 
 * <PushNotificationToggle />
 * ```
 */
export function PushNotificationToggle() {
  const [pushEnabled, setPushEnabled] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    checkSubscriptionStatus()
  }, [])

  const checkSubscriptionStatus = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
        setPushEnabled(!!subscription)
      }
    } catch (error) {
      console.error('[push-toggle] Error checking subscription:', error)
    }
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      try {
        setLoading(true)
        const initialized = await notificationService.initialize()
        
        if (initialized) {
          setIsSubscribed(true)
          setPushEnabled(true)
          toast({
            title: "✅ Push Notifications Enabled",
            description: "You'll receive instant alerts for important updates"
          })
        } else {
          throw new Error('Failed to initialize push notifications')
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "❌ Enable Failed",
          description: error.message || 'Please allow notifications in your browser settings'
        })
        setPushEnabled(false)
      } finally {
        setLoading(false)
      }
    } else {
      // Just update local state - subscription stays but user preference off
      setPushEnabled(false)
      toast({
        title: "🔕 Notifications Paused",
        description: "You can re-enable them anytime"
      })
    }
  }

  const testNotification = async () => {
    try {
      await notificationService.sendNotification({
        title: '🔔 Test Notification',
        body: 'Push notifications are working perfectly!',
        icon: '/icons/icon-192x192.png',
        data: { type: 'test' }
      })
      
      toast({
        title: "✅ Test Sent",
        description: "Check your notifications"
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Test Failed",
        description: "Could not send test notification"
      })
    }
  }

  // Check if browser supports push notifications
  if (!notificationService.isSupported()) {
    return (
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-900">
              Push Notifications Not Supported
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Your browser doesn't support push notifications. Try Chrome, Firefox, or Edge.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  // Check for iOS Safari (limited support)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches

  if (isIOS && !isPWA) {
    return (
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">
              Push Notifications for iPhone
            </p>
            <p className="text-xs text-blue-700 mt-1">
              💡 Tap Share → "Add to Home Screen" to enable push notifications
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {pushEnabled ? (
            <div className="relative">
              <Bell className="h-5 w-5 text-green-600" />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            </div>
          ) : (
            <BellOff className="h-5 w-5 text-gray-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              Push Notifications
            </p>
            <p className="text-xs text-gray-600 truncate">
              {isSubscribed 
                ? pushEnabled 
                  ? 'Receiving instant alerts' 
                  : 'Paused - toggle to resume'
                : 'Enable to receive instant alerts'
              }
            </p>
          </div>
        </div>
        
        <Switch
          checked={pushEnabled}
          onCheckedChange={handleToggle}
          disabled={loading}
          className="scale-110 flex-shrink-0"
        />
      </div>

      {isSubscribed && pushEnabled && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <Button
            size="sm"
            variant="outline"
            onClick={testNotification}
            className="w-full h-9"
          >
            <Bell className="h-4 w-4 mr-2" />
            Send Test Notification
          </Button>
        </div>
      )}

      {isSubscribed && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-green-700 font-medium">
            Active Subscription
          </span>
        </div>
      )}

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          <span>Initializing...</span>
        </div>
      )}
    </Card>
  )
}
