// src/components/push-notification-toggle.tsx

"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { pushNotificationService } from "@/lib/push-notification-service"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

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
  const [mounted, setMounted] = useState(false)
  const [diagnostics, setDiagnostics] = useState<{
    permission: string
    serviceWorker: string
    subscription: string
  } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
    checkSubscriptionStatus()
    checkDiagnostics()
  }, [])
  
  const checkDiagnostics = async () => {
    const diag: any = {
      permission: 'unknown',
      serviceWorker: 'unknown',
      subscription: 'unknown'
    }
    
    // Check notification permission
    if ('Notification' in window) {
      diag.permission = Notification.permission
    } else {
      diag.permission = 'not supported'
    }
    
    // Check service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          diag.serviceWorker = registration.active ? 'active' : 'installing'
        } else {
          diag.serviceWorker = 'not registered'
        }
      } catch (err) {
        diag.serviceWorker = 'error'
      }
    } else {
      diag.serviceWorker = 'not supported'
    }
    
    // Check subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        diag.subscription = subscription ? 'subscribed' : 'not subscribed'
      } catch (err) {
        diag.subscription = 'error'
      }
    } else {
      diag.subscription = 'not supported'
    }
    
    setDiagnostics(diag)
    console.log('[push-toggle] Diagnostics:', diag)
  }

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
        // Use enable() which checks authentication before proceeding
        const enabled = await pushNotificationService.enable()
        
        if (enabled) {
          setIsSubscribed(true)
          setPushEnabled(true)
          toast({
            title: "✅ Push Notifications Enabled",
            description: "You'll receive instant alerts for important updates"
          })
        } else {
          throw new Error('Failed to enable push notifications')
        }
      } catch (error: any) {
        console.error('[push-toggle] Enable error:', error)
        toast({
          variant: "destructive",
          title: "❌ Enable Failed",
          description: error.message || 'Please log in and allow notifications in your browser settings'
        })
        setPushEnabled(false)
      } finally {
        setLoading(false)
      }
    } else {
      // Unsubscribe from push notifications
      try {
        await pushNotificationService.unsubscribe()
        setIsSubscribed(false)
        setPushEnabled(false)
        toast({
          title: "🔕 Notifications Disabled",
          description: "You can re-enable them anytime"
        })
      } catch (error: any) {
        console.error('[push-toggle] Unsubscribe error:', error)
        // Still update UI even if unsubscribe fails
        setPushEnabled(false)
        toast({
          title: "🔕 Notifications Paused",
          description: "You can re-enable them anytime"
        })
      }
    }
  }

  const testNotification = async () => {
    try {
      // First check if service worker is ready
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        console.log('[push-toggle] Service worker ready:', registration.scope)
        
        // Check current subscription
        const subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          toast({
            variant: "destructive",
            title: "❌ No Subscription",
            description: "Please enable push notifications first"
          })
          return
        }
        console.log('[push-toggle] Current subscription:', subscription.endpoint.substring(0, 50) + '...')
      }
      
      // Check notification permission
      if ('Notification' in window) {
        const permission = Notification.permission
        console.log('[push-toggle] Notification permission:', permission)
        
        if (permission !== 'granted') {
          toast({
            variant: "destructive",
            title: "❌ Permission Not Granted",
            description: `Current permission: ${permission}. Please allow notifications in browser settings.`
          })
          return
        }
      }
      
      // Try local notification first (service worker)
      try {
        await pushNotificationService.showNotification({
          title: '🔔 Test Notification',
          body: 'Push notifications are working perfectly!',
          icon: '/favicon/android-chrome-192x192.png',
          data: { type: 'test' }
        })
        console.log('[push-toggle] Local notification sent')
      } catch (localError) {
        console.warn('[push-toggle] Local notification failed, trying server push:', localError)
        
        // Fallback: Send via server
        const response = await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            payload: {
              title: '🔔 Test Notification',
              body: 'Push notifications are working perfectly!',
              icon: '/favicon/android-chrome-192x192.png',
              data: { type: 'test' }
            }
          })
        })
        
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.message || 'Failed to send test notification')
        }
        console.log('[push-toggle] Server push sent:', result)
      }
      
      toast({
        title: "✅ Test Sent",
        description: "Check your notifications. If you don't see it, check browser console for errors."
      })
    } catch (error: any) {
      console.error('[push-toggle] Test notification error:', error)
      toast({
        variant: "destructive",
        title: "❌ Test Failed",
        description: error.message || "Could not send test notification. Check console for details."
      })
    }
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Push Notifications</p>
            <p className="text-xs text-gray-600">Loading...</p>
          </div>
        </div>
      </Card>
    )
  }

  // Check if browser supports push notifications
  if (!pushNotificationService.isSupported()) {
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

  // Check for iOS Safari (limited support) - only after mounted
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isPWA = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

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

  // Check if permission is denied
  const permissionDenied = mounted && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied'
  const permissionDefault = mounted && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default'

  return (
    <Card className="p-4">
      {permissionDenied && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          ⚠️ Notifications are blocked. Please enable them in your browser settings.
        </div>
      )}
      
      {permissionDefault && !pushEnabled && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          💡 Click the toggle to enable push notifications. Your browser will ask for permission.
        </div>
      )}
      
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
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          <Button
            size="sm"
            variant="outline"
            onClick={testNotification}
            className="w-full h-9"
          >
            <Bell className="h-4 w-4 mr-2" />
            Send Test Notification
          </Button>
          
          {/* Diagnostics */}
          {diagnostics && (
            <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
              <div className="flex justify-between">
                <span>Permission:</span>
                <span className={diagnostics.permission === 'granted' ? 'text-green-600' : 'text-yellow-600'}>
                  {diagnostics.permission}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Service Worker:</span>
                <span className={diagnostics.serviceWorker === 'active' ? 'text-green-600' : 'text-yellow-600'}>
                  {diagnostics.serviceWorker}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Subscription:</span>
                <span className={diagnostics.subscription === 'subscribed' ? 'text-green-600' : 'text-yellow-600'}>
                  {diagnostics.subscription}
                </span>
              </div>
            </div>
          )}
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
