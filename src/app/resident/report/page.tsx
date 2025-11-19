"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Camera, MapPin, Upload, X, Clock } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { createIncident } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { LocationTracker } from "@/components/location-tracker"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

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

export default function ReportIncidentPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportType = searchParams?.get('type') // 'emergency' or 'non-emergency'
  const isEmergency = reportType === 'emergency'
  
  const [formData, setFormData] = useState({
    incidentType: "",
    description: "",
    address: "",
    barangay: "",
    priority: isEmergency ? "1" : "3", // Auto-assign: Emergency = 1, Non-emergency = 3
  })
  const [location, setLocation] = useState<[number, number] | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [barangays, setBarangays] = useState<string[]>([])
  const [gettingLocation, setGettingLocation] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [pendingReports, setPendingReports] = useState<any[]>([])
  const [autoGeoLock, setAutoGeoLock] = useState<{ address: boolean; barangay: boolean }>({ address: false, barangay: false })
  const [geoMessage, setGeoMessage] = useState<string | null>(null)
  const [locationCaptured, setLocationCaptured] = useState(false)
  const [photoCaptured, setPhotoCaptured] = useState(false)
  const [emergencyTimer, setEmergencyTimer] = useState<number | null>(null)

  useEffect(() => {
    // Redirect if no report type specified
    if (!reportType) {
      router.push('/resident/dashboard')
      return
    }

    // Start emergency timer (30 seconds)
    if (isEmergency) {
      const startTime = Date.now()
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setEmergencyTimer(30 - elapsed)
        if (elapsed >= 30) {
          clearInterval(timer)
        }
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [reportType, isEmergency, router])

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
        
        console.log("Barangays API response:", result)
        
        if (result.data && Array.isArray(result.data)) {
          const barangayNames = result.data.map((b: any) => b.name)
          console.log("Setting barangays:", barangayNames)
          setBarangays(barangayNames)
          // Cache barangays for offline use
          localStorage.setItem("barangays", JSON.stringify(barangayNames))
        } else {
          console.error("Invalid barangays data:", result)
          throw new Error("Invalid response format from barangays API")
        }
      } catch (err) {
        console.error("Error fetching barangays:", err)
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
    const handler = () => {
      toast({ title: 'Report queued', description: 'Your report will be sent automatically when back online.' })
    }
    window.addEventListener('incident-queued', handler as EventListener)
    return () => window.removeEventListener('incident-queued', handler as EventListener)
  }, [toast])

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

  // Try to submit any pending reports when we come back online
  useEffect(() => {
    if (!isOffline && pendingReports.length > 0 && user) {
      const submitPendingReports = async () => {
        const updatedPendingReports = [...pendingReports]

        for (let i = 0; i < updatedPendingReports.length; i++) {
          const report = updatedPendingReports[i]

          try {
            // Try to submit the report
            const result = await createIncident(
              user.id,
              report.incidentType,
              report.description,
              report.location[0],
              report.location[1],
              report.address,
              report.barangay,
              null, // Can't store File objects in localStorage, so photo is lost
              report.priority,
            )

            if (result.success) {
              // Remove from pending reports
              updatedPendingReports.splice(i, 1)
              i--
            }
          } catch (error) {
            console.error("Failed to submit pending report:", error)
          }
        }

        // Update pending reports
        setPendingReports(updatedPendingReports)
        localStorage.setItem("pendingIncidentReports", JSON.stringify(updatedPendingReports))
      }

      submitPendingReports()
    }
  }, [isOffline, pendingReports, user])

  const getCurrentLocation = () => {
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const accuracy = position.coords.accuracy // in meters
        
        // Check accuracy (target: 5-10 meters)
        if (accuracy > 20) {
          setError(`Location accuracy is ${Math.round(accuracy)}m. Please wait for better GPS signal or move to an open area.`)
        } else {
          setError(null)
        }
        
        setLocation([lat, lng])
        setLocationCaptured(true)
        setGettingLocation(false)

        // Check if location is within Talisay City
        if (!isWithinTalisayCity(lat, lng)) {
          setError("Your current location is outside Talisay City. You can only report incidents within Talisay City.")
        }
      },
      (error) => {
        console.log("Geolocation error code:", error.code)
        setGettingLocation(false)
        // Default to Talisay City center if location access is denied
        setLocation(TALISAY_CENTER)
        setLocationCaptured(true)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    console.log(`Field changed: ${name} = "${value}"`)
    
    // Sanitize input based on field type
    let sanitizedValue = value
    if (name === "description" || name === "address") {
      // Only collapse multiple consecutive spaces, but allow normal spacing
      sanitizedValue = value.replace(/\s{2,}/g, " ")
      // Apply sentence case: first character uppercase, rest lowercase
      if (sanitizedValue.length > 0) {
        sanitizedValue = sanitizedValue.charAt(0).toUpperCase() + sanitizedValue.slice(1).toLowerCase()
      }
    } else if (name === "incidentType") {
      // Keep incident type in uppercase
      sanitizedValue = value.toUpperCase()
    } else if (name === "barangay") {
      // Keep the exact option value (only trim). Do NOT change case, or the <select> value won't match an option.
      sanitizedValue = value.trim()
    }

    console.log(`Sanitized value: ${sanitizedValue}`)
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
      
      // Create a canvas to add watermark
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Downscale large images to reduce file size and upload time
        const MAX_DIM = 1280
        let targetW = img.width
        let targetH = img.height
        if (Math.max(img.width, img.height) > MAX_DIM) {
          const scale = MAX_DIM / Math.max(img.width, img.height)
          targetW = Math.round(img.width * scale)
          targetH = Math.round(img.height * scale)
        }

        // Set canvas size to target
        canvas.width = targetW
        canvas.height = targetH
        
        // Draw the (possibly downscaled) image
        ctx?.drawImage(img, 0, 0, targetW, targetH)
        
        // Add watermark background
        if (ctx) {
          // Semi-transparent black background for better readability
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
          ctx.fillRect(0, canvas.height - 80, canvas.width, 80)
          
          // Add watermark text
          ctx.font = 'bold 24px Arial'
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
            : location 
            ? `Lat: ${location[0].toFixed(6)}, Lng: ${location[1].toFixed(6)}`
            : 'Talisay City'
          
          // Draw text with shadow for better visibility
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
          ctx.shadowBlur = 4
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2
          
          ctx.fillText(`📍 ${locationText}`, 20, canvas.height - 50)
          ctx.fillText(`📅 ${date} ${time}`, 20, canvas.height - 20)
          
          // Reset shadow
          ctx.shadowColor = 'transparent'
        }
        
        // Convert canvas to JPEG file with lower quality to reduce size
        canvas.toBlob((blob) => {
          if (blob) {
            const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
            setPhotoFile(watermarkedFile)
            setPhotoPreview(canvas.toDataURL('image/jpeg', 0.7)) // 70% quality preview
            setPhotoCaptured(true)
          }
        }, 'image/jpeg', 0.7)
      }
      
      img.src = URL.createObjectURL(file)
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
    // Step 1: Location must be captured first
    if (!location || !locationCaptured) {
      setError("Please capture your location first")
      return false
    }

    // Step 2: Photo must be captured
    if (!photoFile || !photoCaptured) {
      setError("Please take a photo of the incident")
      return false
    }

    // Step 3: Incident type required
    if (!formData.incidentType) {
      setError("Please select an incident type")
      return false
    }

    // Step 4: Description required
    if (!formData.description || formData.description.trim().length < 10) {
      setError("Please provide a detailed description (at least 10 characters)")
      return false
    }

    // Step 5: Barangay required
    if (!formData.barangay) {
      setError("Please select a barangay")
      return false
    }

    // Step 6: Address required
    if (!formData.address || formData.address.trim().length < 5) {
      setError("Please provide a valid address (at least 5 characters)")
      return false
    }

    // Clear any previous errors
    setError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      const errorMsg = "You must be logged in to report an incident"
      setError(errorMsg)
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: errorMsg
      })
      return
    }

    // Debug: Log user information
    console.log("Current user:", {
      id: user.id,
      email: user.email,
      role: user.role
    })

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      })
      return
    }

    // Priority is auto-assigned based on emergency type (already set in state)
    // No need to validate priority - it's hidden from user

    setLoading(true)

    // If offline, store the report locally
    if (isOffline) {
      try {
        const newReport = {
          incidentType: formData.incidentType,
          description: formData.description,
          location: location || TALISAY_CENTER,
          address: formData.address,
          barangay: formData.barangay,
          priority: Number.parseInt(formData.priority),
          createdAt: new Date().toISOString(),
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
        })
        setLocation(null)
        setPhotoFile(null)
        setPhotoPreview(null)

        // Redirect to dashboard
        router.push("/resident/dashboard?offline=true")
      } catch (err: any) {
        setError("Failed to save report offline. Please try again.")
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save report offline. Please try again."
        })
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      // Ensure we have a location (either selected or default)
      const reportLocation = location || TALISAY_CENTER

      // Debug: Log the incident data being sent
      console.log("Submitting incident with data:", {
        user_id: user.id,
        incidentType: formData.incidentType,
        description: formData.description,
        location: reportLocation,
        address: formData.address,
        barangay: formData.barangay,
        priority: formData.priority,
        hasPhoto: !!photoFile,
        photoDetails: photoFile ? {
          name: photoFile.name,
          size: photoFile.size,
          type: photoFile.type
        } : null
      })

      // Verify user session is still valid
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("Your session has expired. Please log in again.")
      }

      const result = await createIncident(
        user.id,
        formData.incidentType,
        formData.description,
        reportLocation[0],
        reportLocation[1],
        formData.address,
        formData.barangay,
        photoFile,
        Number.parseInt(formData.priority),
      )

      if (!result.success) {
        throw new Error(result.message || "Failed to create incident report")
      }

      // Debug: Log successful submission
      console.log("Incident submitted successfully:", result.data)

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
      })
      setLocation(null)
      setPhotoFile(null)
      setPhotoPreview(null)

      // Redirect to dashboard with success message
      router.push("/resident/dashboard?success=Incident reported successfully")
    } catch (err: any) {
      console.error("Error submitting incident report:", err)
      
      // Handle specific error cases
      let errorMessage = err.message || "Failed to submit incident report"
      if (errorMessage.includes("row-level security policy")) {
        errorMessage = "Authentication error. Please try logging out and back in."
      } else if (errorMessage.includes("storage")) {
        errorMessage = "Failed to upload photo. Please try again with a different photo."
      }

      setError(errorMessage)
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEmergency ? "🚨 EMERGENCY REPORT" : "📋 Non-Emergency Report"}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEmergency 
              ? "Life-threatening situation - Complete this report quickly (within 30 seconds)"
              : "Please provide as much detail as possible to help emergency responders."}
          </p>
          {isEmergency && emergencyTimer !== null && emergencyTimer > 0 && (
            <div className="mt-2 flex items-center justify-center gap-2 text-red-600 font-semibold bg-red-50 border-2 border-red-300 rounded-lg p-3 shadow-sm">
              <Clock className="h-6 w-6 animate-pulse" />
              <span className="text-lg">Time remaining: <span className="text-2xl font-bold">{emergencyTimer}s</span></span>
            </div>
          )}
          {isEmergency && emergencyTimer !== null && emergencyTimer <= 0 && (
            <div className="mt-2 flex items-center justify-center gap-2 text-red-700 font-semibold bg-red-100 border-2 border-red-400 rounded-lg p-3">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-lg">Time's up! Please submit your report immediately.</span>
            </div>
          )}
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

          {/* STEP 1: Automatic Location Capture */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">
              Step 1: Location Capture {locationCaptured && "✅"}
            </h2>
            <p className="text-sm text-gray-600 mb-4">Your location will be automatically captured via GPS (target accuracy: 5-10 meters)</p>
            
            <div className="mb-6">
              <LocationTracker
                onLocationUpdate={(location) => {
                  setLocation([location.latitude, location.longitude])
                  setLocationCaptured(true)
                  setError(null)
                }}
                showSettings={true}
                className="mb-4"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address * {autoGeoLock.address && "🔒"}
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 bg-white"
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
                  Barangay * {barangays.length > 0 && `(${barangays.length} available)`} {autoGeoLock.barangay && "🔒"}
                </label>
                <select
                  id="barangay"
                  name="barangay"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 bg-white"
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
                    <button
                      type="button"
                      onClick={async () => {
                        console.log("Manually fetching barangays...")
                        try {
                          const response = await fetch("/api/barangays")
                          const result = await response.json()
                          console.log("Manual fetch result:", result)
                          if (result.data) {
                            setBarangays(result.data.map((b: any) => b.name))
                          }
                        } catch (err) {
                          console.error("Manual fetch error:", err)
                        }
                      }}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Retry loading barangays
                    </button>
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
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <LoadingSpinner size="sm" color="text-red-600" />
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
                showVolunteerLocations={true}
                offlineMode={isOffline}
              />
              {location && (
                <p className="mt-1 text-sm text-gray-600">
                  Selected coordinates: {location[0].toFixed(6)}, {location[1].toFixed(6)}
                </p>
              )}
            </div>
          </div>

          {/* STEP 2: Mandatory Photo Upload */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">
              Step 2: Photo Evidence (Required) {photoCaptured && "✅"}
            </h2>
            <p className="text-sm text-gray-600 mb-4">A picture says a thousand words - Photo proof is mandatory</p>

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
                        <span className="font-medium text-red-600 hover:text-red-500">Take a photo</span>
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

          {/* STEP 3: Report Type Selection */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 3: Report Type Selection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="incidentType" className="block text-sm font-medium text-gray-700">
                  Incident Type *
                </label>
                <select
                  id="incidentType"
                  name="incidentType"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 bg-white"
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
              
              {/* Hidden priority field - auto-assigned based on emergency type */}
              <input type="hidden" name="priority" value={formData.priority} />
              {isEmergency && (
                <div className="bg-red-50 p-3 rounded-md">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Emergency Priority: Critical (Auto-assigned)
                  </p>
                </div>
              )}
              {!isEmergency && (
                <div className="bg-green-50 p-3 rounded-md">
                  <p className="text-sm text-green-800 font-medium">
                    ℹ️ Non-Emergency Priority: Medium (Auto-assigned)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* STEP 4: Auto-populated fields (user info, timestamp) - shown as read-only */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 4: Your Information (Auto-filled)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Your Name</label>
                <input
                  type="text"
                  value={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : ''}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm"
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                <input
                  type="text"
                  value={user?.phone_number || 'Not provided'}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm"
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Report Timestamp</label>
                <input
                  type="text"
                  value={new Date().toLocaleString()}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm"
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Report Type</label>
                <input
                  type="text"
                  value={isEmergency ? "EMERGENCY" : "NON-EMERGENCY"}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm font-semibold"
                  readOnly
                  disabled
                />
              </div>
            </div>
          </div>

          {/* STEP 5: User inputs description */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 5: What Happened?</h2>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description * (Short, clear description)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 bg-white"
                placeholder="Please describe what happened..."
                value={formData.description}
                onChange={handleChange}
                disabled={loading}
              ></textarea>
            </div>
          </div>


          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push("/resident/dashboard")}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-900 bg-white hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              disabled={loading}
              aria-label="Cancel and return to dashboard"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
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
          </div>
        </form>
      </div>
    </ResidentLayout>
  )
}
