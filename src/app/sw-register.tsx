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
          
          // Check for updates periodically (keeps service worker active)
          setInterval(() => {
            registration.update()
          }, 60000) // Check every minute
          
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
