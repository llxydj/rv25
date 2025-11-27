"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin, Navigation, Settings, X, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { locationTrackingService, LocationData } from "@/lib/location-tracking"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth"

interface LocationTrackerProps {
  onLocationUpdate?: (location: LocationData) => void
  showSettings?: boolean
  className?: string
}

export function LocationTracker({ onLocationUpdate, showSettings = true, className = "" }: LocationTrackerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isTracking, setIsTracking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [preferences, setPreferences] = useState({ enabled: false, accuracy: 'medium' })
  const [loading, setLoading] = useState(false)
  const locationListenerRef = useRef<((location: LocationData) => void) | null>(null)

  useEffect(() => {
    console.log("LocationTracker useEffect called", { user });
    if (!user) return;

    const initializeLocationTracking = async () => {
      console.log("Initializing location tracking");
      setLoading(true);
      
      try {
        // Check if geolocation is supported
        const supported = locationTrackingService.isSupported();
        setIsSupported(supported);
        console.log("Geolocation supported:", supported);
        
        if (!supported) {
          setLoading(false);
          return;
        }

        // Check permission status first (without requesting)
        const hasPerm = await locationTrackingService.checkPermission();
        setHasPermission(hasPerm);
        console.log("Location permission status:", hasPerm);
        
        // If permission is not granted, try requesting it
        if (!hasPerm) {
          const permission = await locationTrackingService.requestPermission();
          setHasPermission(permission);
          console.log("Location permission after request:", permission);
        }

        if (!permission) {
          setLoading(false);
          return;
        }

        // Initialize the service
        const initialized = await locationTrackingService.initialize(user.id);
        console.log("Location tracking initialized:", initialized);
        if (!initialized) {
          setLoading(false);
          return;
        }

        // Load preferences
        const prefs = await locationTrackingService.getLocationPreferences(user.id);
        setPreferences(prefs);
        console.log("Location preferences:", prefs);

        // Set up location listener
        locationListenerRef.current = (location: LocationData) => {
          console.log("Location listener called:", location);
          setCurrentLocation(location);
          onLocationUpdate?.(location);
        }
        locationTrackingService.addLocationListener(locationListenerRef.current);

        // If tracking is enabled, start it
        if (prefs.enabled) {
          console.log("Starting location tracking");
          const started = await locationTrackingService.startTracking();
          setIsTracking(started);
          console.log("Location tracking started:", started);
          
          // Try to get current location immediately
          if (started) {
            console.log("Getting initial position");
            // Get current position once when tracking starts
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log("Initial position acquired:", position);
                const locationData: LocationData = {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  timestamp: new Date(position.timestamp),
                  heading: position.coords.heading || undefined,
                  speed: position.coords.speed || undefined
                };
                setCurrentLocation(locationData);
                onLocationUpdate?.(locationData);
              },
              (error) => {
                console.warn('Failed to get initial position:', error);
              },
              { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
            );
          }
        } else {
          console.log("Location tracking disabled, getting current position once");
          // Even if tracking is disabled, try to get current location once
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log("Current position acquired:", position);
              const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(position.timestamp),
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined
              };
              setCurrentLocation(locationData);
              onLocationUpdate?.(locationData);
            },
            (error) => {
              console.warn('Failed to get current position:', error);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }

      } catch (error) {
        console.error('Failed to initialize location tracking:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to initialize location tracking"
        });
      } finally {
        setLoading(false);
      }
    };

    initializeLocationTracking();

    return () => {
      console.log("Cleaning up location tracker");
      if (locationListenerRef.current) {
        locationTrackingService.removeLocationListener(locationListenerRef.current);
      }
      locationTrackingService.stopTracking();
    };
  }, [user, onLocationUpdate, toast])

  const handleToggleTracking = async () => {
    if (!user) return

    try {
      if (isTracking) {
        locationTrackingService.stopTracking()
        setIsTracking(false)
        toast({
          title: "Location Tracking Stopped",
          description: "Your location is no longer being tracked"
        })
      } else {
        const started = await locationTrackingService.startTracking()
        if (started) {
          setIsTracking(true)
          toast({
            title: "Location Tracking Started",
            description: "Your location is now being tracked"
          })
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to start location tracking"
          })
        }
      }
    } catch (error) {
      console.error('Failed to toggle location tracking:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to toggle location tracking"
      })
    }
  }

  const handleUpdatePreferences = async (newPreferences: { enabled: boolean; accuracy: string }) => {
    if (!user) return

    try {
      await locationTrackingService.updateLocationPreferences(user.id, newPreferences)
      setPreferences(newPreferences)
      
      // If enabling tracking, start it
      if (newPreferences.enabled && !isTracking) {
        const started = await locationTrackingService.startTracking()
        setIsTracking(started)
      } else if (!newPreferences.enabled && isTracking) {
        locationTrackingService.stopTracking()
        setIsTracking(false)
      }

      toast({
        title: "Preferences Updated",
        description: "Location tracking preferences have been updated"
      })
    } catch (error) {
      console.error('Failed to update preferences:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update preferences"
      })
    }
  }

  if (!isSupported) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">Location tracking is not supported on this device</span>
        </div>
      </Card>
    )
  }

  if (!hasPermission) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span className="text-sm text-gray-700">Location permission required</span>
          </div>
          <Button
            size="sm"
            onClick={async () => {
              setLoading(true);
              const granted = await locationTrackingService.requestPermission();
              setHasPermission(granted);
              setLoading(false);
              if (granted) {
                toast({
                  title: "Permission Granted",
                  description: "Location access has been granted. Getting your location..."
                });
                // Re-initialize location tracking after permission is granted
                if (user) {
                  const initialized = await locationTrackingService.initialize(user.id);
                  if (initialized) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        const locationData: LocationData = {
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude,
                          accuracy: position.coords.accuracy,
                          timestamp: new Date(position.timestamp),
                          heading: position.coords.heading || undefined,
                          speed: position.coords.speed || undefined
                        };
                        setCurrentLocation(locationData);
                        onLocationUpdate?.(locationData);
                      },
                      (error) => {
                        console.warn('Failed to get position after permission grant:', error);
                      },
                      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
                    );
                  }
                }
              } else {
                toast({
                  variant: "destructive",
                  title: "Permission Denied",
                  description: "Location access is required to use this feature. Please enable it in your browser settings."
                });
              }
            }}
            disabled={loading}
          >
            {loading ? "Requesting..." : "Grant Permission"}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-gray-900">Location Tracking</span>
        </div>
        <div className="flex items-center gap-2">
          {showSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettingsModal(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Switch
            checked={isTracking}
            onCheckedChange={handleToggleTracking}
            disabled={loading}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm text-gray-600">
              {isTracking ? 'Tracking active' : 'Tracking inactive'}
            </span>
          </div>

          {currentLocation && (
            <div className="text-xs text-gray-500 space-y-1">
              <div>Lat: {currentLocation.latitude.toFixed(6)}</div>
              <div>Lng: {currentLocation.longitude.toFixed(6)}</div>
              <div>Accuracy: ±{Math.round(currentLocation.accuracy)}m</div>
              <div>Updated: {currentLocation.timestamp.toLocaleTimeString()}</div>
            </div>
          )}

          {!currentLocation && isTracking && (
            <div className="text-xs text-gray-500">
              Getting your location...
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <LocationSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          preferences={preferences}
          onUpdate={handleUpdatePreferences}
        />
      )}
    </Card>
  )
}

