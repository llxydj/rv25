"use client"

import { useState, useEffect } from "react"
import { X, MapPin, Bell, Camera, Mic, CheckCircle, AlertCircle, Loader2, Shield, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { locationTrackingService } from "@/lib/location-tracking"
import { pushNotificationService } from "@/lib/push-notification-service"
import { useAuth } from "@/lib/auth"
import Link from "next/link"

interface PermissionStatus {
  location: 'granted' | 'denied' | 'prompt' | 'checking'
  notifications: 'granted' | 'denied' | 'prompt' | 'checking'
  camera: 'granted' | 'denied' | 'prompt' | 'checking'
  microphone: 'granted' | 'denied' | 'prompt' | 'checking'
}

interface PermissionRequestModalProps {
  onComplete?: () => void
  onSkip?: () => void
}

export function PermissionRequestModal({ onComplete, onSkip }: PermissionRequestModalProps) {
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [permissions, setPermissions] = useState<PermissionStatus>({
    location: 'checking',
    notifications: 'checking',
    camera: 'checking',
    microphone: 'checking'
  })
  const [currentStep, setCurrentStep] = useState<'location' | 'notifications' | 'camera' | 'microphone' | 'complete' | 'privacy'>('privacy')
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  // Check if modal should be shown (only once per user)
  useEffect(() => {
    if (!user?.id) return

    const storageKey = `permissions_requested_${user.id}`
    const hasRequested = localStorage.getItem(storageKey) === 'true'
    
    if (!hasRequested) {
      // Check current permission status
      checkAllPermissions()
      setShowModal(true)
      // Start with privacy disclaimer
      setCurrentStep('privacy')
    }
  }, [user?.id])

  // Check all permission statuses
  const checkAllPermissions = async () => {
    const status: PermissionStatus = {
      location: 'checking',
      notifications: 'checking',
      camera: 'checking',
      microphone: 'checking'
    }

    // Check location permission (with timeout to prevent hanging)
    if ('geolocation' in navigator) {
      if ('permissions' in navigator) {
        try {
          // Add timeout to prevent hanging
          const permissionPromise = navigator.permissions.query({ name: 'geolocation' })
          const timeoutPromise = new Promise<{ state: string }>((resolve) => 
            setTimeout(() => resolve({ state: 'prompt' }), 1000)
          )
          const result = await Promise.race([permissionPromise, timeoutPromise])
          status.location = (result?.state as 'granted' | 'denied' | 'prompt') || 'prompt'
        } catch {
          // Fallback: assume prompt if permissions API fails
          status.location = 'prompt'
        }
      } else {
        // Fallback for browsers without permissions API
        status.location = 'prompt'
      }
    } else {
      status.location = 'denied'
    }

    // Check notification permission
    if ('Notification' in window) {
      const permission = Notification.permission
      // Map 'default' to 'prompt' for our type system
      status.notifications = (permission === 'default' ? 'prompt' : permission) as 'granted' | 'denied' | 'prompt' | 'checking'
    } else {
      status.notifications = 'denied'
    }

    // Check camera permission
    // Note: Permissions API may not support 'camera' directly on all browsers
    // We can't check camera permission without requesting it, so default to 'prompt'
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // For camera, we can't check without requesting, so default to 'prompt'
      // The actual permission will be checked when user clicks the button
      status.camera = 'prompt'
    } else {
      status.camera = 'denied'
    }

    // Check microphone permission
    // Note: Microphone is used for voice recording in incident reports
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // For microphone, we can't check without requesting, so default to 'prompt'
      // The actual permission will be checked when user clicks the button
      status.microphone = 'prompt'
    } else {
      status.microphone = 'denied'
    }

    setPermissions(status)
    
    // Don't change step here - privacy step is shown first
    // Step will advance after privacy is accepted
  }

  // Handle privacy acceptance and proceed to permissions
  const handlePrivacyAccept = () => {
    setPrivacyAccepted(true)
    // Determine which step to show first based on permission status
    if (permissions.location !== 'granted') {
      setCurrentStep('location')
    } else if (permissions.notifications !== 'granted') {
      setCurrentStep('notifications')
    } else if (permissions.camera !== 'granted') {
      setCurrentStep('camera')
    } else if (permissions.microphone !== 'granted') {
      setCurrentStep('microphone')
    } else {
      setCurrentStep('complete')
    }
  }

  // Request location permission
  const requestLocation = async () => {
    setIsRequesting(true)
    setError(null)

    try {
      // Enhanced compatibility check
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setPermissions(prev => ({ ...prev, location: 'denied' }))
        setError('Location services are not supported on this device or browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.')
        setIsRequesting(false)
        return
      }

      if (!locationTrackingService.isSupported()) {
        setPermissions(prev => ({ ...prev, location: 'denied' }))
        setError('Location services are not supported on this device')
        setIsRequesting(false)
        return
      }

      const granted = await locationTrackingService.requestPermission()
      
      if (granted) {
        setPermissions(prev => {
          const updated = { ...prev, location: 'granted' }
          // Auto-advance to next step
          setTimeout(() => {
            if (updated.notifications !== 'granted') {
              setCurrentStep('notifications')
            } else if (updated.camera !== 'granted') {
              setCurrentStep('camera')
            } else if (updated.microphone !== 'granted') {
              setCurrentStep('microphone')
            } else {
              setCurrentStep('complete')
            }
          }, 200) // Reduced delay for faster UX
          return updated
        })
      } else {
        setPermissions(prev => ({ ...prev, location: 'denied' }))
        setError('Location permission was denied. You can enable it later in your browser settings.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request location permission')
      setPermissions(prev => ({ ...prev, location: 'denied' }))
    } finally {
      setIsRequesting(false)
    }
  }

  // Request notification permission
  const requestNotifications = async () => {
    setIsRequesting(true)
    setError(null)

    try {
      // Enhanced compatibility check
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPermissions(prev => ({ ...prev, notifications: 'denied' }))
        setError('Notifications are not supported on this device or browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.')
        setIsRequesting(false)
        return
      }

      // Check if service worker is required (for push notifications)
      if ('serviceWorker' in navigator) {
        try {
          // Service worker is available, proceed with notification request
              const permission = await Notification.requestPermission()
          setPermissions(prev => ({ ...prev, notifications: permission as 'granted' | 'denied' }))

          if (permission === 'granted') {
            setPermissions(prev => {
              const updated = { ...prev, notifications: 'granted' }
              // Initialize push notifications in background (non-blocking)
              if (user?.id) {
                // Fire and forget - don't block UI
                setTimeout(() => {
                  pushNotificationService.initialize().catch(err => {
                    console.warn('Failed to initialize push notifications:', err)
                  })
                }, 0) // Run in next tick, non-blocking
              }
              // Auto-advance immediately - don't wait for push init
              setTimeout(() => {
                if (updated.camera !== 'granted') {
                  setCurrentStep('camera')
                } else if (updated.microphone !== 'granted') {
                  setCurrentStep('microphone')
                } else {
                  setCurrentStep('complete')
                }
              }, 200) // Reduced delay for faster UX
              return updated
            })
          } else {
            setError('Notification permission was denied. You can enable it later in your browser settings.')
          }
        } catch (swErr) {
          // Service worker failed, but basic notifications might still work
          console.warn('Service worker not available, using basic notifications:', swErr)
          const permission = await Notification.requestPermission()
          // Map 'default' to 'prompt' for our type system
          const mappedPermission = (permission === 'default' ? 'prompt' : permission) as 'granted' | 'denied' | 'prompt' | 'checking'
          setPermissions(prev => ({ ...prev, notifications: mappedPermission }))
          if (permission === 'granted') {
            setPermissions(prev => {
              const updated = { ...prev, notifications: 'granted' }
              // Initialize push notifications in background (non-blocking)
              if (user?.id) {
                setTimeout(() => {
                  pushNotificationService.initialize().catch(err => {
                    console.warn('Failed to initialize push notifications:', err)
                  })
                }, 0)
              }
              setTimeout(() => {
                if (updated.camera !== 'granted') {
                  setCurrentStep('camera')
                } else if (updated.microphone !== 'granted') {
                  setCurrentStep('microphone')
                } else {
                  setCurrentStep('complete')
                }
              }, 200)
              return updated
            })
          } else {
            setError('Notification permission was denied. You can enable it later in your browser settings.')
          }
        }
      } else {
        // No service worker, but basic notifications might work
        const permission = await Notification.requestPermission()
        // Map 'default' to 'prompt' for our type system
        const mappedPermission = (permission === 'default' ? 'prompt' : permission) as 'granted' | 'denied' | 'prompt' | 'checking'
        setPermissions(prev => ({ ...prev, notifications: mappedPermission }))
        if (permission === 'granted') {
          setPermissions(prev => {
            const updated = { ...prev, notifications: 'granted' }
            // Initialize push notifications in background (non-blocking)
            if (user?.id) {
              setTimeout(() => {
                pushNotificationService.initialize().catch(err => {
                  console.warn('Failed to initialize push notifications:', err)
                })
              }, 0)
            }
            setTimeout(() => {
              if (updated.camera !== 'granted') {
                setCurrentStep('camera')
              } else if (updated.microphone !== 'granted') {
                setCurrentStep('microphone')
              } else {
                setCurrentStep('complete')
              }
            }, 200)
            return updated
          })
        } else {
          setError('Notification permission was denied. You can enable it later in your browser settings.')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request notification permission')
      setPermissions(prev => ({ ...prev, notifications: 'denied' }))
    } finally {
      setIsRequesting(false)
    }
  }

  // Request camera permission
  const requestCamera = async () => {
    setIsRequesting(true)
    setError(null)

    try {
      // Enhanced compatibility check
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissions(prev => ({ ...prev, camera: 'denied' }))
        setError('Camera access is not supported on this device or browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge. Note: Camera access requires HTTPS connection.')
        setIsRequesting(false)
        return
      }

      // Check if we're on HTTPS (required for camera access on most browsers)
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setPermissions(prev => ({ ...prev, camera: 'denied' }))
        setError('Camera access requires a secure HTTPS connection. Please access this site via HTTPS.')
        setIsRequesting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // Permission granted, stop the stream immediately
      stream.getTracks().forEach(track => track.stop())
      
      setPermissions(prev => {
        const updated = { ...prev, camera: 'granted' }
        // Auto-advance to next step
        setTimeout(() => {
          if (updated.microphone !== 'granted') {
            setCurrentStep('microphone')
          } else {
            setCurrentStep('complete')
          }
        }, 200) // Reduced delay for faster UX
        return updated
      })
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissions(prev => ({ ...prev, camera: 'denied' }))
        setError('Camera permission was denied. You can enable it later in your browser settings.')
      } else {
        setError(err.message || 'Failed to request camera permission')
        setPermissions(prev => ({ ...prev, camera: 'denied' }))
      }
    } finally {
      setIsRequesting(false)
    }
  }

  // Request microphone permission
  const requestMicrophone = async () => {
    setIsRequesting(true)
    setError(null)

    try {
      // Enhanced compatibility check
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissions(prev => ({ ...prev, microphone: 'denied' }))
        setError('Microphone access is not supported on this device or browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge. Note: Microphone access requires HTTPS connection.')
        setIsRequesting(false)
        return
      }

      // Check if we're on HTTPS (required for microphone access on most browsers)
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setPermissions(prev => ({ ...prev, microphone: 'denied' }))
        setError('Microphone access requires a secure HTTPS connection. Please access this site via HTTPS.')
        setIsRequesting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted, stop the stream immediately
      stream.getTracks().forEach(track => track.stop())
      
      setPermissions(prev => {
        const updated = { ...prev, microphone: 'granted' }
        // Auto-advance to complete
        setTimeout(() => {
          setCurrentStep('complete')
        }, 200) // Reduced delay for faster UX
        return updated
      })
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissions(prev => ({ ...prev, microphone: 'denied' }))
        setError('Microphone permission was denied. You can enable it later in your browser settings.')
      } else {
        setError(err.message || 'Failed to request microphone permission')
        setPermissions(prev => ({ ...prev, microphone: 'denied' }))
      }
    } finally {
      setIsRequesting(false)
    }
  }

  // Handle complete
  const handleComplete = () => {
    if (user?.id) {
      const storageKey = `permissions_requested_${user.id}`
      localStorage.setItem(storageKey, 'true')
    }
    setShowModal(false)
    onComplete?.()
  }

  // Handle skip
  const handleSkip = () => {
    if (user?.id) {
      const storageKey = `permissions_requested_${user.id}`
      localStorage.setItem(storageKey, 'true')
    }
    setShowModal(false)
    onSkip?.()
  }

  // Get permission icon
  const getPermissionIcon = (type: 'location' | 'notifications' | 'camera' | 'microphone') => {
    const status = permissions[type]
    if (status === 'granted') {
      return <CheckCircle className="h-6 w-6 text-green-500" />
    } else if (status === 'denied') {
      return <AlertCircle className="h-6 w-6 text-red-500" />
    } else if (status === 'checking') {
      return <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
    } else {
      return <AlertCircle className="h-6 w-6 text-yellow-500" />
    }
  }

  // Get permission description based on role
  const getPermissionDescription = (type: 'location' | 'notifications' | 'camera' | 'microphone') => {
    const role = user?.role?.toLowerCase() || 'user'
    
    const descriptions: Record<string, Record<string, string>> = {
      location: {
        admin: 'Allows us to show your location on maps and track volunteer positions',
        volunteer: 'Allows us to share your location with admins for better incident response',
        resident: 'Allows us to automatically capture your location when reporting incidents',
        default: 'Allows us to use your location for better service'
      },
      notifications: {
        admin: 'Get instant alerts for new incidents, volunteer updates, and system notifications',
        volunteer: 'Receive notifications for new assignments, schedule updates, and emergency alerts',
        resident: 'Get updates on your reported incidents and important announcements',
        default: 'Stay informed with important updates and notifications'
      },
      camera: {
        admin: 'Capture photos for incident documentation and reports',
        volunteer: 'Take photos when responding to incidents for better documentation',
        resident: 'Capture photos when reporting incidents for faster response',
        default: 'Take photos for better documentation'
      },
      microphone: {
        admin: 'Record voice messages for incident documentation and communication',
        volunteer: 'Record voice messages when responding to incidents for detailed reports',
        resident: 'Record voice messages when reporting incidents for faster and clearer communication',
        default: 'Record voice messages for better communication'
      }
    }

    return descriptions[type]?.[role] || descriptions[type]?.default || ''
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Enable App Permissions</CardTitle>
              <CardDescription className="mt-2">
                To provide the best experience, we need a few permissions. This will only take a moment.
              </CardDescription>
            </div>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {/* Privacy Disclaimer Step */}
          {currentStep === 'privacy' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Data Privacy Notice</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Republic Act No. 10173 (Data Privacy Act of 2012)
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>RVOIS (Rescue Volunteers Operations Information System)</strong>, operated by <strong>RADIANT Rescue Volunteers Inc.</strong>, 
                  respects your privacy and is committed to protecting your personal data in compliance with the 
                  <strong> Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and relevant regulations from the 
                  National Privacy Commission (NPC).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Why We Request Permissions:</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span><strong>Location:</strong> To provide accurate emergency response, incident mapping, and volunteer coordination services.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span><strong>Notifications:</strong> To send you important alerts, incident updates, and emergency notifications.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span><strong>Camera:</strong> To capture photos for incident documentation and reporting purposes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span><strong>Microphone:</strong> To record voice messages for incident reporting and communication.</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Your Rights Under RA 10173:</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                      <span><strong>Right to Access:</strong> You may request access to your personal data stored in our system.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                      <span><strong>Right to Correction:</strong> You may request correction of inaccurate or incomplete data.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                      <span><strong>Right to Object:</strong> You may object to processing of your data for certain purposes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                      <span><strong>Right to Data Portability:</strong> You may request a copy of your data in a readable format.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                      <span><strong>Right to Erasure:</strong> You may request deletion of your data under certain conditions.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong>Data Security:</strong> We implement appropriate technical and organizational measures to protect your personal data 
                    against unauthorized access, alteration, disclosure, or destruction. Your data is stored securely and only accessed by 
                    authorized personnel for legitimate purposes related to emergency response and system operations.
                  </p>
                </div>

                <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>
                    By proceeding, you acknowledge that you have read and understood this privacy notice. 
                    You can view our complete <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link> and 
                    <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline ml-1">Terms of Service</Link> at any time.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="flex-1"
                >
                  Skip for Now
                </Button>
                <Button
                  onClick={handlePrivacyAccept}
                  className="flex-1"
                >
                  I Understand & Continue
                </Button>
              </div>
            </div>
          )}

          {/* Progress indicator - only show after privacy step */}
          {currentStep !== 'privacy' && (
            <div className="flex items-center justify-between mb-6">
            {(['location', 'notifications', 'camera', 'microphone'] as const).map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    currentStep === step
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : permissions[step] === 'granted'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {getPermissionIcon(step)}
                  </div>
                  <span className="text-xs mt-2 text-center text-gray-600 dark:text-gray-400 capitalize">
                    {step === 'location' ? 'Location' : step === 'notifications' ? 'Notifications' : step === 'camera' ? 'Camera' : 'Microphone'}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    permissions[step] === 'granted' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
            </div>
          )}

          {/* Current step content */}
          {currentStep === 'location' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <MapPin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Location Access</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {getPermissionDescription('location')}
                  </p>
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  )}
                  <Button
                    onClick={requestLocation}
                    disabled={isRequesting || permissions.location === 'granted'}
                    className="w-full"
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : permissions.location === 'granted' ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Permission Granted
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Allow Location Access
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Bell className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Notifications</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {getPermissionDescription('notifications')}
                  </p>
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  )}
                  <Button
                    onClick={requestNotifications}
                    disabled={isRequesting || permissions.notifications === 'granted'}
                    className="w-full"
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : permissions.notifications === 'granted' ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Permission Granted
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 mr-2" />
                        Allow Notifications
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'camera' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Camera className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Camera Access</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {getPermissionDescription('camera')}
                  </p>
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  )}
                  <Button
                    onClick={requestCamera}
                    disabled={isRequesting || permissions.camera === 'granted'}
                    className="w-full"
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : permissions.camera === 'granted' ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Permission Granted
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Allow Camera Access
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'microphone' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Mic className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Microphone Access</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {getPermissionDescription('microphone')}
                  </p>
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  )}
                  <Button
                    onClick={requestMicrophone}
                    disabled={isRequesting || permissions.microphone === 'granted'}
                    className="w-full"
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : permissions.microphone === 'granted' ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Permission Granted
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Allow Microphone Access
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="text-center space-y-4 py-8">
              <div className="flex justify-center">
                <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold">All Set!</h3>
              <p className="text-gray-600 dark:text-gray-400">
                You've enabled all necessary permissions. You're ready to use the app!
              </p>
              <Button onClick={handleComplete} className="w-full mt-4">
                Continue to Dashboard
              </Button>
            </div>
          )}

          {/* Action buttons */}
          {currentStep !== 'complete' && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="flex-1"
              >
                Skip for Now
              </Button>
              {permissions.location === 'granted' && permissions.notifications === 'granted' && permissions.camera === 'granted' && permissions.microphone === 'granted' && (
                <Button
                  onClick={handleComplete}
                  className="flex-1"
                >
                  Continue
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

