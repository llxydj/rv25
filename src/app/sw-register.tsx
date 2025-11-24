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
        .then((registration) => {
          console.log("SW registered:", registration.scope)
          
          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New content is available, show update prompt if needed
                  console.log("New content is available; please refresh.")
                }
              })
            }
          })
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'INCIDENT_QUEUED') {
              // Broadcast a custom event; pages can show toasts accordingly
              window.dispatchEvent(new CustomEvent('incident-queued'))
            }
          })
        })
        .catch((error) => {
          console.error("SW registration failed:", error)
        })
    }
  }, [])

  return null
}
