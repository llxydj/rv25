"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Camera, MapPin, Upload, X } from "lucide-react"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { useAuth } from "@/lib/auth"
import { createIncident, type CreateIncidentStage } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { LocationTracker } from "@/components/location-tracker"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { 
  IncidentCategorySelector, 
  TraumaSubcategorySelector, 
  SeverityLevelSelector,
  type IncidentCategory,
  type TraumaSubcategory,
  type SeverityLevel
} from "@/components/incident"
import { validateIncidentCategorization } from "@/lib/incident-categorization"

const INCIDENT_TYPES = [
  "FIRE",
  "FLOOD",
  "EARTHQUAKE",
  "MEDICAL EMERGENCY",
  "CRIME",
  "TRAFFIC ACCIDENT",
  "FALLEN TREE",
  "POWER OUTAGE",
  "WATER OUTAGE",
  "LANDSLIDE",
  "OTHER",
]

export default function VolunteerReportIncidentPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    incidentType: "",
    description: "",
    address: "",
    barangay: "",
    priority: "3", // Keep for backward compatibility
    // New categorization fields
    incident_category: "" as IncidentCategory | "",
    trauma_subcategory: "" as TraumaSubcategory | "",
    severity_level: "" as SeverityLevel | "",
  })
  const [categorizationErrors, setCategorizationErrors] = useState<{
    incident_category?: string
    trauma_subcategory?: string
    severity_level?: string
  }>({})
  const [location, setLocation] = useState<[number, number] | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitStage, setSubmitStage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [barangays, setBarangays] = useState<string[]>([])
  const [gettingLocation, setGettingLocation] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [pendingReports, setPendingReports] = useState<any[]>([])
  const [autoGeoLock, setAutoGeoLock] = useState<{ address: boolean; barangay: boolean }>({ address: false, barangay: false })
  const [geoMessage, setGeoMessage] = useState<string | null>(null)

  useEffect(() => {
    // Check if online
    setIsOffline(!navigator.onLine)

    // Listen for online/offline events
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Fetch barangays from the database
    const fetchBarangays = async () => {
      try {
        if (!navigator.onLine) {
          // Use cached barangays if offline
          const cachedBarangays = localStorage.getItem("barangays")
          if (cachedBarangays) {
            setBarangays(JSON.parse(cachedBarangays))
            return
          }
        }

        const response = await fetch("/api/barangays")
        const result = await response.json()
        
        if (result.data && Array.isArray(result.data)) {
          const barangayNames = result.data.map((b: any) => b.name)
          setBarangays(barangayNames)
          // Cache barangays for offline use
          localStorage.setItem("barangays", JSON.stringify(barangayNames))
        } else {
          throw new Error("Invalid response format from barangays API")
        }
      } catch (err) {
        // Fallback to hardcoded list if API fails
        const fallbackBarangays = [
          "ZONE 1",
          "ZONE 2",
          "ZONE 3",
          "ZONE 4",
          "ZONE 5",
          "ZONE 6",
          "ZONE 7",
          "ZONE 8",
          "ZONE 9",
          "ZONE 10",
          "ZONE 11",
          "ZONE 12",
          "ZONE 13",
          "ZONE 14",
          "ZONE 15",
          "ZONE 16",
          "ZONE 17",
          "ZONE 18",
          "ZONE 19",
          "ZONE 20",
          "CONCEPCION",
          "CABATANGAN",
          "MATAB-ANG",
          "BUBOG",
          "DOS HERMANAS",
          "EFIGENIO LIZARES",
          "KATILINGBAN",
        ]
        setBarangays(fallbackBarangays)
        localStorage.setItem("barangays", JSON.stringify(fallbackBarangays))
      }
    }

    fetchBarangays()

    // Load any pending reports from localStorage
    const loadPendingReports = () => {
      const savedReports = localStorage.getItem("pendingIncidentReports")
      if (savedReports) {
        setPendingReports(JSON.parse(savedReports))
      }
    }

    loadPendingReports()

    // Get user's current location
    getCurrentLocation()

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!isOffline && pendingReports.length > 0 && user) {
      const submitPendingReports = async () => {
        const updatedPendingReports = [...pendingReports]

        for (let i = 0; i < updatedPendingReports.length; i++) {
          const report = updatedPendingReports[i]
          if (report.originRole && report.originRole !== "volunteer") {
            continue
          }
          const reportLocation = report.location || TALISAY_CENTER

          try {
            const result = await createIncident(
              user.id,
              report.incidentType,
              report.description,
              reportLocation[0],
              reportLocation[1],
              report.address,
              report.barangay,
              [],
              report.priority,
              true,
              report.createdAtLocal || report.createdAt,
            )

            if (result.success) {
              updatedPendingReports.splice(i, 1)
              i--
            }
          } catch (error) {
            console.error("Failed to submit pending volunteer report:", error)
          }
        }

        setPendingReports(updatedPendingReports)
        localStorage.setItem("pendingIncidentReports", JSON.stringify(updatedPendingReports))
      }

      submitPendingReports()
    }
  }, [isOffline, pendingReports, user])

  // Reverse geocode when location changes and we're online
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!location || isOffline) return
      try {
        setGeoMessage('Detecting address from map pin…')
        const [lat, lng] = location
        const url = `/api/geocode/reverse?lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error('Reverse geocoding failed')
        const data = await res.json()
        if (cancelled) return

        const addr = data?.address || {}
        // Try several fields for barangay-like locality
        const brgyCandidate: string | undefined = (
          addr.suburb || addr.village || addr.neighbourhood || addr.city_district || addr.quarter || addr.town || addr.county
        )
        // Prefer matches from known barangays list (case-insensitive contains)
        let resolvedBarangay = ''
        if (Array.isArray(barangays) && barangays.length > 0 && brgyCandidate) {
          const cand = String(brgyCandidate).toUpperCase()
          const match = barangays.find(b => cand.includes(String(b).toUpperCase()))
          if (match) resolvedBarangay = match
        }
        // If still empty, fallback to brgyCandidate uppercased
        if (!resolvedBarangay && brgyCandidate) {
          resolvedBarangay = String(brgyCandidate).toUpperCase()
        }

        // Compose a human-readable address line
        const addressLine = data?.display_name || [addr.road, addr.suburb || addr.village || addr.neighbourhood, addr.city || addr.town || 'Talisay City'].filter(Boolean).join(', ')

        // Update form and lock when we have confident values
        const updates: any = {}
        const newLocks = { ...autoGeoLock }
        if (addressLine) { updates.address = addressLine; newLocks.address = true }
        if (resolvedBarangay) { updates.barangay = resolvedBarangay; newLocks.barangay = true }
        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }))
          setAutoGeoLock(newLocks)
          setGeoMessage('Address auto-filled from map pin')
        } else {
          setGeoMessage('Unable to detect address; you can type it manually')
          setAutoGeoLock({ address: false, barangay: false })
        }
      } catch (e) {
        setGeoMessage('Unable to detect address (network or service issue). You can type it manually.')
        setAutoGeoLock({ address: false, barangay: false })
      }
    }
    // Small debounce to avoid rapid calls when moving pin
    const t = setTimeout(run, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [location, isOffline, barangays])

  const getCurrentLocation = () => {
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setLocation([lat, lng])
        setGettingLocation(false)

        // Check if location is within Talisay City
        if (!isWithinTalisayCity(lat, lng)) {
          setError("Your current location is outside Talisay City. You can only report incidents within Talisay City.")
        }
      },
      (error) => {
        setGettingLocation(false)
        // Default to Talisay City center if location access is denied
        setLocation(TALISAY_CENTER)
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 },
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Sanitize input based on field type
    let sanitizedValue = value
    if (name === "description" || name === "address") {
      // Only collapse multiple consecutive spaces, but allow normal spacing
      sanitizedValue = value.replace(/\s{2,}/g, " ")
      // Convert to uppercase
      sanitizedValue = sanitizedValue.toUpperCase()
    } else if (name === "incidentType") {
      // Keep incident type in uppercase
      sanitizedValue = value.toUpperCase()
    } else if (name === "barangay") {
      // Keep the exact option value (only trim). Do NOT change case, or the <select> value won't match an option.
      sanitizedValue = value.trim()
    }

    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }))
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please capture a photo using your camera')
        return
      }

      // Check file size (max 3MB)
      if (file.size > 3 * 1024 * 1024) {
        setError('Photo size must be less than 3MB')
        return
      }
      
      // MEMORY FIX: Optimize photo processing for mobile devices
      const objectUrl = URL.createObjectURL(file)
      const isMobile = /Mobi|Android/i.test(navigator.userAgent)
      let imageBitmap: ImageBitmap | null = null
      let img: HTMLImageElement | null = null
      let canvas: HTMLCanvasElement | null = null
      
      // Cleanup function to ensure memory is freed
      const cleanup = () => {
        try {
          if (imageBitmap) {
            imageBitmap.close()
            imageBitmap = null
          }
          if (img) {
            img.src = ''
            img = null
          }
          if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
            }
            canvas.width = 0
            canvas.height = 0
            canvas = null
          }
          URL.revokeObjectURL(objectUrl)
        } catch (err) {
          console.warn('Cleanup error (non-critical):', err)
        }
      }
      
      // Use createImageBitmap for better performance (if available)
      const loadImage = async () => {
        try {
          // MEMORY FIX: On mobile, prefer Image over createImageBitmap to reduce memory pressure
          if (typeof createImageBitmap !== 'undefined' && !isMobile) {
            try {
              const bitmap = await createImageBitmap(file)
              return { imageBitmap: bitmap, width: bitmap.width, height: bitmap.height }
            } catch (bitmapError) {
              console.warn('createImageBitmap failed, falling back to Image:', bitmapError)
              // Fall through to Image fallback
            }
          }
        } catch {
          // Fallback to Image
        }
        
        return new Promise<{ imageBitmap?: ImageBitmap; img?: HTMLImageElement; width: number; height: number }>((imgResolve, imgReject) => {
          const imageElement = new Image()
          imageElement.onload = () => {
            img = imageElement
            imgResolve({ img: imageElement, width: imageElement.width, height: imageElement.height })
          }
          imageElement.onerror = (err) => {
            img = null
            imgReject(err)
          }
          imageElement.src = objectUrl
        })
      }
      
      loadImage().then(({ imageBitmap: loadedBitmap, img: loadedImg, width, height }) => {
        imageBitmap = loadedBitmap || null
        img = loadedImg || null
        
        // MEMORY FIX: More aggressive downscaling for mobile to prevent memory issues
        const MAX_DIM = isMobile ? 600 : 1280  // Reduced from 800 to 600 for mobile
        const JPEG_QUALITY = isMobile ? 0.4 : 0.7  // Lower quality for mobile to reduce memory
        
        let targetW = width
        let targetH = height
        if (Math.max(width, height) > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height)
          targetW = Math.round(width * scale)
          targetH = Math.round(height * scale)
        }

        // Create canvas with optimized context
        canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d', { 
          willReadFrequently: false,
          alpha: true,
          desynchronized: isMobile ? false : true  // Disable desynchronized on mobile for stability
        })
        
        if (!ctx) {
          cleanup()
          setError('Failed to process photo')
          return
        }
        
        // Draw the (possibly downscaled) image
        try {
          if (imageBitmap) {
            ctx.drawImage(imageBitmap, 0, 0, targetW, targetH)
            // Close immediately after drawing to free memory
            imageBitmap.close()
            imageBitmap = null
          } else if (img) {
            ctx.drawImage(img, 0, 0, targetW, targetH)
            // Clear image source to help GC
            img.src = ''
            img = null
          }
        } catch (drawError) {
          cleanup()
          setError('Failed to process photo: ' + (drawError as Error).message)
          return
        }
        
        // Add watermark background
        const watermarkHeight = Math.max(50, Math.round(canvas.height * 0.1))
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(0, canvas.height - watermarkHeight, canvas.width, watermarkHeight)
        
        // Add watermark text
        const fontSize = Math.max(12, Math.round(watermarkHeight * 0.3))
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillStyle = '#FFFFFF'
        
        const date = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const time = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
        
        // Add location name if available
        const locationText = formData.barangay 
          ? `${formData.barangay}, Talisay City`
          : 'Talisay City'
        
        // Draw text with shadow (simplified for mobile)
        if (!isMobile) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
          ctx.shadowBlur = 4
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2
        }
        
        const padding = 10
        ctx.fillText(`📍 ${locationText}`, padding, canvas.height - watermarkHeight / 2 - 5)
        ctx.fillText(`📅 ${date} ${time}`, padding, canvas.height - padding)
        
        if (!isMobile) {
          ctx.shadowColor = 'transparent'
        }
        
        // Convert canvas to JPEG file
        const convertToBlob = () => {
          if (!canvas) {
            cleanup()
            setError('Failed to process photo')
            return
          }
          
          canvas.toBlob((blob) => {
            try {
              if (blob) {
                const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
                setPhotoFile(watermarkedFile)
                // MEMORY FIX: Create preview URL with lower quality to save memory
                setPhotoPreview(canvas.toDataURL('image/jpeg', isMobile ? 0.3 : JPEG_QUALITY))
                cleanup()
              } else {
                cleanup()
                setError('Failed to process photo')
              }
            } catch (convertError) {
              cleanup()
              setError('Failed to process photo: ' + (convertError as Error).message)
            }
          }, 'image/jpeg', JPEG_QUALITY)
        }
        
        // MEMORY FIX: On mobile, process immediately but with small delay to allow GC
        if (isMobile) {
          // Small delay to allow garbage collection of previous image
          setTimeout(() => {
            convertToBlob()
            // Force garbage collection hint (if available)
            if ('gc' in window && typeof (window as any).gc === 'function') {
              try {
                (window as any).gc()
              } catch {}
            }
          }, 50)
        } else if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(convertToBlob, { timeout: 100 })
        } else {
          setTimeout(convertToBlob, 0)
        }
      }).catch((error) => {
        cleanup()
        setError('Failed to process photo: ' + (error as Error).message)
      })
    }
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const handleMapClick = (lat: number, lng: number) => {
    // Only set location if within Talisay City
    if (isWithinTalisayCity(lat, lng)) {
      setLocation([lat, lng])
      setError(null)
    } else {
      setError("Selected location is outside Talisay City. Please select a location within Talisay City.")
    }
  }

  const validateForm = () => {
    if (!formData.incidentType) {
      setError("Please select an incident type")
      return false
    }

    if (!formData.description || formData.description.trim().length < 10) {
      setError("Please provide a detailed description (at least 10 characters)")
      return false
    }

    if (!formData.barangay) {
      setError("Please select a barangay")
      return false
    }

    if (!formData.address || formData.address.trim().length < 5) {
      setError("Please provide a valid address (at least 5 characters)")
      return false
    }

    if (!location) {
      setError("Please select a location on the map")
      return false
    }

    // Clear any previous errors
    setError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    setLoading(true)

    console.log("🟢 [VOLUNTEER REPORT SUBMIT] ========== STARTING SUBMISSION ==========")
    console.log("🟢 [VOLUNTEER REPORT SUBMIT] Timestamp:", new Date().toISOString())

    if (!user) {
      const errorMsg = "You must be logged in to report an incident"
      setError(errorMsg)
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: errorMsg
      })
      setLoading(false)
      setIsSubmitting(false)
      return
    }

    // Validate categorization fields
    const categorizationValidation = validateIncidentCategorization({
      incident_category: formData.incident_category || null,
      trauma_subcategory: formData.trauma_subcategory || null,
      severity_level: formData.severity_level || null
    })

    if (!categorizationValidation.valid) {
      const errors: typeof categorizationErrors = {}
      categorizationValidation.errors.forEach(err => {
        if (err.includes('incident category')) {
          errors.incident_category = err
        } else if (err.includes('Trauma sub-category')) {
          errors.trauma_subcategory = err
        } else if (err.includes('severity')) {
          errors.severity_level = err
        }
      })
      setCategorizationErrors(errors)
      setError(categorizationValidation.errors.join(', '))
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: categorizationValidation.errors.join(', ')
      })
      setLoading(false)
      setIsSubmitting(false)
      return
    }

    // Validate required categorization fields
    if (!formData.incident_category) {
      setCategorizationErrors({ incident_category: 'Incident category is required' })
      setError('Please select an incident category')
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: 'Please select an incident category'
      })
      setLoading(false)
      setIsSubmitting(false)
      return
    }

    if (!formData.severity_level) {
      setCategorizationErrors({ severity_level: 'Severity level is required' })
      setError('Please select a severity level')
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: 'Please select a severity level'
      })
      setLoading(false)
      setIsSubmitting(false)
      return
    }

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      })
      setLoading(false)
      setIsSubmitting(false)
      return
    }

    // Validate photo if required (only when online - photos can't be stored offline)
    if (!isOffline && !photoFile) {
      setError("Please take a photo of the incident")
      toast({
        variant: "destructive",
        title: "Photo Required",
        description: "Please take a photo of the incident"
      })
      setLoading(false)
      setIsSubmitting(false)
      return
    }

    // If offline, store the report locally
    if (isOffline) {
      try {
        const submissionTimestamp = new Date().toISOString()
        const newReport = {
          incidentType: formData.incidentType,
          description: formData.description,
          location: location || TALISAY_CENTER,
          address: formData.address,
          barangay: formData.barangay,
          priority: Number.parseInt(formData.priority),
          createdAtLocal: submissionTimestamp,
          createdAt: submissionTimestamp,
          originRole: "volunteer",
          // New categorization fields
          incident_category: formData.incident_category || undefined,
          trauma_subcategory: formData.trauma_subcategory || undefined,
          severity_level: formData.severity_level || undefined,
        }

        const updatedPendingReports = [...pendingReports, newReport]
        setPendingReports(updatedPendingReports)
        localStorage.setItem("pendingIncidentReports", JSON.stringify(updatedPendingReports))

        toast({
          title: "Report Saved Offline",
          description: "Your report has been saved and will be submitted when you're back online.",
          duration: 5000
        })

        // Reset form
        setFormData({
          incidentType: "",
          description: "",
          address: "",
          barangay: "",
          priority: "3",
          incident_category: "" as IncidentCategory | "",
          trauma_subcategory: "" as TraumaSubcategory | "",
          severity_level: "" as SeverityLevel | "",
        })
        setCategorizationErrors({})
        setLocation(null)
        setPhotoFile(null)
        setPhotoPreview(null)

        // Redirect to dashboard
        router.push("/volunteer/dashboard?offline=true")
      } catch (err: any) {
        setError("Failed to save report offline. Please try again.")
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save report offline. Please try again."
        })
      } finally {
        setLoading(false)
        setIsSubmitting(false)
      }
      return
    }

    // Online submission
    try {
      const reportLocation = location || TALISAY_CENTER

      setLoading(true)
      setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…")

      console.log("🟢 [VOLUNTEER REPORT SUBMIT] Getting session for submission...")
      
      // OPTIMIZATION: Since we already have currentUser from useAuth hook, we can skip session check
      // and just use the user ID directly. The createIncident function will handle auth internally.
      let session: any = null
      let sessionAccessToken: string | undefined = undefined
      
      // Quick session check with short timeout (3 seconds) - just to get access token
      // If it fails, we proceed anyway since we have user
      try {
        const { getSessionWithTimeout } = await import('@/lib/supabase-auth-timeout')
        const sessionResult = await getSessionWithTimeout(3000) // Short timeout - just for token
        if (sessionResult.data?.session && !sessionResult.error) {
          session = sessionResult.data.session
          sessionAccessToken = sessionResult.data.session.access_token
          console.log("🟢 [VOLUNTEER REPORT SUBMIT] ✅ Session obtained (with token):", { userId: session.user.id.substring(0, 8) + '...' });
        }
      } catch (sessionErr: any) {
        console.warn("🟢 [VOLUNTEER REPORT SUBMIT] Session check timeout (non-critical, proceeding with user):", sessionErr.message);
        // Continue anyway - we have user from hook
      }
      
      // If session check failed, create minimal session from user (we already validated it exists)
      if (!session && user && user.id) {
        console.log("🟢 [VOLUNTEER REPORT SUBMIT] Using user directly (session check skipped):", user.id.substring(0, 8) + '...');
        session = { user: { id: user.id, email: user.email || '' } }
        // CRITICAL: Try to get token with timeout to prevent hanging
        try {
          // Use Promise.race with timeout to prevent infinite hang
          const sessionPromise = supabase.auth.getSession()
          const timeoutPromise = new Promise<{ data: { session: null }, error: { message: string } }>((_, reject) =>
            setTimeout(() => reject(new Error('Token retrieval timeout')), 3000) // 3 second timeout
          )
          
          const result = await Promise.race([sessionPromise, timeoutPromise]) as any
          if (result?.data?.session?.access_token && !result.error) {
            sessionAccessToken = result.data.session.access_token
            session = result.data.session // Use full session if we got it
            // SECURITY FIX: Removed localStorage token caching - Supabase uses httpOnly cookies
            // Token is available in session, upload API will use cookie fallback if needed
            console.log("🟢 [VOLUNTEER REPORT SUBMIT] ✅ Got access token via direct Supabase call (cached)");
          } else {
            console.warn("🟢 [VOLUNTEER REPORT SUBMIT] Direct Supabase call returned no token:", result?.error?.message || 'No session');
          }
        } catch (directErr: any) {
          if (directErr?.message?.includes('timeout')) {
            console.warn("🟢 [VOLUNTEER REPORT SUBMIT] Token retrieval timed out (non-critical, continuing without token)");
          } else {
            console.warn("🟢 [VOLUNTEER REPORT SUBMIT] Direct Supabase call failed:", directErr?.message || 'Unknown error');
          }
          // Continue anyway - we have user, background upload will try to get token
        }
      }
      
      if (!session || !session.user) {
        throw new Error("Unable to verify your session. Please refresh the page and try again.");
      }

      console.log("🟢 [VOLUNTEER REPORT SUBMIT] ✅ Ready for submission:", { 
        userId: session.user.id.substring(0, 8) + '...',
        hasToken: !!sessionAccessToken 
      });

      const stageMessages: Record<CreateIncidentStage, string> = {
        "verify-session": "Verifying your session…",
        "upload-photo": "Uploading photo evidence…",
        "create-record": "Sending report to command center…",
        done: "Finalizing…",
      }

      const submissionTimestamp = new Date().toISOString()
      console.log("🟢 [VOLUNTEER REPORT SUBMIT] Calling createIncident:", {
        reporterId: user.id.substring(0, 8) + '...',
        incidentType: formData.incidentType,
        location: reportLocation,
        timestamp: submissionTimestamp
      });
      
      const createIncidentPromise = createIncident(
        user.id,
        formData.incidentType,
        formData.description,
        reportLocation[0],
        reportLocation[1],
        formData.address,
        formData.barangay,
        photoFile ? [photoFile] : [],
        Number.parseInt(formData.priority),
        false,
        submissionTimestamp,
        undefined, // voiceBlob
        {
          sessionUserId: session.user.id,
          accessToken: sessionAccessToken || session.access_token || undefined,
          onStageChange: (stage) => {
            setTimeout(() => {
              setSubmitStage(stageMessages[stage] || null)
            }, 50)
          },
          // New categorization fields
          incident_category: formData.incident_category || undefined,
          trauma_subcategory: formData.trauma_subcategory || undefined,
          severity_level: formData.severity_level || undefined,
        },
      )
      
      // 60-second overall timeout (increased for slow mobile networks)
      const timeoutPromise = new Promise<{ success: false; message: string }>((resolve) => 
        setTimeout(() => resolve({ 
          success: false, 
          message: 'Submission is taking longer than expected. Your report may still be processing. Please wait a moment and check your dashboard.' 
        }), 60000) // 60 seconds
      )

      console.log("🟢 [VOLUNTEER REPORT SUBMIT] Waiting for createIncident (60s timeout)...");
      console.log("🟢 [VOLUNTEER REPORT SUBMIT] Photo files being passed:", photoFile ? 1 : 0);
      
      let result: any
      try {
        result = await Promise.race([createIncidentPromise, timeoutPromise])
        console.log("🟢 [VOLUNTEER REPORT SUBMIT] Result received:", {
          success: result?.success,
          hasData: !!(result as any)?.data,
          message: (result as any)?.message
        });
      } catch (raceError: any) {
        console.error("🟢 [VOLUNTEER REPORT SUBMIT] Promise.race error:", {
          message: raceError?.message,
          name: raceError?.name,
          stack: raceError?.stack
        });
        throw raceError; // Re-throw to be caught by outer try-catch
      }

      if (!result.success) {
        console.error("🟢 [VOLUNTEER REPORT SUBMIT] createIncident failed:", result);
        throw new Error((result as any).message || "Failed to create incident report")
      }

      console.log("🟢 [VOLUNTEER REPORT SUBMIT] ✅ Submission successful:", (result as any).data)
      console.log("🟢 [VOLUNTEER REPORT SUBMIT] ========== SUBMISSION COMPLETE ==========");

      toast({
        title: "Success",
        description: "Your incident report has been submitted successfully. Emergency responders will be notified.",
        duration: 5000
      })

      // Reset form
      setFormData({
        incidentType: "",
        description: "",
        address: "",
        barangay: "",
        priority: "3",
        incident_category: "" as IncidentCategory | "",
        trauma_subcategory: "" as TraumaSubcategory | "",
        severity_level: "" as SeverityLevel | "",
      })
      setCategorizationErrors({})
      setLocation(null)
      setPhotoFile(null)
      setPhotoPreview(null)

      // Redirect to dashboard with success message
      router.push("/volunteer/dashboard?success=Incident reported successfully")
    } catch (err: any) {
      console.error("🟢 [VOLUNTEER REPORT SUBMIT] ❌ Error:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        networkType: (navigator as any).connection?.effectiveType || 'unknown',
        isOnline: navigator.onLine
      })
      
      // Handle specific error cases
      let errorMessage = err.message || "Failed to submit incident report"
      if (errorMessage.includes("row-level security policy")) {
        errorMessage = "Authentication error. Please try logging out and back in."
      } else if (errorMessage.includes("storage")) {
        errorMessage = "Failed to upload photo. Please try again with a different photo."
      } else if (errorMessage.includes("Network is slow")) {
        errorMessage += " If the problem persists, your report may still be processing. Please check your dashboard."
      }

      setError(errorMessage)
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
    } finally {
      setLoading(false)
      setSubmitStage(null)
      setIsSubmitting(false)
    }
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report an Incident</h1>
          <p className="text-gray-600 mt-1">Please provide as much detail as possible to help emergency responders.</p>
        </div>

        {isOffline && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You are currently offline. Your report will be saved locally and submitted when you're back online.
                </p>
              </div>
            </div>
          </div>
        )}

        {pendingReports.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  You have {pendingReports.length} pending report(s) that will be submitted when you're online.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Incident Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="incidentType" className="block text-sm font-medium text-gray-700">
                  Incident Type *
                </label>
                <select
                  id="incidentType"
                  name="incidentType"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 bg-white"
                  value={formData.incidentType}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select Incident Type</option>
                  {INCIDENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Incident Category */}
              <div>
                <IncidentCategorySelector
                  value={formData.incident_category}
                  onChange={(value) => {
                    setFormData(prev => ({
                      ...prev,
                      incident_category: value,
                      // Clear trauma_subcategory if category changes away from MEDICAL_TRAUMA
                      trauma_subcategory: value === 'MEDICAL_TRAUMA' ? prev.trauma_subcategory : '' as TraumaSubcategory | ''
                    }))
                    setCategorizationErrors(prev => ({ ...prev, incident_category: undefined }))
                  }}
                  required
                  disabled={loading}
                  error={categorizationErrors.incident_category}
                />
              </div>

              {/* Trauma Subcategory - Conditional */}
              {formData.incident_category === 'MEDICAL_TRAUMA' && (
                <div>
                  <TraumaSubcategorySelector
                    value={formData.trauma_subcategory}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, trauma_subcategory: value }))
                      setCategorizationErrors(prev => ({ ...prev, trauma_subcategory: undefined }))
                    }}
                    required
                    disabled={loading}
                    error={categorizationErrors.trauma_subcategory}
                  />
                </div>
              )}

              {/* Enhanced Severity Level */}
              <div className={formData.incident_category === 'MEDICAL_TRAUMA' ? 'md:col-span-2' : ''}>
                <SeverityLevelSelector
                  value={formData.severity_level}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, severity_level: value }))
                    setCategorizationErrors(prev => ({ ...prev, severity_level: undefined }))
                  }}
                  required
                  disabled={loading}
                  error={categorizationErrors.severity_level}
                  variant="radio"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 bg-white uppercase"
                  placeholder="Please describe what happened..."
                  value={formData.description}
                  onChange={handleChange}
                  disabled={loading}
                ></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Location</h2>

            {/* Location Tracker */}
            <div className="mb-6">
              <LocationTracker
                onLocationUpdate={(location) => {
                  setLocation([location.latitude, location.longitude])
                  setError(null)
                }}
                showSettings={true}
                className="mb-4"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address *
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 bg-white uppercase"
                  placeholder="Street address"
                  value={formData.address}
                  onChange={handleChange}
                  disabled={loading || (autoGeoLock.address && !isOffline)}
                  readOnly={autoGeoLock.address && !isOffline}
                />
                {geoMessage && (
                  <p className="mt-1 text-xs text-gray-600">{geoMessage}</p>
                )}
              </div>

              <div>
                <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">
                  Barangay * {barangays.length > 0 && `(${barangays.length} available)`}
                </label>
                <select
                  id="barangay"
                  name="barangay"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 bg-white"
                  value={formData.barangay}
                  onChange={handleChange}
                  disabled={loading || (autoGeoLock.barangay && !isOffline)}
                >
                  <option value="">Select Barangay</option>
                  {barangays.map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay}
                    </option>
                  ))}
                </select>
                {barangays.length === 0 && (
                  <div className="mt-1">
                    <p className="text-sm text-red-600">Loading barangays...</p>
                  </div>
                )}
                {formData.barangay && (
                  <p className="mt-1 text-sm text-green-600">Selected: {formData.barangay}</p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Pin Location on Map *</label>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500"
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <LoadingSpinner size="sm" color="text-green-600" />
                  ) : (
                    <>
                      <MapPin className="mr-1 h-4 w-4" />
                      Use My Location
                    </>
                  )}
                </button>
              </div>
              <MapComponent
                center={location || undefined}
                zoom={15}
                markers={
                  location
                    ? [
                        {
                          id: "incident-location",
                          position: location,
                          status: "PENDING",
                          title: "Incident Location",
                        },
                      ]
                    : []
                }
                height="300px"
                onMapClick={handleMapClick}
                userLocation={true}
                showBoundary={true}
                showGeofence={false}
                showVolunteerLocations={false} // CRITICAL: Disable volunteer location polling on report page
                offlineMode={isOffline}
              />
              {location && (
                <p className="mt-1 text-sm text-gray-600">
                  Selected coordinates: {location[0].toFixed(6)}, {location[1].toFixed(6)}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Photo Evidence (Required)</h2>

            <div className="space-y-4">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt={formData.incidentType ? `Preview of ${formData.incidentType} photo` : `Photo preview`}
                    className="max-h-64 rounded-lg mx-auto"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    aria-label="Remove photo"
                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer bg-background py-6 px-4 border-2 border-gray-300 border-dashed rounded-lg text-center hover:bg-accent w-full transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="mx-auto h-12 w-12 text-gray-400">
                        <Camera className="h-12 w-12 mx-auto" />
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-green-600 hover:text-green-500">Take a photo</span>
                      </div>
                      <p className="text-xs text-gray-500">Use your device's camera to capture the incident</p>
                    </div>
                    <input
                      id="photo-upload"
                      name="photo"
                      type="file"
                      accept="image/jpeg"
                      capture="environment"
                      className="sr-only"
                      onChange={handlePhotoChange}
                      required
                      disabled={loading}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push("/volunteer/dashboard")}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-900 bg-white hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              disabled={loading}
              aria-label="Cancel and return to dashboard"
            >
              Cancel
            </button>
            <div className="flex items-center justify-between w-full">
              <button
                type="submit"
                disabled={loading || isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <LoadingSpinner size="sm" color="text-white" />
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Submit Report
                  </>
                )}
              </button>
              {loading && submitStage && (
                <p className="text-right text-xs text-gray-500">{submitStage}</p>
              )}
            </div>
          </div>
        </form>
      </div>
    </VolunteerLayout>
  )
}