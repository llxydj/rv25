"use client"

import { useState, useEffect } from "react"
import { MapPin, Activity, BatteryCharging, AlertCircle, Bell, BellOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { LocationTrackingService } from "@/lib/location-tracking"
import { backgroundLocationService } from "@/lib/background-location-service"
import { pushNotificationService } from "@/lib/push-notification-service"
import { useToast } from "@/components/ui/use-toast"

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: Date
}

export function LocationTrackingToggle() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isTracking, setIsTracking] = useState(false)
  const [locationService] = useState(() => LocationTrackingService.getInstance())
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [backgroundTracking, setBackgroundTracking] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  // Load tracking state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('location-tracking-enabled')
    const savedBgTracking = localStorage.getItem('background-tracking-enabled')
    const savedPushEnabled = localStorage.getItem('push-notifications-enabled')
    
    if (savedState === 'true') {
      handleEnableTracking()
    }
    
    if (savedBgTracking === 'true') {
      setBackgroundTracking(true)
    }
    
    if (savedPushEnabled === 'true') {
      setPushEnabled(true)
      // Initialize push notifications (will check auth inside)
      pushNotificationService.initialize().catch((error) => {
        console.error('[location-toggle] Failed to initialize push notifications:', error)
        // If auth fails, don't enable push
        if (error.message?.includes('logged in')) {
          setPushEnabled(false)
          localStorage.removeItem('push-notifications-enabled')
        }
      })
    }

    // Check permission status
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt')
        
        result.addEventListener('change', () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt')
        })
      })
    }
  }, [])

  const handleEnableTracking = async () => {
    if (!user?.id) {
      setError('You must be logged in to enable location tracking')
      return
    }

    try {
      setError(null)
      
      // Initialize the location service first
      const initialized = await locationService.initialize(user.id)
      if (!initialized) {
        throw new Error('Location tracking is disabled in preferences or not supported')
      }

      // Add listener for location updates
      locationService.addLocationListener((location) => {
        setCurrentLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp
        })
      })

      // Start tracking
      const started = await locationService.startTracking()

      if (started) {
        setIsTracking(true)
        localStorage.setItem('location-tracking-enabled', 'true')
        
        // Start background tracking if enabled
        if (backgroundTracking) {
          await startBackgroundTracking()
        }
        
        toast({
          title: "Location Sharing Enabled",
          description: "Your location is now being shared with the admin team.",
          duration: 3000
        })
      } else {
        throw new Error('Failed to start location tracking')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enable location tracking')
      setIsTracking(false)
      localStorage.removeItem('location-tracking-enabled')
      
      // Enhanced error handling for specific error codes
      let errorTitle = "Location Sharing Failed"
      let errorDescription = err.message || 'Please check your location permissions'
      
      if (err.message?.includes('OUT_OF_BOUNDS')) {
        errorTitle = "Location Out of Bounds"
        errorDescription = "You appear to be outside Talisay City service area. Please ensure you're within the coverage zone."
      } else if (err.message?.includes('ACCURACY_TOO_LOW')) {
        errorTitle = "GPS Signal Too Weak"
        errorDescription = "Your GPS accuracy is too low. Please move to an open area with better signal."
      } else if (err.message?.includes('BOUNDARY_VALIDATION_FAILED')) {
        errorTitle = "Validation Error"
        errorDescription = "Unable to verify your location. Please check your internet connection and try again."
      }
      
      toast({
        variant: "destructive",
        title: errorTitle,
        description: errorDescription,
        duration: 5000
      })
    }
  }

  const startBackgroundTracking = async () => {
    try {
      await backgroundLocationService.startTracking({
        updateInterval: 30000, // 30 seconds
        highAccuracy: true,
        onUpdate: (location) => {
          console.log('[bg-location] Update:', location)
        },
        onError: (error) => {
          console.error('[bg-location] Error:', error)
          toast({
            variant: "destructive",
            title: "Background Tracking Error",
            description: error
          })
        }
      })
      
      toast({
        title: "Background Tracking Enabled",
        description: "Location updates every 30 seconds",
        duration: 3000
      })
    } catch (error: any) {
      console.error('[bg-location] Failed to start:', error)
    }
  }

  const handleDisableTracking = () => {
    locationService.stopTracking()
    
    // Stop background tracking
    if (backgroundLocationService.isActive()) {
      backgroundLocationService.stopTracking()
    }
    
    setIsTracking(false)
    setCurrentLocation(null)
    localStorage.removeItem('location-tracking-enabled')
    
    toast({
      title: "Location Sharing Disabled",
      description: "Your location is no longer being shared.",
      duration: 3000
    })
  }
  
  const handleBackgroundTrackingToggle = async (checked: boolean) => {
    setBackgroundTracking(checked)
    localStorage.setItem('background-tracking-enabled', String(checked))
    
    if (checked && isTracking) {
      await startBackgroundTracking()
    } else if (!checked) {
      backgroundLocationService.stopTracking()
      toast({
        title: "Background Tracking Disabled",
        description: "Manual location updates only"
      })
    }
  }
  
  const handlePushNotificationToggle = async (checked: boolean) => {
    if (checked) {
      try {
        // Use enable() which checks authentication before proceeding
        const enabled = await pushNotificationService.enable()
        if (enabled) {
          setPushEnabled(true)
          localStorage.setItem('push-notifications-enabled', 'true')
          toast({
            title: "Push Notifications Enabled",
            description: "You'll receive instant assignment alerts"
          })
        } else {
          throw new Error('Failed to enable notifications')
        }
      } catch (error: any) {
        console.error('[location-toggle] Push notification enable error:', error)
        setPushEnabled(false)
        localStorage.removeItem('push-notifications-enabled')
        toast({
          variant: "destructive",
          title: "Notification Error",
          description: error.message || 'Please log in and allow notifications in your browser settings'
        })
      }
    } else {
      // Unsubscribe from push notifications
      try {
        await pushNotificationService.unsubscribe()
        setPushEnabled(false)
        localStorage.removeItem('push-notifications-enabled')
        toast({
          title: "Push Notifications Disabled",
          description: "You'll only receive in-app notifications"
        })
      } catch (error: any) {
        console.error('[location-toggle] Push notification unsubscribe error:', error)
        // Still update UI even if unsubscribe fails
        setPushEnabled(false)
        localStorage.removeItem('push-notifications-enabled')
        toast({
          title: "Push Notifications Disabled",
          description: "You'll only receive in-app notifications"
        })
      }
    }
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await handleEnableTracking()
    } else {
      handleDisableTracking()
    }
  }

  const getAccuracyLevel = (accuracy: number): { level: string; color: string } => {
    if (accuracy < 10) return { level: 'Excellent', color: 'bg-green-500' }
    if (accuracy < 20) return { level: 'Good', color: 'bg-blue-500' }
    if (accuracy < 50) return { level: 'Fair', color: 'bg-yellow-500' }
    return { level: 'Poor', color: 'bg-red-500' }
  }

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        {/* Mobile-optimized header with larger touch targets */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <MapPin className="h-6 w-6 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
            <CardTitle className="text-lg sm:text-xl truncate">Location Sharing</CardTitle>
          </div>
          {/* Larger switch for mobile - min 44x44px touch target */}
          <div className="flex-shrink-0">
            <Switch
              checked={isTracking}
              onCheckedChange={handleToggle}
              disabled={permissionStatus === 'denied'}
              className="scale-125 sm:scale-100"
              aria-label="Toggle location sharing"
            />
          </div>
        </div>
        <CardDescription className="text-sm sm:text-base leading-relaxed">
          {isTracking
            ? "Your location is being shared with the admin team"
            : "Enable to share your location for emergency response coordination"
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {permissionStatus === 'denied' && (
          <div className="flex items-start gap-3 p-4 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-6 w-6 sm:h-5 sm:w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-sm font-medium text-red-900">Location Permission Denied</p>
              <p className="text-sm sm:text-xs text-red-700 mt-1 leading-relaxed">
                Please enable location permissions in your browser settings to use this feature.
              </p>
            </div>
          </div>
        )}

        {error && !isTracking && (
          <div className="flex items-start gap-3 p-4 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-6 w-6 sm:h-5 sm:w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm sm:text-sm font-medium text-yellow-900">Error</p>
              <p className="text-sm sm:text-xs text-yellow-700 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {isTracking && currentLocation && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600 animate-pulse" />
                <span className="text-sm font-medium text-green-900">Active</span>
              </div>
              <Badge variant="outline" className="bg-white">
                {getAccuracyLevel(currentLocation.accuracy).level}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Accuracy</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${getAccuracyLevel(currentLocation.accuracy).color}`} />
                  <p className="text-sm font-medium text-gray-900">
                    ±{currentLocation.accuracy.toFixed(0)}m
                  </p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Last Update</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatTimestamp(currentLocation.timestamp)}
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <BatteryCharging className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-blue-900">Battery Optimization</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Updates only when you move more than 10 meters to save battery
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              <span>
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </span>
            </div>
          </div>
        )}

        {isTracking && !currentLocation && (
          <div className="flex items-center justify-center p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Getting your location...</p>
            </div>
          </div>
        )}

        {!isTracking && !error && permissionStatus !== 'denied' && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              When enabled, your real-time location will be visible to admins for emergency response coordination.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              <li>• Updates only when you move</li>
              <li>• Battery optimized tracking</li>
              <li>• Can be disabled anytime</li>
              <li>• Secure and encrypted</li>
            </ul>
          </div>
        )}
        
        {/* Advanced Options */}
        {isTracking && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900">Advanced Options</h3>
            
            {/* Background Tracking */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">Background Tracking</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Auto-update location every 30 seconds
                </p>
              </div>
              <Switch
                checked={backgroundTracking}
                onCheckedChange={handleBackgroundTrackingToggle}
                className="scale-110"
              />
            </div>
            
            {/* Push Notifications */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {pushEnabled ? (
                    <Bell className="h-4 w-4 text-green-600" />
                  ) : (
                    <BellOff className="h-4 w-4 text-gray-600" />
                  )}
                  <span className="text-sm font-medium text-gray-900">Push Notifications</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Instant alerts for new assignments
                </p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={handlePushNotificationToggle}
                className="scale-110"
              />
            </div>
            
            {pushEnabled && pushNotificationService.isSupported() && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800">
                  ✅ You'll receive instant notifications when assigned to incidents
                </p>
              </div>
            )}
            
            {!pushNotificationService.isSupported() && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  ⚠️ Push notifications not supported on this browser
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
