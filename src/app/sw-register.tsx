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
      // Register the service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (registration) => {
          console.log("[sw-register] Service worker registered:", registration.scope)
          
          // Wait for service worker to be ready before allowing push subscriptions
          try {
            await navigator.serviceWorker.ready
            console.log("[sw-register] Service worker ready for push notifications")
          } catch (error) {
            console.warn("[sw-register] Service worker ready check failed:", error)
          }
          
          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New content is available, show update prompt if needed
                  console.log("[sw-register] New service worker version available; please refresh.")
                }
              })
            }
          })
          
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'INCIDENT_QUEUED') {
              console.log("[sw-register] Received incident queued message from service worker")
              // Broadcast a custom event; pages can show toasts accordingly
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
