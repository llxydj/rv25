"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { AlertTriangle, MapPin, Phone, User, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

interface UserProfile {
  first_name: string
  last_name: string
  phone_number: string | null
  address: string | null
  barangay: string | null
}

export function SOSButton() {
  const { user } = useAuth()
  const { toast } = useToast()
  const pathname = usePathname()
  const [showModal, setShowModal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [sosStatus, setSosStatus] = useState<'sending' | 'success' | 'error'>('sending')
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return

      try {
        const { data, error } = await supabase
          .from('users')
          .select('first_name, last_name, phone_number, address, barangay')
          .eq('id', user.id)
          .single()

        if (error) throw error

        if (data) {
          setUserProfile({
            first_name: data.first_name,
            last_name: data.last_name,
            phone_number: data.phone_number,
            address: data.address,
            barangay: data.barangay
          })
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
        // Don't set fallback - let the component handle missing profile gracefully
        // The send button will be disabled if profile is missing
      }
    }

    if (user?.id) {
      fetchUserProfile()
    }
  }, [user?.id])

  // Get current location (returns a promise with location and optional address)
  const getCurrentLocation = (): Promise<{ lat: number; lng: number; address?: string }> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Location services are not available on this device'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          
          // Try to get address from coordinates (non-blocking, but we'll use it if available)
          let resolvedAddress: string | undefined = undefined
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'RVOIS/1.0'
                }
              }
            )
            const data = await response.json()
            if (data.display_name) {
              resolvedAddress = data.display_name
              setAddress(resolvedAddress) // Update state for UI display
            }
          } catch (err) {
            console.warn('Failed to get address from coordinates:', err)
            // Continue without address - not critical
          }
          
          resolve({ lat, lng, address: resolvedAddress })
        },
        (error) => {
          console.error('Geolocation error:', error)
          reject(new Error('Unable to get your location. Please enable location services.'))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  // Helper function to reset state
  const resetSOSState = () => {
    setShowModal(false)
    setIsProcessing(false)
    setLocation(null)
    setAddress(null)
    setLocationError(null)
    setSosStatus('sending')
    setGettingLocation(false)
  }

  // One-click SOS handler - immediately sends SOS on button click
  const handleSOSClick = async () => {
    // Prevent multiple clicks
    if (isProcessing) return

    // Clear any existing timer
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current)
      autoCloseTimerRef.current = null
    }

    // Validate user and profile
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please log in to use SOS feature."
      })
      return
    }

    if (!userProfile) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User information not available. Please try again."
      })
      return
    }

    // Show modal immediately
    setShowModal(true)
    setIsProcessing(true)
    setSosStatus('sending')
    setGettingLocation(true)
    setLocationError(null)

    try {
      // Get location (includes address if available)
      const locationData = await getCurrentLocation()
      setLocation({ lat: locationData.lat, lng: locationData.lng })
      setGettingLocation(false)

      // Use address from location data, fallback to user profile address, or GPS coordinates
      const currentAddress = locationData.address || userProfile.address || 'Location captured via GPS'
      const locationDescription = locationData.address || `${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`

      // Send SOS request immediately
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reporter_id: user.id,
          incident_type: 'EMERGENCY INCIDENT',
          description: `SOS ALERT: ${userProfile.first_name} ${userProfile.last_name} needs immediate assistance. Contact: ${userProfile.phone_number || 'Not provided'}. Location: ${locationDescription}`,
          location_lat: locationData.lat,
          location_lng: locationData.lng,
          address: currentAddress,
          barangay: (userProfile.barangay && userProfile.barangay.trim()) || 'UNKNOWN',
          priority: 1, // Highest priority for SOS - required for EMERGENCY INCIDENT
          photo_url: null,
          photo_urls: [], // Required array, empty for SOS
          voice_url: null
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        // Handle specific error codes
        let errorMessage = 'Failed to send SOS request'
        if (result.code === 'OUT_OF_BOUNDS') {
          errorMessage = 'Your location is outside Talisay City. Please ensure you are within the city limits.'
        } else if (result.code === 'CLASSIFICATION_MISMATCH') {
          errorMessage = 'Invalid incident classification. Please try again.'
        } else if (result.code === 'RATE_LIMITED') {
          errorMessage = 'Too many requests. Please wait a moment before trying again.'
        } else {
          errorMessage = result.message || errorMessage
        }
        throw new Error(errorMessage)
      }

      // Success
      setSosStatus('success')
      toast({
        title: "SOS Sent Successfully",
        description: "Your emergency request has been sent. Help is on the way!",
        duration: 5000
      })

      // Auto-close modal after 3 seconds
      autoCloseTimerRef.current = setTimeout(() => {
        resetSOSState()
      }, 3000)

    } catch (error: any) {
      console.error('SOS send error:', error)
      setSosStatus('error')
      setGettingLocation(false)
      
      // Set location error if it's a location-related error
      if (error.message && error.message.includes('location')) {
        setLocationError(error.message)
      }
      
      toast({
        variant: "destructive",
        title: "Failed to Send SOS",
        description: error.message || "Please try again or call emergency services directly."
      })

      // Auto-close modal after 4 seconds on error (give user time to see error)
      autoCloseTimerRef.current = setTimeout(() => {
        resetSOSState()
      }, 4000)
    }
  }

  // Cleanup timer on unmount or when modal closes
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current)
        autoCloseTimerRef.current = null
      }
    }
  }, [])

  // Cleanup timer when modal is manually closed or component unmounts
  useEffect(() => {
    if (!showModal && autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current)
      autoCloseTimerRef.current = null
    }
  }, [showModal])

  // Don't show if user is not a resident
  if (!user || user.role !== 'resident') {
    return null
  }

  // Don't show on report page (to avoid overlap with submit button)
  if (pathname?.startsWith('/resident/report')) {
    return null
  }

  return (
    <>
      {/* Floating SOS Button - positioned above emergency call button */}
      <div className="fixed right-6 bottom-32 md:bottom-24 z-50">
        <Button
          onClick={handleSOSClick}
          disabled={isProcessing}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          size="lg"
          aria-label="SOS Emergency"
        >
          <div className="flex flex-col items-center justify-center">
            {isProcessing ? (
              <Loader2 className="h-7 w-7 mb-0.5 animate-spin" />
            ) : (
              <>
                <AlertTriangle className="h-7 w-7 mb-0.5" />
                <span className="text-xs font-bold">SOS</span>
              </>
            )}
          </div>
        </Button>
      </div>

      {/* SOS Modal - Brief display that auto-closes */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="max-w-lg w-full shadow-2xl border-2 border-red-500 animate-in zoom-in-95 duration-200">
            <CardHeader className={`rounded-t-lg ${
              sosStatus === 'success' ? 'bg-green-600' : 
              sosStatus === 'error' ? 'bg-red-700' : 
              'bg-red-600'
            } text-white`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  {sosStatus === 'success' ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : sosStatus === 'error' ? (
                    <AlertTriangle className="h-6 w-6" />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">
                    {sosStatus === 'success' ? 'SOS Sent!' : 
                     sosStatus === 'error' ? 'SOS Failed' : 
                     'Sending SOS...'}
                  </CardTitle>
                  <CardDescription className={
                    sosStatus === 'success' ? 'text-green-100' : 
                    sosStatus === 'error' ? 'text-red-100' : 
                    'text-red-100'
                  }>
                    {sosStatus === 'success' ? 'Your emergency request has been sent' : 
                     sosStatus === 'error' ? 'Please try again or call emergency services' : 
                     'Processing your emergency request'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
              {/* User Information */}
              {userProfile && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Reporter
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {userProfile.first_name} {userProfile.last_name}
                      </span>
                    </div>
                    {userProfile.phone_number && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Phone:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {userProfile.phone_number}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location Status */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Location
                </h3>
                {gettingLocation ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Getting your location...
                    </span>
                  </div>
                ) : location ? (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Location captured</span>
                    </div>
                    {address && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 pl-7 line-clamp-2">
                        {address}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 pl-7">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                  </div>
                ) : locationError ? (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <p className="text-sm text-red-700 dark:text-red-300">{locationError}</p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Capturing location...
                    </p>
                  </div>
                )}
              </div>

              {/* Status Message */}
              {sosStatus === 'success' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium text-center">
                    ✓ Help is on the way! This window will close automatically.
                  </p>
                </div>
              )}

              {sosStatus === 'error' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium text-center">
                    ⚠️ Failed to send SOS. Please try again or call emergency services directly.
                  </p>
                </div>
              )}

              {/* Emergency Call Option - Always visible */}
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-2">
                  For immediate life-threatening emergencies, call:
                </p>
                <Button
                  onClick={() => window.location.href = 'tel:09998064555'}
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call Emergency Hotline: 09998064555
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

