"use client"

import { useState, useRef, useEffect } from 'react'
import { Camera, X, RotateCcw, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  isCameraAvailable,
  isAndroid,
  isMobile,
  getCameraConstraints,
  capturePhotoFromStream,
  blobToFile,
} from '@/lib/camera-utils'

interface CameraCaptureProps {
  onPhotoCapture: (file: File) => void
  onCancel?: () => void
  disabled?: boolean
  maxPhotos?: number
  currentPhotoCount?: number
}

export function CameraCapture({
  onPhotoCapture,
  onCancel,
  disabled = false,
  maxPhotos = 1,
  currentPhotoCount = 0,
}: CameraCaptureProps) {
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Check if camera is available
  const cameraAvailable = isCameraAvailable()
  const isAndroidDevice = isAndroid()
  const isMobileDevice = isMobile()

  // Cleanup stream on unmount or when component closes
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const startCamera = async () => {
    if (!cameraAvailable) {
      setError(
        'Camera access requires HTTPS. Please use the file input option or ensure you are on a secure connection.'
      )
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const constraints = getCameraConstraints(facingMode)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play()
              resolve()
            }
          }
        })

        setIsActive(true)
        setIsLoading(false)
      }
    } catch (err: any) {
      console.error('Camera access error:', err)
      setIsLoading(false)
      setIsActive(false)

      let errorMessage = 'Failed to access camera. '
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera permissions in your browser settings.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found on this device.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += 'Camera is already in use by another application.'
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera does not support the required settings.'
      } else {
        errorMessage += err.message || 'Unknown error occurred.'
      }

      setError(errorMessage)
      stopCamera()
    }
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !isActive) {
      setError('Camera is not active. Please start the camera first.')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Capture photo from video stream
      const { blob, width, height } = await capturePhotoFromStream(videoRef.current)

      // Convert blob to File
      const fileName = `incident-photo-${Date.now()}.jpg`
      const file = blobToFile(blob, fileName, 'image/jpeg')

      // Create preview URL
      const previewUrl = URL.createObjectURL(blob)
      setCapturedPhoto(previewUrl)

      // Stop camera after capture
      stopCamera()
      setIsActive(false)
      setIsLoading(false)

      // Call callback with the file
      onPhotoCapture(file)
    } catch (err: any) {
      console.error('Photo capture error:', err)
      setError('Failed to capture photo. Please try again.')
      setIsLoading(false)
    }
  }

  const switchCamera = async () => {
    if (!isActive) return

    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacingMode)

    // Stop current stream
    stopCamera()

    // Start with new facing mode
    await startCamera()
  }

  const handleCancel = () => {
    stopCamera()
    setIsActive(false)
    setCapturedPhoto(null)
    setError(null)
    if (onCancel) {
      onCancel()
    }
  }

  const handleRetake = () => {
    setCapturedPhoto(null)
    setError(null)
    startCamera()
  }

  // If camera is not available, show file input fallback
  if (!cameraAvailable) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 dark:border-yellow-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Direct camera access requires HTTPS. Please use the file input option below to select a photo from your
                gallery or take a photo using your device's camera app.
              </p>
            </div>
          </div>
        </div>
        {onCancel && (
          <Button type="button" variant="outline" onClick={handleCancel} disabled={disabled}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>
    )
  }

  // Show captured photo preview
  if (capturedPhoto) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-800">
          <img
            src={capturedPhoto}
            alt="Captured photo"
            className="w-full h-auto max-h-96 object-contain"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRetake}
            disabled={disabled || isLoading}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={handleCancel} disabled={disabled}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Show camera interface
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!isActive && !isLoading && (
        <div className="space-y-4">
          <Button
            type="button"
            onClick={startCamera}
            disabled={disabled || currentPhotoCount >= maxPhotos}
            className="w-full"
            size="lg"
          >
            <Camera className="h-5 w-5 mr-2" />
            {currentPhotoCount >= maxPhotos
              ? `Maximum ${maxPhotos} photo${maxPhotos > 1 ? 's' : ''} reached`
              : 'Open Camera'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={handleCancel} disabled={disabled} className="w-full">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isActive ? 'Capturing photo...' : 'Starting camera...'}
          </p>
        </div>
      )}

      {isActive && !isLoading && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white border-dashed rounded-lg" style={{ width: '90%', height: '90%' }} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={capturePhoto}
              disabled={disabled || isLoading}
              className="flex-1"
              size="lg"
            >
              <Camera className="h-5 w-5 mr-2" />
              Capture Photo
            </Button>
            {isMobileDevice && (
              <Button
                type="button"
                variant="outline"
                onClick={switchCamera}
                disabled={disabled || isLoading}
                title="Switch camera"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            {onCancel && (
              <Button type="button" variant="outline" onClick={handleCancel} disabled={disabled}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Position the incident in the frame and tap "Capture Photo"
          </p>
        </div>
      )}
    </div>
  )
}

