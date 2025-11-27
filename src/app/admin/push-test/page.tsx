"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { pushNotificationService } from "@/lib/push-notification-service"
import { supabase } from "@/lib/supabase"

export default function PushTestPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [user])

  const checkStatus = async () => {
    const diag: any = {
      browserSupport: false,
      permission: 'unknown',
      serviceWorker: 'unknown',
      subscription: null,
      subscriptionInDb: null,
      errors: []
    }

    // Check browser support
    diag.browserSupport = pushNotificationService.isSupported()
    
    // Check notification permission
    if ('Notification' in window) {
      diag.permission = Notification.permission
    }

    // Check service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          diag.serviceWorker = {
            active: !!registration.active,
            installing: !!registration.installing,
            waiting: !!registration.waiting,
            scope: registration.scope
          }
          
          // Check subscription
          if (registration.pushManager) {
            try {
              const subscription = await registration.pushManager.getSubscription()
              diag.subscription = subscription ? {
                endpoint: subscription.endpoint.substring(0, 50) + '...',
                hasKeys: !!subscription.getKey('p256dh') && !!subscription.getKey('auth')
              } : null
            } catch (err: any) {
              diag.errors.push(`Subscription check error: ${err.message}`)
            }
          }
        } else {
          diag.serviceWorker = 'not registered'
        }
      } catch (err: any) {
        diag.serviceWorker = 'error'
        diag.errors.push(`Service worker error: ${err.message}`)
      }
    }

    // Check subscription in database
    if (user?.id) {
      try {
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('endpoint, created_at')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (error && error.code !== 'PGRST116') {
          diag.errors.push(`DB query error: ${error.message}`)
        } else if (data) {
          diag.subscriptionInDb = {
            endpoint: data.endpoint?.substring(0, 50) + '...',
            created: data.created_at
          }
        }
      } catch (err: any) {
        diag.errors.push(`DB check error: ${err.message}`)
      }
    }

    setStatus(diag)
  }

  const testPush = async () => {
    setTesting(true)
    try {
      // Get current subscription
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        
        if (!subscription) {
          alert('No subscription found. Please enable push notifications first.')
          setTesting(false)
          return
        }

        // Send test notification via server
        const response = await fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            payload: {
              title: '🔔 Test Push Notification',
              body: 'If you see this, push notifications are working!',
              icon: '/favicon/android-chrome-192x192.png',
              badge: '/favicon/android-chrome-192x192.png',
              tag: 'test-notification',
              data: {
                type: 'test',
                timestamp: Date.now()
              },
              requireInteraction: true,
              vibrate: [200, 100, 200]
            }
          })
        })

        const result = await response.json()
        if (result.success) {
          alert('✅ Test notification sent! Check your browser notifications.')
        } else {
          alert(`❌ Failed: ${result.message}`)
        }
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
      console.error('Test push error:', error)
    } finally {
      setTesting(false)
    }
  }

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      alert(`Permission: ${permission}`)
      checkStatus()
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Push Notification Diagnostics</h1>

      {status && (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Status Check</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Browser Support:</span>
                <span className={status.browserSupport ? 'text-green-600' : 'text-red-600'}>
                  {status.browserSupport ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Notification Permission:</span>
                <span className={
                  status.permission === 'granted' ? 'text-green-600' :
                  status.permission === 'denied' ? 'text-red-600' :
                  'text-yellow-600'
                }>
                  {status.permission === 'granted' ? '✅ Granted' :
                   status.permission === 'denied' ? '❌ Denied' :
                   status.permission === 'default' ? '⚠️ Not Set' :
                   '❓ Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Service Worker:</span>
                <span className={
                  typeof status.serviceWorker === 'object' && status.serviceWorker.active ? 'text-green-600' :
                  status.serviceWorker === 'not registered' ? 'text-red-600' :
                  'text-yellow-600'
                }>
                  {typeof status.serviceWorker === 'object' && status.serviceWorker.active ? '✅ Active' :
                   typeof status.serviceWorker === 'object' ? '⚠️ Installing' :
                   status.serviceWorker}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Push Subscription:</span>
                <span className={status.subscription ? 'text-green-600' : 'text-red-600'}>
                  {status.subscription ? '✅ Subscribed' : '❌ Not Subscribed'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Subscription in DB:</span>
                <span className={status.subscriptionInDb ? 'text-green-600' : 'text-yellow-600'}>
                  {status.subscriptionInDb ? '✅ Found' : '⚠️ Not Found'}
                </span>
              </div>
            </div>
          </Card>

          {status.errors.length > 0 && (
            <Card className="p-4 bg-red-50 border-red-200">
              <h3 className="font-semibold text-red-900 mb-2">Errors:</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {status.errors.map((err: string, i: number) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex gap-2">
            {status.permission !== 'granted' && (
              <Button onClick={requestPermission} variant="outline">
                Request Permission
              </Button>
            )}
            <Button onClick={testPush} disabled={testing || !status.subscription}>
              <Bell className="h-4 w-4 mr-2" />
              {testing ? 'Sending...' : 'Send Test Notification'}
            </Button>
            <Button onClick={checkStatus} variant="outline">
              Refresh Status
            </Button>
          </div>

          {status.subscription && (
            <Card className="p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">Subscription Details:</h3>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(status.subscription, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

