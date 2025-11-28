// src/app/sw-register.tsx

"use client"

import { useEffect } from "react"

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || window.location.hostname === "localhost")
    ) {
      // Register the service worker (ENHANCED for persistence)
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none" // Always check for updates
        })
        .then(async (registration) => {
          console.log("[sw-register] Service worker registered:", registration.scope)
          
          // Wait for service worker to be ready before allowing push subscriptions
          try {
            await navigator.serviceWorker.ready
            console.log("[sw-register] Service worker ready for push notifications")
            
            // CRITICAL: Ensure service worker is active
            if (registration.active) {
              console.log("[sw-register] Service worker is active")
            } else if (registration.installing) {
              registration.installing.addEventListener("statechange", () => {
                if (registration.installing?.state === "activated") {
                  console.log("[sw-register] Service worker activated")
                }
              })
            }
          } catch (error) {
            console.warn("[sw-register] Service worker ready check failed:", error)
          }
          
          // Check for updates periodically (keeps service worker active for push notifications)
          // This ensures service worker stays active even when app is closed
          setInterval(() => {
            registration.update().catch((err) => {
              console.warn('[sw-register] Update check failed:', err)
            })
          }, 60000) // Check every minute
          
          // Register periodic background sync for keep-alive (if supported)
          if ('periodicSync' in registration && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
            try {
              // @ts-ignore - periodicSync may not be in types yet
              registration.periodicSync.register('keep-alive', {
                minInterval: 24 * 60 * 60 * 1000 // Once per day (keeps service worker active)
              }).then(() => {
                console.log('[sw-register] Periodic sync registered for keep-alive')
              }).catch((err) => {
                console.log('[sw-register] Periodic sync not supported:', err.message)
              })
            } catch (err) {
              // Periodic sync not supported, that's okay
              console.log('[sw-register] Periodic sync not available')
            }
          }
          
          // Handle update found
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[sw-register] New service worker version available")
                } else if (newWorker.state === "activated") {
                  // New service worker activated, reload page
                  window.location.reload()
                }
              })
            }
          })
          
          // Listen for push events from service worker (for debugging)
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'PUSH_RECEIVED') {
              console.log('[sw-register] Service worker received push event')
            }
          })
          
          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'INCIDENT_QUEUED') {
              console.log("[sw-register] Received incident queued message from service worker")
              window.dispatchEvent(new CustomEvent('incident-queued'))
            }
          })
        })
        .catch((error) => {
          console.error("[sw-register] Service worker registration failed:", error)
        })
    }
  }, [])

  return null
}
