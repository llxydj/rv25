"use client"

import type React from "react"
import { AuthProvider } from "@/hooks/use-auth"
import { Toaster } from "@/components/ui/toaster"
import GeoPolygonLoader from "@/components/geo-polygon-loader"
import { PWAInstallPromptEnhanced } from "@/components/pwa-install-prompt-enhanced"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { PinSecurityGate } from "@/components/pin-security-gate"

export function AppClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* <ServiceWorkerRegistration /> */}
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
