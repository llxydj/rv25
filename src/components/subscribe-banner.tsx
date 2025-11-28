"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, X, AlertCircle } from "lucide-react"

export default function SubscribeBanner({ userId }: { userId?: string }) {
  const [supported, setSupported] = useState<boolean>(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState<boolean>(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(isSupported)
    
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }

    // Check if already subscribed
    if (isSupported && userId) {
      checkExistingSubscription()
    }

    // Check if dismissed in this session
    const wasDismissed = sessionStorage.getItem('notification-banner-dismissed')
    if (wasDismissed) {
      setDismissed(true)
    }
  }, [userId])

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          setSubscribed(true)
        }
      }
    } catch (e) {
      console.log('[subscribe-banner] Could not check existing subscription:', e)
    }
  }

  const registerServiceWorker = async () => {
    if (!supported) return null
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      return reg
    } catch (e) {
      console.error('Failed to register service worker', e)
      setError('Could not register service worker. Please refresh the page.')
      return null
    }
  }

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  const handleEnable = async () => {
    try {
      setBusy(true)
      setError(null)

      // Check if user is logged in
      if (!userId) {
        setError('Please log in to enable notifications.')
        return
      }

      const reg = await registerServiceWorker()
      if (!reg) return

      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        const p = await Notification.requestPermission()
        setPermission(p)
        if (p === 'denied') {
          setError('Notifications are blocked. Please enable them in your browser settings.')
          return
        }
        if (p !== 'granted') {
          setError('Notification permission was not granted.')
          return
        }
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapid) {
        console.error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY')
        setError('Push notifications are not configured. Please contact support.')
        return
      }

      // Subscribe to push notifications
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })

      // Extract keys for API (matching expected format)
      const subscriptionData = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!)
        }
      }

      // Save subscription to server
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscriptionData }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save subscription')
      }

      setSubscribed(true)
      console.log('[subscribe-banner] Successfully subscribed to notifications')
    } catch (e: any) {
      console.error('Failed to subscribe to notifications', e)
      setError(e.message || 'Failed to enable notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('notification-banner-dismissed', 'true')
  }

  // Don't show if not supported, already subscribed, or dismissed
  if (!supported || subscribed || dismissed) return null

  // Show blocked state
  if (permission === 'denied') {
    return (
      <div className="w-full">
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <BellOff className="h-4 w-4" />
              <span>Notifications are blocked. Enable them in your browser settings to receive alerts.</span>
            </div>
            <button onClick={handleDismiss} className="text-amber-700 hover:text-amber-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <Bell className="h-4 w-4" />
            <span>Enable notifications to get alerts for your incident reports and updates.</span>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span className="max-w-[200px] truncate">{error}</span>
              </div>
            )}
            <Button 
              variant="default" 
              size="sm"
              onClick={handleEnable} 
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {busy ? 'Enabling...' : 'Enable Notifications'}
            </Button>
            <button 
              onClick={handleDismiss} 
              className="text-blue-700 hover:text-blue-900 p-1"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
