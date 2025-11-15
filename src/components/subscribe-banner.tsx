"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export default function SubscribeBanner({ userId }: { userId?: string }) {
  const [supported, setSupported] = useState<boolean>(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState<boolean>(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const registerServiceWorker = async () => {
    if (!supported) return null
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js')
      await navigator.serviceWorker.ready
      return reg
    } catch (e) {
      console.error('Failed to register service worker', e)
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

  const handleEnable = async () => {
    try {
      setBusy(true)
      const reg = await registerServiceWorker()
      if (!reg) return

      if (permission !== 'granted') {
        const p = await Notification.requestPermission()
        setPermission(p)
        if (p !== 'granted') return
      }

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapid) {
        console.warn('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY')
        return
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })

      // Save subscription
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId || null, subscription }),
      })

      setSubscribed(true)
    } catch (e) {
      console.error('Failed to subscribe to notifications', e)
    } finally {
      setBusy(false)
    }
  }

  if (!supported || subscribed) return null

  return (
    <div className="w-full">
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-blue-900">
            Enable notifications to get alerts for new incidents and updates.
          </div>
          <div className="flex items-center gap-2">
            {permission !== 'granted' && (
              <Button variant="default" onClick={handleEnable} disabled={busy}>
                {busy ? 'Enabling...' : 'Enable Notifications'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