interface LocationSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  preferences: { enabled: boolean; accuracy: string }
  onUpdate: (preferences: { enabled: boolean; accuracy: string }) => void
}

function LocationSettingsModal({ isOpen, onClose, preferences, onUpdate }: LocationSettingsModalProps) {
  const [localPreferences, setLocalPreferences] = useState(preferences)

  useEffect(() => {
    setLocalPreferences(preferences)
  }, [preferences])

  const handleSave = () => {
    onUpdate(localPreferences)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white rounded-lg shadow-xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Location Settings</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Enable Location Tracking</p>
                <p className="text-xs text-gray-500">Allow the app to track your location for emergency response</p>
              </div>
              <Switch
                checked={localPreferences.enabled}
                onCheckedChange={(checked) => setLocalPreferences(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Accuracy Level</p>
              <div className="space-y-2">
                {[
                  { value: 'low', label: 'Low (Battery Saver)', description: 'Less accurate, saves battery' },
                  { value: 'medium', label: 'Medium (Balanced)', description: 'Good balance of accuracy and battery' },
                  { value: 'high', label: 'High (Most Accurate)', description: 'Most accurate, uses more battery' }
                ].map((option) => (
                  <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="accuracy"
                      value={option.value}
                      checked={localPreferences.accuracy === option.value}
                      onChange={(e) => setLocalPreferences(prev => ({ ...prev, accuracy: e.target.value }))}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{option.label}</p>
                      <p className="text-xs text-gray-500">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
