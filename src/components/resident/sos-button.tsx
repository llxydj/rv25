"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { AlertTriangle, MapPin, Phone, User, Loader2, CheckCircle, X } from "lucide-react"
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
  const [isSending, setIsSending] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)

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

  // Get current location
  const getCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Location services are not available on this device')
      return
    }

    setGettingLocation(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setLocation({ lat, lng })
        setGettingLocation(false)

        // Try to get address from coordinates
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
            setAddress(data.display_name)
          }
        } catch (err) {
          console.warn('Failed to get address from coordinates:', err)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        setLocationError('Unable to get your location. Please enable location services.')
        setGettingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  // Open SOS modal
  const handleSOSClick = () => {
    setShowModal(true)
    // Automatically get location when modal opens
    if (!location) {
      getCurrentLocation()
    }
  }

  // Send SOS request
  const handleSendSOS = async () => {
    if (!user?.id || !userProfile) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User information not available. Please try again."
      })
      return
    }

    if (!location) {
      toast({
        variant: "destructive",
        title: "Location Required",
        description: "Please wait for location to be captured, or enable location services."
      })
      return
    }

    setIsSending(true)

    try {
      // Create emergency incident
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reporter_id: user.id,
          incident_type: 'EMERGENCY INCIDENT',
          description: `SOS ALERT: ${userProfile.first_name} ${userProfile.last_name} needs immediate assistance. Contact: ${userProfile.phone_number || 'Not provided'}. Location: ${address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}`,
          location_lat: location.lat,
          location_lng: location.lng,
          address: address || userProfile.address || 'Location captured via GPS',
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
        if (result.code === 'OUT_OF_BOUNDS') {
          throw new Error('Your location is outside Talisay City. Please ensure you are within the city limits.')
        } else if (result.code === 'CLASSIFICATION_MISMATCH') {
          throw new Error('Invalid incident classification. Please try again.')
        } else if (result.code === 'RATE_LIMITED') {
          throw new Error('Too many requests. Please wait a moment before trying again.')
        }
        throw new Error(result.message || 'Failed to send SOS request')
      }

      toast({
        title: "SOS Sent Successfully",
        description: "Your emergency request has been sent. Help is on the way!",
        duration: 5000
      })

      setShowModal(false)
      
      // Reset state
      setLocation(null)
      setAddress(null)
      setLocationError(null)
    } catch (error: any) {
      console.error('SOS send error:', error)
      toast({
        variant: "destructive",
        title: "Failed to Send SOS",
        description: error.message || "Please try again or call emergency services directly."
      })
    } finally {
      setIsSending(false)
    }
  }

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
          className="bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          size="lg"
          aria-label="SOS Emergency"
        >
          <div className="flex flex-col items-center justify-center">
            <AlertTriangle className="h-7 w-7 mb-0.5" />
            <span className="text-xs font-bold">SOS</span>
          </div>
        </Button>
      </div>

      {/* SOS Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <Card className="max-w-lg w-full shadow-2xl border-2 border-red-500">
            <CardHeader className="bg-red-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-full">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold">SOS Emergency</CardTitle>
                    <CardDescription className="text-red-100">
                      Immediate assistance request
                    </CardDescription>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-red-200 transition-colors"
                  aria-label="Close"
                  disabled={isSending}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
              {/* User Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Your Information
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Phone:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {userProfile?.phone_number || 'Not provided'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Address:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-right">
                      {userProfile?.address || 'Not provided'}
                    </span>
                  </div>
                  {userProfile?.barangay && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Barangay:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {userProfile.barangay}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Status */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Current Location
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
                      <p className="text-xs text-gray-600 dark:text-gray-400 pl-7">
                        {address}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 pl-7">
                      Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                  </div>
                ) : locationError ? (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <p className="text-sm text-red-700 dark:text-red-300">{locationError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={getCurrentLocation}
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Location not captured yet. Please wait...
                    </p>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  ⚠️ This will send an emergency alert to the response team. Only use in genuine emergencies.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendSOS}
                  disabled={isSending || !location || !userProfile}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Send SOS
                    </>
                  )}
                </Button>
              </div>

              {/* Emergency Call Option */}
              <div className="pt-4 border-t">
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

