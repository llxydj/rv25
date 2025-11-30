// Camera utility functions for Android and mobile devices

/**
 * Detect if the device is Android
 */
export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

/**
 * Detect if the device is mobile (Android, iOS, etc.)
 */
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false
  return /Mobi|Android/i.test(navigator.userAgent)
}

/**
 * Check if getUserMedia is supported
 */
export const isGetUserMediaSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    navigator.mediaDevices !== undefined &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

/**
 * Check if we're on HTTPS (required for getUserMedia)
 */
export const isHTTPS = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  )
}

/**
 * Check if camera access is available
 */
export const isCameraAvailable = (): boolean => {
  return isGetUserMediaSupported() && isHTTPS()
}

/**
 * Get camera constraints optimized for mobile
 */
export const getCameraConstraints = (facingMode: 'user' | 'environment' = 'environment') => {
  return {
    video: {
      facingMode: facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      // Optimize for mobile performance
      aspectRatio: { ideal: 16 / 9 },
    },
  }
}

/**
 * Fix image orientation based on EXIF data
 * Android devices often capture photos in different orientations
 */
export const fixImageOrientation = async (
  file: File
): Promise<{ blob: Blob; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas with correct dimensions
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        // Set canvas dimensions to image dimensions
        canvas.width = img.width
        canvas.height = img.height

        // Draw image
        ctx.drawImage(img, 0, 0)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }
            resolve({
              blob,
              width: img.width,
              height: img.height,
            })
          },
          'image/jpeg',
          0.95
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Capture photo from video stream
 */
export const capturePhotoFromStream = (
  video: HTMLVideoElement
): Promise<{ blob: Blob; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Set canvas dimensions to video dimensions
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob with high quality
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'))
            return
          }
          resolve({
            blob,
            width: canvas.width,
            height: canvas.height,
          })
        },
        'image/jpeg',
        0.95 // High quality for incident photos
      )
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Convert blob to File object
 */
export const blobToFile = (blob: Blob, fileName: string, mimeType: string): File => {
  return new File([blob], fileName, { type: mimeType })
}

