"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface PinGuardProps {
  children: React.ReactNode
}

export function PinGuard({ children }: PinGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [needsPin, setNeedsPin] = useState(false)

  // Skip PIN check for these routes
  const skipRoutes = ['/pin/setup', '/pin/verify', '/login', '/auth/callback', '/unauthorized']

  useEffect(() => {
    const checkPinStatus = async () => {
      // Skip check for certain routes
      if (skipRoutes.some(route => pathname.startsWith(route))) {
        setChecking(false)
        return
      }

      try {
        const res = await fetch('/api/pin/status')
        const json = await res.json()

        if (!json.success) {
          console.error('Failed to check PIN status:', json.message)
          setChecking(false)
          return
        }

        // Excluded users (barangay) don't need PIN
        if (json.excluded) {
          setChecking(false)
          return
        }

        // Check if PIN is enabled and needs setup (including expired PINs)
        if (json.needsSetup || json.pinExpired) {
          // Redirect to PIN setup
          const currentPath = pathname + (window.location.search || '')
          const expiredParam = json.pinExpired ? '&expired=true' : ''
          router.push(`/pin/setup?redirect=${encodeURIComponent(currentPath)}${expiredParam}`)
          return
        }

        // Check if PIN is enabled and set
        if (json.enabled && json.hasPin) {
          // Check if account is locked
          if (json.isLocked) {
            router.push(`/pin/verify?redirect=${encodeURIComponent(pathname)}`)
            return
          }

          // Check PIN verification cookie via API (can't read HTTP-only cookies in client)
          try {
            const verifyRes = await fetch('/api/pin/check-verified', {
              credentials: 'include'
            })
            const verifyJson = await verifyRes.json()
            
            if (verifyJson.verified) {
              // PIN is verified, allow access
              setChecking(false)
              return
            } else {
              // PIN not verified, redirect to verify page
              router.push(`/pin/verify?redirect=${encodeURIComponent(pathname)}`)
              return
            }
          } catch (verifyError) {
            console.error('[PIN Guard] Error checking PIN verification:', verifyError)
            // If verification check fails, redirect to verify page for safety
            router.push(`/pin/verify?redirect=${encodeURIComponent(pathname)}`)
            return
          }
        } else {
          // PIN is disabled or not set
          setChecking(false)
        }
      } catch (error) {
        console.error('Error checking PIN status:', error)
        setChecking(false)
      }
    }

    checkPinStatus()
  }, [pathname, router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Verifying security..." />
      </div>
    )
  }

  return <>{children}</>
}

