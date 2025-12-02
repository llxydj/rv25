"use client"

import type React from "react"
import { useEffect } from "react"
import { AuthProvider } from "@/hooks/use-auth"
import { Toaster } from "@/components/ui/toaster"
import GeoPolygonLoader from "@/components/geo-polygon-loader"
import { PWAInstallPromptEnhanced } from "@/components/pwa-install-prompt-enhanced"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { PinSecurityGate } from "@/components/pin-security-gate"

// Global chunk loading error handler
function ChunkErrorHandler() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const error = event.error || event.message || ''
      const errorString = String(error)
      
      // Check if it's a chunk loading error
      if (
        errorString.includes('chunk') ||
        errorString.includes('Loading chunk') ||
        errorString.includes('Failed to fetch dynamically imported module') ||
        errorString.includes('Importing a module script failed')
      ) {
        console.error('Chunk loading error detected:', errorString)
        
        // Auto-retry once silently, then show user prompt
        const retryCount = sessionStorage.getItem('chunkRetryCount') || '0'
        const retryNum = parseInt(retryCount, 10)
        
        if (retryNum < 1) {
          // First retry: silent reload
          sessionStorage.setItem('chunkRetryCount', '1')
          setTimeout(() => {
            window.location.reload()
          }, 1000)
          return
        }
        
        // After first retry, show user prompt
        const shouldReload = confirm(
          'A loading error occurred. Would you like to refresh the page?'
        )
        
        if (shouldReload) {
          sessionStorage.removeItem('chunkRetryCount')
          // Clear cache and reload
          if ('caches' in window) {
            caches.keys().then((names) => {
              names.forEach((name) => {
                caches.delete(name)
              })
            })
          }
          window.location.reload()
        } else {
          sessionStorage.removeItem('chunkRetryCount')
        }
      }
    }

    // Listen for unhandled errors
    window.addEventListener('error', handleChunkError)
    
    // Also listen for unhandled promise rejections (common with dynamic imports)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason || '')
      if (
        reason.includes('chunk') ||
        reason.includes('Loading chunk') ||
        reason.includes('Failed to fetch dynamically imported module')
      ) {
        console.error('Chunk loading promise rejection:', reason)
        event.preventDefault() // Prevent default browser error handling
        
        const retryCount = sessionStorage.getItem('chunkRetryCount') || '0'
        const retryNum = parseInt(retryCount, 10)
        
        if (retryNum < 1) {
          sessionStorage.setItem('chunkRetryCount', '1')
          setTimeout(() => {
            window.location.reload()
          }, 1000)
          return
        }
        
        const shouldReload = confirm(
          'A loading error occurred. Would you like to refresh the page?'
        )
        
        if (shouldReload) {
          sessionStorage.removeItem('chunkRetryCount')
          if ('caches' in window) {
            caches.keys().then((names) => {
              names.forEach((name) => {
                caches.delete(name)
              })
            })
          }
          window.location.reload()
        } else {
          sessionStorage.removeItem('chunkRetryCount')
        }
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleChunkError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}

export function AppClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* <ServiceWorkerRegistration /> */}
      <ChunkErrorHandler />
      {/* PIN Security Gate - automatically skips for residents */}
      <PinSecurityGate>
        <GeoPolygonLoader />
        {children}
        <PWAInstallPromptEnhanced />
        <EmergencyCallButtonEnhanced />
        <Toaster />
      </PinSecurityGate>
    </AuthProvider>
  )
}
