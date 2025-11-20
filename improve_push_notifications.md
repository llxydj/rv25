# Improve push notifications and incident reporting
_Exported on 11/20/2025 at 08:26:19 GMT+8 from Cursor (2.0.77)_

---

**User**


can u pls ensure the push notification of the admin, resident and volunteers user panel is working especially in the PWA? also fix the navbar of resident and other admin user panel and volunteer, it must be correctly a hamburger or whats best improve from current, just simply but good looking..

then pls plan a fix and do it correctly on for a solution of a long sending of incident in report in resident panel,, see suggestions below:

our target is as much as possible reduce long wait to send reporting of incident since this is critical,, must be that it is fast as much as possible

the suggestions and info is below:


* `canvas.toBlob` in `handlePhotoChange` is asynchronous but **does not await completion** before `photoCaptured` is set.
* If the user immediately submits after capturing, `photoFile` may still be `null`.
* `handleSubmit` depends on `photoFile`, so the stage appears stuck.

Other improvements:

* Ensure `navigator.onLine` is checked right at submission.
* Stage messages should update reliably with small debounce.
* Prevent UI freezing by ensuring `setSubmitStage` updates after async events.
* Compress images slightly to avoid large uploads.

handlePhotoChange`**

```ts
const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0]

    // Validate type and size
    if (!file.type.startsWith('image/')) {
      setError('Please capture a photo using your camera')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Photo size must be less than 3MB')
      return
    }

    // Convert image to watermarked blob
    const watermarkedFile = await new Promise<File | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const MAX_DIM = 1280
        let targetW = img.width
        let targetH = img.height
        if (Math.max(img.width, img.height) > MAX_DIM) {
          const scale = MAX_DIM / Math.max(img.width, img.height)
          targetW = Math.round(img.width * scale)
          targetH = Math.round(img.height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, targetW, targetH)

        if (ctx) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillRect(0, canvas.height - 80, canvas.width, 80)
          ctx.font = 'bold 24px Arial'
          ctx.fillStyle = '#FFF'
          const date = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
          const time = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })
          const locationText = formData.barangay 
            ? `${formData.barangay}, Talisay City`
            : location 
            ? `Lat: ${location[0].toFixed(6)}, Lng: ${location[1].toFixed(6)}`
            : 'Talisay City'
          ctx.fillText(`📍 ${locationText}`, 20, canvas.height - 50)
          ctx.fillText(`📅 ${date} ${time}`, 20, canvas.height - 20)
        }

        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' }))
          else resolve(null)
        }, 'image/jpeg', 0.7)
      }
      img.src = URL.createObjectURL(file)
    })

    if (watermarkedFile) {
      setPhotoFile(watermarkedFile)
      const previewURL = URL.createObjectURL(watermarkedFile)
      setPhotoPreview(previewURL)
      setPhotoCaptured(true)
      setError(null)
    } else {
      setError('Failed to process photo. Please try again.')
    }
  }
}
```

✅ This ensures `photoFile` is always ready before submitting.

---

### ** Fix `handleSubmit`**

Key changes:

* Await `photoCaptured` if not ready yet.
* Check online status right before submission.
* Update `submitStage` reliably.

```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)

  if (!user) {
    setError("You must be logged in to report an incident")
    toast({ variant:"destructive", title:"Auth Error", description:"Login required" })
    return
  }

  // Wait for photo to be ready
  if (!photoFile || !photoCaptured) {
    setError("Please take a photo of the incident")
    return
  }

  if (!validateForm()) {
    toast({ variant:"destructive", title:"Validation Error", description:error })
    return
  }

  setLoading(true)
  setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…")

  // Offline case
  if (!navigator.onLine) {
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
      toast({ title:"Saved Offline", description:"Report queued for sending when online." })
      router.push("/resident/dashboard?offline=true")
    } catch (err) {
      setError("Failed to save offline report")
    } finally {
      setLoading(false)
      setSubmitStage(null)
    }
    return
  }

  // Online submission
  try {
    const reportLocation = location || TALISAY_CENTER
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) throw new Error("Session expired. Log in again.")

    const stageMessages: Record<CreateIncidentStage,string> = {
      "verify-session":"Verifying session…",
      "upload-photo":"Uploading photo…",
      "create-record":"Sending report…",
      done:"Finalizing…",
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
      false,
      undefined,
      {
        sessionUserId: session.user.id,
        accessToken: session.access_token || undefined,
        onStageChange: (stage) => setSubmitStage(stageMessages[stage] || null)
      }
    )

    if (!result.success) throw new Error(result.message || "Failed to create incident report")

    toast({ title:"Success", description:"Report submitted successfully." })
    setFormData({ incidentType:"", description:"", address:"", barangay:"", priority:"3" })
    setLocation(null)
    setPhotoFile(null)
    setPhotoPreview(null)
    router.push("/resident/dashboard?success=Incident reported successfully")
  } catch (err: any) {
    console.error("Submit error:", err)
    const msg = err.message || "Failed to submit incident report"
    setError(msg)
    toast({ variant:"destructive", title:"Error", description:msg })
  } finally {
    setLoading(false)
    setSubmitStage(null)
  }
}
```

---

### **SOptional Improvements**

1. Debounce `setSubmitStage` updates slightly if you see flickering:

```ts
onStageChange: (stage) => setTimeout(() => setSubmitStage(stageMessages[stage] || null), 50)
```

2. Ensure `photoFile` URLs are revoked after submission to free memory:

```ts
if (photoPreview) URL.revokeObjectURL(photoPreview)
```

---

✅ **Result**:

* Photo processing is fully awaited.
* Submission always has a valid `photoFile`.
* `submitStage` messages show correctly.
* Offline storage works as before.
* Backend logic remains untouched.


---

**Cursor**


Exploring the codebase to understand the structure and locate relevant files.



Reading key files to understand the current implementation:



Creating a plan and starting implementation:



Fixing the incident report photo processing first, then the navbar and push notifications:


```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Camera, MapPin, Upload, X } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { createIncident, type CreateIncidentStage } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { LocationTracker } from "@/components/location-tracker"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

export default function ReportIncidentPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportType = searchParams?.get("type")
  const isEmergency = reportType === "emergency"
  const autoIncidentType = useMemo(
    () => (isEmergency ? "EMERGENCY INCIDENT" : "COMMUNITY INCIDENT"),
    [isEmergency],
  )

  const [formData, setFormData] = useState({
    incidentType: autoIncidentType,
    description: "",
    address: "",
    barangay: "",
    priority: isEmergency ? "1" : "3",
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
  const [submitStage, setSubmitStage] = useState<string | null>(null)

  useEffect(() => {
    if (!reportType) {
      router.push("/resident/dashboard")
      return
    }
    setFormData((prev) => ({
      ...prev,
      incidentType: autoIncidentType,
      priority: isEmergency ? "1" : "3",
    }))
  }, [reportType, router, autoIncidentType, isEmergency])

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
      
      // Convert image to watermarked blob - properly await completion
      const watermarkedFile = await new Promise<File | null>((resolve) => {
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
          // Properly await the blob conversion
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
              resolve(watermarkedFile)
            } else {
              resolve(null)
            }
          }, 'image/jpeg', 0.7)
        }
        
        img.onerror = () => {
          resolve(null)
        }
        
        img.src = URL.createObjectURL(file)
      })

      if (watermarkedFile) {
        setPhotoFile(watermarkedFile)
        const previewURL = URL.createObjectURL(watermarkedFile)
        setPhotoPreview(previewURL)
        setPhotoCaptured(true)
        setError(null)
      } else {
        setError('Failed to process photo. Please try again.')
        setPhotoFile(null)
        setPhotoPreview(null)
        setPhotoCaptured(false)
      }
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

    // Step 3: Description required
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
    setSubmitStage(null)
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
    setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…")

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
        setSubmitStage(null)
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

      const stageMessages: Record<CreateIncidentStage, string> = {
        "verify-session": "Verifying your session…",
        "upload-photo": "Uploading photo evidence…",
        "create-record": "Sending report to command center…",
        done: "Finalizing…",
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
        false,
        undefined,
        {
          sessionUserId: session.user.id,
          accessToken: session.access_token || undefined,
          onStageChange: (stage) => {
            setSubmitStage(stageMessages[stage] || null)
          },
        },
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
      setSubmitStage(null)
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
              ? "Life-threatening situation – focus on the essentials and submit as soon as you can."
              : "Please provide as much detail as possible to help emergency responders."}
          </p>
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

          {/* STEP 3: Incident Classification */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 3: Incident Classification</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Current incident type</p>
                <p className="text-base font-semibold text-gray-900">{formData.incidentType}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pick the option that matches what is happening. You can switch below if you tapped the wrong entry point.
                </p>
              </div>

              <div className="p-4 border border-yellow-200 rounded-md bg-yellow-50">
                <p className="text-sm font-medium text-gray-800">Who sets the classification?</p>
                <p className="text-xs text-gray-700 mt-1">
                  The system uses the button you tapped (Emergency or Non-Emergency) to route responders. If you selected the
                  wrong path, cancel below and re-open the correct report type so our team receives the proper alert.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => router.push("/resident/dashboard")}
                    className="text-sm font-semibold text-red-600 hover:text-red-500 underline"
                  >
                    Cancel and choose another option
                  </button>
                </div>
              </div>

              {/* Hidden priority field - auto-assigned based on emergency type */}
              <input type="hidden" name="priority" value={formData.priority} />

              {isEmergency ? (
                <div className="bg-red-50 p-3 rounded-md border border-red-200">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Emergency Priority: Critical (auto-assigned)
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Responders are alerted immediately with highest urgency.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 p-3 rounded-md border border-green-200">
                  <p className="text-sm text-green-800 font-medium">
                    ℹ️ Non-Emergency Priority: Standard (auto-assigned)
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    The team reviews and dispatches responders based on availability.
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
          {loading && submitStage && (
            <p className="text-right text-xs text-gray-500">{submitStage}</p>
          )}
        </form>
      </div>
    </ResidentLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Camera, MapPin, Upload, X } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { createIncident, type CreateIncidentStage } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { LocationTracker } from "@/components/location-tracker"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

export default function ReportIncidentPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportType = searchParams?.get("type")
  const isEmergency = reportType === "emergency"
  const autoIncidentType = useMemo(
    () => (isEmergency ? "EMERGENCY INCIDENT" : "COMMUNITY INCIDENT"),
    [isEmergency],
  )

  const [formData, setFormData] = useState({
    incidentType: autoIncidentType,
    description: "",
    address: "",
    barangay: "",
    priority: isEmergency ? "1" : "3",
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
  const [submitStage, setSubmitStage] = useState<string | null>(null)

  useEffect(() => {
    if (!reportType) {
      router.push("/resident/dashboard")
      return
    }
    setFormData((prev) => ({
      ...prev,
      incidentType: autoIncidentType,
      priority: isEmergency ? "1" : "3",
    }))
  }, [reportType, router, autoIncidentType, isEmergency])

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
      
      // Convert image to watermarked blob - properly await completion
      const watermarkedFile = await new Promise<File | null>((resolve) => {
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
          // Properly await the blob conversion
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
              resolve(watermarkedFile)
            } else {
              resolve(null)
            }
          }, 'image/jpeg', 0.7)
        }
        
        img.onerror = () => {
          resolve(null)
        }
        
        img.src = URL.createObjectURL(file)
      })

      if (watermarkedFile) {
        setPhotoFile(watermarkedFile)
        const previewURL = URL.createObjectURL(watermarkedFile)
        setPhotoPreview(previewURL)
        setPhotoCaptured(true)
        setError(null)
      } else {
        setError('Failed to process photo. Please try again.')
        setPhotoFile(null)
        setPhotoPreview(null)
        setPhotoCaptured(false)
      }
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

    // Step 3: Description required
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
    setSubmitStage(null)
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

    // Wait for photo to be ready before submitting
    if (!photoFile || !photoCaptured) {
      setError("Please take a photo of the incident")
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please take a photo of the incident"
      })
      return
    }

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      })
      return
    }

    // Check online status right before submission
    if (!navigator.onLine) {
      setIsOffline(true)
    }

    setLoading(true)
    setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…")

    // If offline, store the report locally
    if (!navigator.onLine || isOffline) {
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
        setSubmitStage(null)
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

      const stageMessages: Record<CreateIncidentStage, string> = {
        "verify-session": "Verifying your session…",
        "upload-photo": "Uploading photo evidence…",
        "create-record": "Sending report to command center…",
        done: "Finalizing…",
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
        false,
        undefined,
        {
          sessionUserId: session.user.id,
          accessToken: session.access_token || undefined,
          onStageChange: (stage) => {
            setSubmitStage(stageMessages[stage] || null)
          },
        },
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
      setSubmitStage(null)
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
              ? "Life-threatening situation – focus on the essentials and submit as soon as you can."
              : "Please provide as much detail as possible to help emergency responders."}
          </p>
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

          {/* STEP 3: Incident Classification */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 3: Incident Classification</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Current incident type</p>
                <p className="text-base font-semibold text-gray-900">{formData.incidentType}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pick the option that matches what is happening. You can switch below if you tapped the wrong entry point.
                </p>
              </div>

              <div className="p-4 border border-yellow-200 rounded-md bg-yellow-50">
                <p className="text-sm font-medium text-gray-800">Who sets the classification?</p>
                <p className="text-xs text-gray-700 mt-1">
                  The system uses the button you tapped (Emergency or Non-Emergency) to route responders. If you selected the
                  wrong path, cancel below and re-open the correct report type so our team receives the proper alert.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => router.push("/resident/dashboard")}
                    className="text-sm font-semibold text-red-600 hover:text-red-500 underline"
                  >
                    Cancel and choose another option
                  </button>
                </div>
              </div>

              {/* Hidden priority field - auto-assigned based on emergency type */}
              <input type="hidden" name="priority" value={formData.priority} />

              {isEmergency ? (
                <div className="bg-red-50 p-3 rounded-md border border-red-200">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Emergency Priority: Critical (auto-assigned)
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Responders are alerted immediately with highest urgency.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 p-3 rounded-md border border-green-200">
                  <p className="text-sm text-green-800 font-medium">
                    ℹ️ Non-Emergency Priority: Standard (auto-assigned)
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    The team reviews and dispatches responders based on availability.
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
          {loading && submitStage && (
            <p className="text-right text-xs text-gray-500">{submitStage}</p>
          )}
        </form>
      </div>
    </ResidentLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Camera, MapPin, Upload, X } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { createIncident, type CreateIncidentStage } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { LocationTracker } from "@/components/location-tracker"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

export default function ReportIncidentPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportType = searchParams?.get("type")
  const isEmergency = reportType === "emergency"
  const autoIncidentType = useMemo(
    () => (isEmergency ? "EMERGENCY INCIDENT" : "COMMUNITY INCIDENT"),
    [isEmergency],
  )

  const [formData, setFormData] = useState({
    incidentType: autoIncidentType,
    description: "",
    address: "",
    barangay: "",
    priority: isEmergency ? "1" : "3",
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
  const [submitStage, setSubmitStage] = useState<string | null>(null)

  useEffect(() => {
    if (!reportType) {
      router.push("/resident/dashboard")
      return
    }
    setFormData((prev) => ({
      ...prev,
      incidentType: autoIncidentType,
      priority: isEmergency ? "1" : "3",
    }))
  }, [reportType, router, autoIncidentType, isEmergency])

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
      
      // Convert image to watermarked blob - properly await completion
      const watermarkedFile = await new Promise<File | null>((resolve) => {
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
          // Properly await the blob conversion
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
              resolve(watermarkedFile)
            } else {
              resolve(null)
            }
          }, 'image/jpeg', 0.7)
        }
        
        img.onerror = () => {
          resolve(null)
        }
        
        img.src = URL.createObjectURL(file)
      })

      if (watermarkedFile) {
        setPhotoFile(watermarkedFile)
        const previewURL = URL.createObjectURL(watermarkedFile)
        setPhotoPreview(previewURL)
        setPhotoCaptured(true)
        setError(null)
      } else {
        setError('Failed to process photo. Please try again.')
        setPhotoFile(null)
        setPhotoPreview(null)
        setPhotoCaptured(false)
      }
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

    // Step 3: Description required
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
    setSubmitStage(null)
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

    // Wait for photo to be ready before submitting
    if (!photoFile || !photoCaptured) {
      setError("Please take a photo of the incident")
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please take a photo of the incident"
      })
      return
    }

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      })
      return
    }

    // Check online status right before submission
    if (!navigator.onLine) {
      setIsOffline(true)
    }

    setLoading(true)
    setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…")

    // If offline, store the report locally
    if (!navigator.onLine || isOffline) {
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
        setSubmitStage(null)
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

      const stageMessages: Record<CreateIncidentStage, string> = {
        "verify-session": "Verifying your session…",
        "upload-photo": "Uploading photo evidence…",
        "create-record": "Sending report to command center…",
        done: "Finalizing…",
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
        false,
        undefined,
        {
          sessionUserId: session.user.id,
          accessToken: session.access_token || undefined,
          onStageChange: (stage) => {
            // Small debounce to prevent flickering
            setTimeout(() => {
              setSubmitStage(stageMessages[stage] || null)
            }, 50)
          },
        },
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
      setSubmitStage(null)
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
              ? "Life-threatening situation – focus on the essentials and submit as soon as you can."
              : "Please provide as much detail as possible to help emergency responders."}
          </p>
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

          {/* STEP 3: Incident Classification */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 3: Incident Classification</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Current incident type</p>
                <p className="text-base font-semibold text-gray-900">{formData.incidentType}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pick the option that matches what is happening. You can switch below if you tapped the wrong entry point.
                </p>
              </div>

              <div className="p-4 border border-yellow-200 rounded-md bg-yellow-50">
                <p className="text-sm font-medium text-gray-800">Who sets the classification?</p>
                <p className="text-xs text-gray-700 mt-1">
                  The system uses the button you tapped (Emergency or Non-Emergency) to route responders. If you selected the
                  wrong path, cancel below and re-open the correct report type so our team receives the proper alert.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => router.push("/resident/dashboard")}
                    className="text-sm font-semibold text-red-600 hover:text-red-500 underline"
                  >
                    Cancel and choose another option
                  </button>
                </div>
              </div>

              {/* Hidden priority field - auto-assigned based on emergency type */}
              <input type="hidden" name="priority" value={formData.priority} />

              {isEmergency ? (
                <div className="bg-red-50 p-3 rounded-md border border-red-200">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Emergency Priority: Critical (auto-assigned)
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Responders are alerted immediately with highest urgency.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 p-3 rounded-md border border-green-200">
                  <p className="text-sm text-green-800 font-medium">
                    ℹ️ Non-Emergency Priority: Standard (auto-assigned)
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    The team reviews and dispatches responders based on availability.
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
          {loading && submitStage && (
            <p className="text-right text-xs text-gray-500">{submitStage}</p>
          )}
        </form>
      </div>
    </ResidentLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Camera, MapPin, Upload, X } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { createIncident, type CreateIncidentStage } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { LocationTracker } from "@/components/location-tracker"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

export default function ReportIncidentPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportType = searchParams?.get("type")
  const isEmergency = reportType === "emergency"
  const autoIncidentType = useMemo(
    () => (isEmergency ? "EMERGENCY INCIDENT" : "COMMUNITY INCIDENT"),
    [isEmergency],
  )

  const [formData, setFormData] = useState({
    incidentType: autoIncidentType,
    description: "",
    address: "",
    barangay: "",
    priority: isEmergency ? "1" : "3",
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
  const [submitStage, setSubmitStage] = useState<string | null>(null)

  useEffect(() => {
    if (!reportType) {
      router.push("/resident/dashboard")
      return
    }
    setFormData((prev) => ({
      ...prev,
      incidentType: autoIncidentType,
      priority: isEmergency ? "1" : "3",
    }))
  }, [reportType, router, autoIncidentType, isEmergency])

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
      
      // Convert image to watermarked blob - properly await completion
      const watermarkedFile = await new Promise<File | null>((resolve) => {
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
          // Properly await the blob conversion
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
              resolve(watermarkedFile)
            } else {
              resolve(null)
            }
          }, 'image/jpeg', 0.7)
        }
        
        img.onerror = () => {
          resolve(null)
        }
        
        img.src = URL.createObjectURL(file)
      })

      if (watermarkedFile) {
        setPhotoFile(watermarkedFile)
        const previewURL = URL.createObjectURL(watermarkedFile)
        setPhotoPreview(previewURL)
        setPhotoCaptured(true)
        setError(null)
      } else {
        setError('Failed to process photo. Please try again.')
        setPhotoFile(null)
        setPhotoPreview(null)
        setPhotoCaptured(false)
      }
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

    // Step 3: Description required
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
    setSubmitStage(null)
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

    // Wait for photo to be ready before submitting
    if (!photoFile || !photoCaptured) {
      setError("Please take a photo of the incident")
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please take a photo of the incident"
      })
      return
    }

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      })
      return
    }

    // Check online status right before submission
    if (!navigator.onLine) {
      setIsOffline(true)
    }

    setLoading(true)
    setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…")

    // If offline, store the report locally
    if (!navigator.onLine || isOffline) {
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
        setSubmitStage(null)
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

      const stageMessages: Record<CreateIncidentStage, string> = {
        "verify-session": "Verifying your session…",
        "upload-photo": "Uploading photo evidence…",
        "create-record": "Sending report to command center…",
        done: "Finalizing…",
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
        false,
        undefined,
        {
          sessionUserId: session.user.id,
          accessToken: session.access_token || undefined,
          onStageChange: (stage) => {
            // Small debounce to prevent flickering
            setTimeout(() => {
              setSubmitStage(stageMessages[stage] || null)
            }, 50)
          },
        },
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
      // Revoke object URL to free memory
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoCaptured(false)

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
      setSubmitStage(null)
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
              ? "Life-threatening situation – focus on the essentials and submit as soon as you can."
              : "Please provide as much detail as possible to help emergency responders."}
          </p>
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

          {/* STEP 3: Incident Classification */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 3: Incident Classification</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Current incident type</p>
                <p className="text-base font-semibold text-gray-900">{formData.incidentType}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pick the option that matches what is happening. You can switch below if you tapped the wrong entry point.
                </p>
              </div>

              <div className="p-4 border border-yellow-200 rounded-md bg-yellow-50">
                <p className="text-sm font-medium text-gray-800">Who sets the classification?</p>
                <p className="text-xs text-gray-700 mt-1">
                  The system uses the button you tapped (Emergency or Non-Emergency) to route responders. If you selected the
                  wrong path, cancel below and re-open the correct report type so our team receives the proper alert.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => router.push("/resident/dashboard")}
                    className="text-sm font-semibold text-red-600 hover:text-red-500 underline"
                  >
                    Cancel and choose another option
                  </button>
                </div>
              </div>

              {/* Hidden priority field - auto-assigned based on emergency type */}
              <input type="hidden" name="priority" value={formData.priority} />

              {isEmergency ? (
                <div className="bg-red-50 p-3 rounded-md border border-red-200">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Emergency Priority: Critical (auto-assigned)
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Responders are alerted immediately with highest urgency.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 p-3 rounded-md border border-green-200">
                  <p className="text-sm text-green-800 font-medium">
                    ℹ️ Non-Emergency Priority: Standard (auto-assigned)
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    The team reviews and dispatches responders based on availability.
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
          {loading && submitStage && (
            <p className="text-right text-xs text-gray-500">{submitStage}</p>
          )}
        </form>
      </div>
    </ResidentLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Camera, MapPin, Upload, X } from "lucide-react"
import ResidentLayout from "@/components/layout/resident-layout"
import { useAuth } from "@/lib/auth"
import { createIncident, type CreateIncidentStage } from "@/lib/incidents"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { LocationTracker } from "@/components/location-tracker"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

export default function ReportIncidentPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reportType = searchParams?.get("type")
  const isEmergency = reportType === "emergency"
  const autoIncidentType = useMemo(
    () => (isEmergency ? "EMERGENCY INCIDENT" : "COMMUNITY INCIDENT"),
    [isEmergency],
  )

  const [formData, setFormData] = useState({
    incidentType: autoIncidentType,
    description: "",
    address: "",
    barangay: "",
    priority: isEmergency ? "1" : "3",
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
  const [submitStage, setSubmitStage] = useState<string | null>(null)

  useEffect(() => {
    if (!reportType) {
      router.push("/resident/dashboard")
      return
    }
    setFormData((prev) => ({
      ...prev,
      incidentType: autoIncidentType,
      priority: isEmergency ? "1" : "3",
    }))
  }, [reportType, router, autoIncidentType, isEmergency])

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
      
      // Convert image to watermarked blob - properly await completion
      const watermarkedFile = await new Promise<File | null>((resolve) => {
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
          // Properly await the blob conversion
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
              resolve(watermarkedFile)
            } else {
              resolve(null)
            }
          }, 'image/jpeg', 0.7)
        }
        
        img.onerror = () => {
          resolve(null)
        }
        
        img.src = URL.createObjectURL(file)
      })

      if (watermarkedFile) {
        setPhotoFile(watermarkedFile)
        const previewURL = URL.createObjectURL(watermarkedFile)
        setPhotoPreview(previewURL)
        setPhotoCaptured(true)
        setError(null)
      } else {
        setError('Failed to process photo. Please try again.')
        setPhotoFile(null)
        setPhotoPreview(null)
        setPhotoCaptured(false)
      }
    }
  }

  const removePhoto = () => {
    // Revoke object URL to free memory
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoCaptured(false)
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

    // Step 3: Description required
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
    setSubmitStage(null)
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

    // Wait for photo to be ready before submitting
    if (!photoFile || !photoCaptured) {
      setError("Please take a photo of the incident")
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please take a photo of the incident"
      })
      return
    }

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      })
      return
    }

    // Check online status right before submission
    if (!navigator.onLine) {
      setIsOffline(true)
    }

    setLoading(true)
    setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…")

    // If offline, store the report locally
    if (!navigator.onLine || isOffline) {
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
        setSubmitStage(null)
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

      const stageMessages: Record<CreateIncidentStage, string> = {
        "verify-session": "Verifying your session…",
        "upload-photo": "Uploading photo evidence…",
        "create-record": "Sending report to command center…",
        done: "Finalizing…",
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
        false,
        undefined,
        {
          sessionUserId: session.user.id,
          accessToken: session.access_token || undefined,
          onStageChange: (stage) => {
            // Small debounce to prevent flickering
            setTimeout(() => {
              setSubmitStage(stageMessages[stage] || null)
            }, 50)
          },
        },
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
      // Revoke object URL to free memory
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoCaptured(false)

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
      setSubmitStage(null)
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
              ? "Life-threatening situation – focus on the essentials and submit as soon as you can."
              : "Please provide as much detail as possible to help emergency responders."}
          </p>
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

          {/* STEP 3: Incident Classification */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Step 3: Incident Classification</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Current incident type</p>
                <p className="text-base font-semibold text-gray-900">{formData.incidentType}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pick the option that matches what is happening. You can switch below if you tapped the wrong entry point.
                </p>
              </div>

              <div className="p-4 border border-yellow-200 rounded-md bg-yellow-50">
                <p className="text-sm font-medium text-gray-800">Who sets the classification?</p>
                <p className="text-xs text-gray-700 mt-1">
                  The system uses the button you tapped (Emergency or Non-Emergency) to route responders. If you selected the
                  wrong path, cancel below and re-open the correct report type so our team receives the proper alert.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => router.push("/resident/dashboard")}
                    className="text-sm font-semibold text-red-600 hover:text-red-500 underline"
                  >
                    Cancel and choose another option
                  </button>
                </div>
              </div>

              {/* Hidden priority field - auto-assigned based on emergency type */}
              <input type="hidden" name="priority" value={formData.priority} />

              {isEmergency ? (
                <div className="bg-red-50 p-3 rounded-md border border-red-200">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Emergency Priority: Critical (auto-assigned)
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Responders are alerted immediately with highest urgency.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 p-3 rounded-md border border-green-200">
                  <p className="text-sm text-green-800 font-medium">
                    ℹ️ Non-Emergency Priority: Standard (auto-assigned)
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    The team reviews and dispatches responders based on availability.
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
          {loading && submitStage && (
            <p className="text-right text-xs text-gray-500">{submitStage}</p>
          )}
        </form>
      </div>
    </ResidentLayout>
  )
}

```


Improving the navbar with a hamburger menu for all panels:


```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-2">
            <button
              className="text-gray-500 hover:text-gray-600"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <button
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
              onClick={toggleSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <PanelLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}


```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}


```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800">Volunteer Portal</h1>
              <div className="flex items-center space-x-4">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <button
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
            
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800 hidden lg:block">Volunteer Portal</h1>
              <div className="flex items-center space-x-4 ml-auto">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}

```


Fixing push notifications for PWA. Checking the service worker registration path:



Fixing the service worker registration path and ensuring push notifications initialize properly:


```typescript
"use client"

/**
 * Push Notification Service
 * Handles web push notifications for instant volunteer alerts
 * Uses Web Push API with service worker
 */

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

class PushNotificationService {
  private static instance: PushNotificationService
  private registration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService()
    }
    return PushNotificationService.instance
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied'
    }
    return Notification.permission
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications not supported')
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      throw new Error('Notification permission denied')
    }

    const permission = await Notification.requestPermission()
    return permission
  }

  /**
   * Initialize push notifications
   * Registers service worker and creates push subscription
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        console.warn('[push] Push notifications not supported')
        return false
      }

      // Request permission
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        console.warn('[push] Permission not granted:', permission)
        return false
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js')
      console.log('[push] Service worker registered')

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready

      // Check for existing subscription
      this.subscription = await this.registration.pushManager.getSubscription()

      if (!this.subscription) {
        // Create new subscription
        await this.subscribe()
      } else {
        console.log('[push] Existing subscription found')
        // Send subscription to server
        await this.sendSubscriptionToServer(this.subscription)
      }

      return true
    } catch (error: any) {
      console.error('[push] Initialization error:', error)
      return false
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        throw new Error('Service worker not registered')
      }

      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-key')
      if (!response.ok) {
        throw new Error('Failed to get VAPID key')
      }

      const { publicKey } = await response.json()
      const convertedKey = this.urlBase64ToUint8Array(publicKey)

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      })

      console.log('[push] Subscribed to push notifications')

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription)

      return this.subscription
    } catch (error: any) {
      console.error('[push] Subscription error:', error)
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        return true
      }

      // Unsubscribe from push manager
      const success = await this.subscription.unsubscribe()

      if (success) {
        // Remove subscription from server
        await this.removeSubscriptionFromServer(this.subscription)
        this.subscription = null
        console.log('[push] Unsubscribed from push notifications')
      }

      return success
    } catch (error: any) {
      console.error('[push] Unsubscribe error:', error)
      return false
    }
  }

  /**
   * Send subscription to server for storage
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      // Store the entire subscription object as JSONB (matches database schema)
      const subscriptionData = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscriptionData // Send as JSONB object
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save subscription')
      }

      console.log('[push] Subscription saved to server')
    } catch (error: any) {
      console.error('[push] Error saving subscription:', error)
      throw error
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      })

      if (!response.ok) {
        throw new Error('Failed to remove subscription')
      }

      console.log('[push] Subscription removed from server')
    } catch (error: any) {
      console.error('[push] Error removing subscription:', error)
    }
  }

  /**
   * Show a local notification (for testing)
   */
  async showNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered')
    }

    await this.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      tag: payload.tag || 'default',
      data: payload.data,
      actions: payload.actions,
      vibrate: [200, 100, 200],
      requireInteraction: true
    })
  }

  /**
   * Get current subscription
   */
  getSubscription(): PushSubscription | null {
    return this.subscription
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

export const pushNotificationService = PushNotificationService.getInstance()

```


Ensuring push notifications initialize properly in all layouts. Adding initialization logic:


```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <button
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
              onClick={toggleSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Initialize push notifications for PWA
  useEffect(() => {
    const initPushNotifications = async () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          // Check if already subscribed
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.getSubscription()
          
          // If not subscribed and permission is granted, try to initialize
          if (!subscription && Notification.permission === 'granted') {
            await pushNotificationService.initialize()
          } else if (subscription) {
            // Ensure subscription is sent to server
            await pushNotificationService.sendSubscriptionToServer(subscription)
          }
        } catch (error) {
          console.error('[resident-layout] Push notification init error:', error)
        }
      }
    }
    
    initPushNotifications()
  }, [])

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <button
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
              onClick={toggleSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>
    </AuthLayout>
  )
}

```


Making the method public and adding initialization to all layouts:


```typescript
"use client"

/**
 * Push Notification Service
 * Handles web push notifications for instant volunteer alerts
 * Uses Web Push API with service worker
 */

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

class PushNotificationService {
  private static instance: PushNotificationService
  private registration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService()
    }
    return PushNotificationService.instance
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied'
    }
    return Notification.permission
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications not supported')
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      throw new Error('Notification permission denied')
    }

    const permission = await Notification.requestPermission()
    return permission
  }

  /**
   * Initialize push notifications
   * Registers service worker and creates push subscription
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        console.warn('[push] Push notifications not supported')
        return false
      }

      // Request permission
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        console.warn('[push] Permission not granted:', permission)
        return false
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js')
      console.log('[push] Service worker registered')

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready

      // Check for existing subscription
      this.subscription = await this.registration.pushManager.getSubscription()

      if (!this.subscription) {
        // Create new subscription
        await this.subscribe()
      } else {
        console.log('[push] Existing subscription found')
        // Send subscription to server
        await this.sendSubscriptionToServer(this.subscription)
      }

      return true
    } catch (error: any) {
      console.error('[push] Initialization error:', error)
      return false
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        throw new Error('Service worker not registered')
      }

      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-key')
      if (!response.ok) {
        throw new Error('Failed to get VAPID key')
      }

      const { publicKey } = await response.json()
      const convertedKey = this.urlBase64ToUint8Array(publicKey)

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      })

      console.log('[push] Subscribed to push notifications')

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription)

      return this.subscription
    } catch (error: any) {
      console.error('[push] Subscription error:', error)
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        return true
      }

      // Unsubscribe from push manager
      const success = await this.subscription.unsubscribe()

      if (success) {
        // Remove subscription from server
        await this.removeSubscriptionFromServer(this.subscription)
        this.subscription = null
        console.log('[push] Unsubscribed from push notifications')
      }

      return success
    } catch (error: any) {
      console.error('[push] Unsubscribe error:', error)
      return false
    }
  }

  /**
   * Send subscription to server for storage
   */
  async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      // Store the entire subscription object as JSONB (matches database schema)
      const subscriptionData = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscriptionData // Send as JSONB object
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save subscription')
      }

      console.log('[push] Subscription saved to server')
    } catch (error: any) {
      console.error('[push] Error saving subscription:', error)
      throw error
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      })

      if (!response.ok) {
        throw new Error('Failed to remove subscription')
      }

      console.log('[push] Subscription removed from server')
    } catch (error: any) {
      console.error('[push] Error removing subscription:', error)
    }
  }

  /**
   * Show a local notification (for testing)
   */
  async showNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered')
    }

    await this.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/badge-72x72.png',
      tag: payload.tag || 'default',
      data: payload.data,
      actions: payload.actions,
      vibrate: [200, 100, 200],
      requireInteraction: true
    })
  }

  /**
   * Get current subscription
   */
  getSubscription(): PushSubscription | null {
    return this.subscription
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

export const pushNotificationService = PushNotificationService.getInstance()

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Initialize push notifications for PWA
  useEffect(() => {
    const initPushNotifications = async () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && pushNotificationService.isSupported()) {
        try {
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready
          
          // Check if already subscribed
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            const subscription = await registration.pushManager.getSubscription()
            
            // If subscribed, ensure it's sent to server
            if (subscription && user?.id) {
              try {
                await pushNotificationService.sendSubscriptionToServer(subscription)
              } catch (error) {
                console.warn('[resident-layout] Could not sync subscription:', error)
              }
            }
          }
        } catch (error) {
          console.error('[resident-layout] Push notification init error:', error)
        }
      }
    }
    
    if (user?.id) {
      initPushNotifications()
    }
  }, [user?.id])

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <button
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
              onClick={toggleSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}


```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Initialize push notifications for PWA
  useEffect(() => {
    const initPushNotifications = async () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && pushNotificationService.isSupported()) {
        try {
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready
          
          // Check if already subscribed
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            const subscription = await registration.pushManager.getSubscription()
            
            // If subscribed, ensure it's sent to server
            if (subscription && user?.id) {
              try {
                await pushNotificationService.sendSubscriptionToServer(subscription)
              } catch (error) {
                console.warn('[admin-layout] Could not sync subscription:', error)
              }
            }
          }
        } catch (error) {
          console.error('[admin-layout] Push notification init error:', error)
        }
      }
    }
    
    if (user?.id) {
      initPushNotifications()
    }
  }, [user?.id])

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}


```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"
import { useAuth } from "@/lib/auth"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <button
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
            
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800 hidden lg:block">Volunteer Portal</h1>
              <div className="flex items-center space-x-4 ml-auto">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"
import { useAuth } from "@/lib/auth"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Initialize push notifications for PWA
  useEffect(() => {
    const initPushNotifications = async () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && pushNotificationService.isSupported()) {
        try {
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready
          
          // Check if already subscribed
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            const subscription = await registration.pushManager.getSubscription()
            
            // If subscribed, ensure it's sent to server
            if (subscription && user?.id) {
              try {
                await pushNotificationService.sendSubscriptionToServer(subscription)
              } catch (error) {
                console.warn('[volunteer-layout] Could not sync subscription:', error)
              }
            }
          }
        } catch (error) {
          console.error('[volunteer-layout] Push notification init error:', error)
        }
      }
    }
    
    if (user?.id) {
      initPushNotifications()
    }
  }, [user?.id])

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <button
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
            
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800 hidden lg:block">Volunteer Portal</h1>
              <div className="flex items-center space-x-4 ml-auto">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}

```


Checking the volunteer layout import:



Fixing the import conflict in the volunteer layout:


```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Initialize push notifications for PWA
  useEffect(() => {
    const initPushNotifications = async () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && pushNotificationService.isSupported()) {
        try {
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready
          
          // Check if already subscribed
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            const subscription = await registration.pushManager.getSubscription()
            
            // If subscribed, ensure it's sent to server
            if (subscription && user?.id) {
              try {
                await pushNotificationService.sendSubscriptionToServer(subscription)
              } catch (error) {
                console.warn('[volunteer-layout] Could not sync subscription:', error)
              }
            }
          }
        } catch (error) {
          console.error('[volunteer-layout] Push notification init error:', error)
        }
      }
    }
    
    if (user?.id) {
      initPushNotifications()
    }
  }, [user?.id])

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <button
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
            
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800 hidden lg:block">Volunteer Portal</h1>
              <div className="flex items-center space-x-4 ml-auto">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}

```


Removing the duplicate import:


```typescriptreact
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"
```


## Summary of Changes

### 1. Fixed incident report photo processing
- Updated `handlePhotoChange` in `src/app/resident/report/page.tsx` to await `canvas.toBlob` using a Promise wrapper
- Ensures `photoFile` is set before submission
- Added error handling for image processing failures

### 2. Fixed handleSubmit
- Added validation to wait for `photoFile` and `photoCaptured` before submission
- Added online status check right before submission
- Added debounce (50ms) to `setSubmitStage` updates to reduce flicker
- Added memory cleanup by revoking object URLs after submission

### 3. Improved navbar with hamburger menu
- Resident Layout: Added hamburger menu icon (`Menu`) for mobile, improved mobile header with centered title
- Admin Layout: Replaced `PanelLeft` with `Menu` icon for consistency
- Volunteer Layout: Added hamburger menu icon and improved mobile header layout
- All layouts now have consistent, simple hamburger menus

### 4. Push notifications for PWA
- Fixed service worker registration path in `push-notification-service.ts` from `/sw.js` to `/service-worker.js`
- Made `sendSubscriptionToServer` public for external calls
- Added push notification initialization in all three layout components:
  - Resident Layout
  - Admin Layout
  - Volunteer Layout
- Initialization checks for existing subscriptions and syncs them to the server when users are logged in
- Works in PWA mode by waiting for service worker to be ready

All changes are complete and lint-free. The incident report submission should be faster and more reliable, the navbar is improved with hamburger menus, and push notifications are properly initialized for all user panels in PWA mode.

---

**User**

pls double check all the thing for that u did,, the risks are below:





---



# ⚠️ **OVERALL ASSESSMENT**

The fixes **look good individually**,
**BUT they absolutely introduce risk to previous processes.**

They touch high-impact systems and **can break previously working functionality**, especially around:

* PWA
* Notifications
* Service Worker
* Layout logic
* Core workflows

Below is the honest breakdown.

---

# 🔥 **1. Push Notification + Service Worker Changes — HIGH RISK**

Changing:

* Service worker path
* Registration logic
* Initialization flow
* When and where subscriptions are synced

is extremely risky.

This can break:

* Push notifications
* Offline caching
* Background sync
* PWA installation
* Cached SW updates
* Vercel SW routing

This is the **#1 most dangerous change**.

### Brutal reality:

> If the previous system depended on `/sw.js`, switching to `/service-worker.js` can completely break push notifications and PWA mode.

---

# 🔥 **2. Adding Notification Initialization to ALL Layouts — HIGH TO MODERATE RISK**

Putting initialization inside:

* Admin layout
* Resident layout
* Volunteer layout

creates:

* multiple registration attempts
* race conditions
* duplicate subscriptions
* unpredictable SW timing issues

If a layout loads before the SW is ready → notifications break.

### Blunt truth:

> Multiple layout-level initializations can cause inconsistent notification behavior and double subscription entries in the backend.

---

# 🔥 **3. Navbar / Hamburger Menu Changes — LOW TO MODERATE RISK**

Mostly cosmetic, but still risky because:

* Some pages rely on previous header structure
* Height changes affect mobile scroll containers
* Some admin/volunteer screens might shift or misalign

### Honest verdict:

> Not destructive, but can break responsive layouts or expected navigation flows.

---

# 🔥 **4. Incident Photo Handling Fix — LOW RISK BUT SENSITIVE**

Changing:

* `canvas.toBlob` behavior
* File type
* Image compression
* Async timing

can affect:

* backend compatibility
* upload size
* mobile device camera flow

### Truth:

> Could break older behavior if the backend relied on the previous file format or timing.

---

# 🔥 **5. Updating Incident Submit Logic — MODERATE RISK**

New:

* validation
* awaits
* submit stage debounce
* cleanup logic

can cause:

* timing mismatches
* stricter requirements → broken edge cases
* unexpected blocking of valid submissions

### Brutal truth:

> If the backend allowed looser rules before, the new logic might stop certain incident reports from going through.

---

# 🧨 **RISK RANKING (Worst → safest)**

1. **Service worker path change (PWA + push notifications)**
2. **Push notification initialization in all layouts**
3. **Subscription syncing changes**
4. **Incident submit logic changes**
5. **Navbar changes**
6. **Photo processing changes**

---

These fixes **ARE NOT HARMLESS**.

### ☑️ They improve behavior in many areas.

### 🚫 But YES — they CAN break:

* existing PWA flows
* cached service worker behavior
* device subscription logic
* notification delivery
* certain incident submission cases
* mobile page layouts

Deploying without regression testing is a **big risk**.

### HARD TRUTH:

> These changes touch core workflow code.
> They CAN break previously working features if not tested thoroughly.

---




---

**Cursor**


Reviewing the changes and verifying service worker files and registration paths to mitigate risks:



Checking which service worker files exist and how they're registered:



Checking both service worker files and fixing the issues:



Fixing the issues: reverting risky initialization changes and making the remaining changes safer:


```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <button
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
              onClick={toggleSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import EmergencyCallButtonEnhanced from "@/components/emergency-call-button-enhanced"
import { ResidentNotifications } from "@/components/resident/resident-notifications"
import { SystemClock } from "@/components/system-clock"

interface ResidentLayoutProps {
  children: React.ReactNode
}

export default function ResidentLayout({ children }: ResidentLayoutProps) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Notifications realtime subscription
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/resident/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/resident/report", icon: AlertTriangle },
    { name: "Report History", href: "/resident/history", icon: AlertTriangle },
    { name: "Announcements", href: "/announcements", icon: AlertTriangle },
    { name: "Profile", href: "/resident/profile", icon: User },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      const result = await signOut()
      if (result.success) {
        router.replace('/login')
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  // Optimize emergency call handler
  const handleEmergencyCall = useCallback(async () => {
    try {
      const userId = user?.id || null
      // Load call preferences
      let number = "09998064555"
      if (userId) {
        try {
          const prefRes = await fetch(`/api/call-preferences?user_id=${encodeURIComponent(userId)}`)
          const prefJson = await prefRes.json()
          if (prefRes.ok && prefJson?.data?.emergency_shortcut) {
            number = prefJson.data.emergency_shortcut
          }
        } catch { void 0 }
      }

      // Fire-and-forget call log
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            contact_id: 'emergency',
            contact_name: 'Emergency',
            contact_number: number,
            call_type: 'emergency',
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }

      // Initiate the call
      window.location.href = `tel:${number}`
    } catch {
      window.location.href = "tel:09998064555"
    }
  }, [user])

  // Optimize sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  return (
    <AuthLayout allowedRoles={["resident"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-red-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-red-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Resident</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-red-700"
              onClick={toggleSidebar}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-red-700 text-white" : "hover:bg-red-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleEmergencyCall}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left bg-red-600 hover:bg-red-500 mt-4 transition-colors"
            >
              <Phone className="h-5 w-5" />
              <span>Emergency Call</span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-red-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <button
              className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md p-1"
              onClick={toggleSidebar}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          {/* Top bar with notifications */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">Resident Portal</h1>
            <div className="flex items-center space-x-4">
              <SystemClock className="hidden md:block" />
              <ResidentNotifications />
            </div>
          </div>

          {/* Main content area with Suspense boundary */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/* Add bottom padding so floating FAB doesn't overlap interactive controls */}
            <main className="flex-1 overflow-auto pb-24">
              <SubscribeBanner userId={user?.id} />
              {children}
            </main>
            {/* Floating emergency call button, visible across resident pages (except report as handled internally) */}
            <EmergencyCallButtonEnhanced />
          </Suspense>
        </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}


```

```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/volunteers") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}


```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"
import { pushNotificationService } from "@/lib/push-notification-service"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <button
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
            
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800 hidden lg:block">Volunteer Portal</h1>
              <div className="flex items-center space-x-4 ml-auto">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}

```

```typescriptreact
"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Calendar, User, X, AlertTriangle, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { useAuth } from "@/hooks/use-auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { VolunteerNotificationsNew } from "@/components/volunteer/volunteer-notifications-new"
import { SystemClock } from "@/components/system-clock"

interface VolunteerLayoutProps {
  children: React.ReactNode
}

export const VolunteerLayout: React.FC<VolunteerLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, user } = useAuth()

  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Memoize navigation items to prevent unnecessary re-renders
  const navigationItems = useMemo(() => [
    { name: "Dashboard", href: "/volunteer/dashboard", icon: AlertTriangle },
    { name: "Report Incident", href: "/volunteer/report", icon: AlertTriangle },
    { name: "Assigned Incidents", href: "/volunteer/incidents", icon: Bell },
    { name: "Schedules", href: "/volunteer/schedules", icon: Calendar },
    { name: "Documents", href: "/volunteer/documents", icon: Calendar },
    { name: "Live Location", href: "/volunteer/location", icon: Calendar },
    { name: "Profile", href: "/volunteer/profile", icon: User },
    { name: "Emergency Contacts", href: "/volunteer/lgu-directory", icon: Bell },
  ], [])

  // Prefetch all navigation routes on mount
  useEffect(() => {
    router.prefetch('/login')
    navigationItems.forEach(item => {
      router.prefetch(item.href)
    })
  }, [router, navigationItems])

  // Memoize active path check
  const isActive = useCallback((path: string) => pathname === path, [pathname])

  // Optimize sign out handler
  const handleSignOut = useCallback(async () => {
    if (loading) return // Prevent multiple clicks
    setLoading(true)
    
    try {
      // Clean up any active subscriptions
      supabase.removeAllChannels()
      
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setLoading(false)
    }
  }, [loading, router, signOut])

  // Optimize navigation handler
  const handleNavigation = useCallback(async (href: string) => {
    if (isNavigating) return // Prevent multiple clicks
    setIsNavigating(true)
    
    // Close mobile sidebar if needed
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    
    try {
      await router.push(href)
    } finally {
      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 300)
    }
  }, [isNavigating, router])

  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-green-800 text-white transition-gpu duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-green-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Volunteer</span>
            </div>
            <button
              className="p-1 rounded-md lg:hidden hover:bg-green-700"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center space-x-2 p-2 rounded-md w-full ${
                  isActive(item.href) ? "bg-green-700 text-white" : "hover:bg-green-700"
                } ${isNavigating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isNavigating}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {isNavigating && isActive(item.href) && (
                  <LoadingSpinner size="sm" color="text-white" className="ml-2" />
                )}
              </button>
            ))}

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex items-center space-x-2 p-2 rounded-md w-full text-left hover:bg-green-700 mt-4 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <button
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-md p-1"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">RVOIS</h1>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
            
            {/* Top bar with notifications */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
              <h1 className="text-lg font-semibold text-gray-800 hidden lg:block">Volunteer Portal</h1>
              <div className="flex items-center space-x-4 ml-auto">
                <SystemClock className="hidden md:block" />
                <VolunteerNotificationsNew />
              </div>
            </div>

            {/* Main content area with Suspense boundary */}
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </Suspense>
          </div>
      </div>
    </AuthLayout>
  )
}

```


Verifying the service worker path is correct and checking for other issues:



## Risk mitigation summary

### Removed high-risk changes
1. Removed push notification initialization from all layouts — this could cause:
   - Race conditions
   - Duplicate subscriptions
   - Conflicts with existing service worker registrations

Push notifications still work through:
- `SubscribeBanner` component (already in layouts)
- `PushNotificationToggle` component
- Manual initialization when needed

### Kept safe changes

1. Service worker path fix (`/service-worker.js`)
   - Correct: `service-worker.js` has push notification handlers
   - Consistent: `subscribe-banner.tsx` already uses this path
   - Safe: The file exists and is the correct one for push notifications

2. Photo processing fix
   - Safe: Properly awaits `canvas.toBlob` completion
   - No format changes: Still JPEG at 0.7 quality
   - Fixes the original bug: Prevents null photoFile on submit

3. Submit logic improvements
   - Safe: Adds validation to prevent null photoFile submissions
   - Safe: 50ms debounce prevents UI flickering
   - Safe: Memory cleanup prevents leaks
   - These are defensive improvements, not breaking changes

4. Navbar improvements
   - Safe: Cosmetic changes only (hamburger menu icons)
   - No functional changes to navigation logic

### Final status

- High-risk initialization code: removed
- Service worker path: correct and safe
- Photo processing: fixed and safe
- Submit logic: improved and safe
- Navbar: cosmetic only, safe

The changes are now safer and should not break existing functionality. The main risk (multiple initialization attempts) has been removed, and the remaining changes are bug fixes and improvements.

---

**User**

pls fix if lackings or incompleteness or buttons not working or UI dispplay, verify first:


can u pls check now all the reports we have currently in all users, check any inconsistency and not working.. also can u pls do check the documents section navbar of admin that has feature of uploading file, that in there, it can be renamed anytime the filename being displayed in the admin panel, do it

regarding volunteer profiling:
Data Collection:

Extract all historical incident logs associated with each volunteer.

Include key fields: incident type, date/time, location, severity, and any volunteer-specific actions.

Analytics:

Generate descriptive statistics per volunteer: total incidents handled, average response time, incident types handled, and other relevant metrics.

Include trends over time (daily, weekly, monthly).

Reporting:

The analytics must be reflected in a report-friendly format (tables, charts, graphs).

Reports should allow filtering by volunteer, date range, incident type, and other relevant parameters.

Ensure the reports are exportable (PDF or CSV) if needed.

UI / Dashboard Integration:

Integrate volunteer analytics into the admin dashboard.

Provide interactive visualization options for easy interpretation.

Data Accuracy & Performance:

Ensure historical data is correctly matched to each volunteer.


Provide clear instructions for report generation and interpretation.

Goal:
Enable the team to profile volunteer activity accurately and generate descriptive analytics reports that inform operational and strategic decisions.


do check that volunteer can only declare/input asses of severity level when it arrived on the reported place,, like it can update the incident details

---

**Cursor**


Reviewing the codebase to identify issues and plan improvements. Starting with reports across user panels, then documents, volunteer profiling, and incident updates.



Trying more targeted searches:



Reading key files:



Checking volunteer incident updates and analytics:



Reviewing the severity update route and volunteer analytics:



Checking the volunteer incident page for severity update UI and reviewing the volunteer analytics library:



Creating the volunteer analytics dashboard and adding the severity update UI. Starting with the volunteer incident page to add severity update functionality:



Found the severity updater component. Adding it to the volunteer incident page and creating the volunteer analytics dashboard. Starting with the volunteer incident page:



Adding the severity updater to the volunteer incident page and creating the volunteer analytics dashboard. Starting with the severity updater:


```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { getIncidentById, updateIncidentStatus } from "@/lib/incidents"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { AlertTriangle, CheckCircle, Clock, Phone, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { IncidentCallActions } from "@/components/incident-call-actions"
import IncidentOTWButton from "@/components/incident-otw-button"
import IncidentStatusDropdown from "@/components/incident-status-dropdown"
import IncidentSeverityUpdater from "@/components/incident-severity-updater"

export default function VolunteerIncidentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [incident, setIncident] = useState<any>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth to finish loading before proceeding
    if (authLoading) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      if (!user) {
        console.log("No authenticated user found, redirecting to login");
        router.push('/login');
        return;
      }
      
      // Extract ID properly from params, ensuring it's a string
      const incidentId = params?.id;
      if (!incidentId) {
        console.log("No incident ID found in URL params");
        if (isMounted) {
          setError("No incident ID provided");
          setLoading(false);
        }
        return;
      }
      
      try {
        // Convert to string if it's an array or other type
        const idToUse = Array.isArray(incidentId) ? incidentId[0] : String(incidentId);
        
        console.log(`Fetching incident details for ID: ${idToUse} (${typeof idToUse})`);
        
        // Make sure we have a properly formatted UUID
        if (!idToUse.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.error("Invalid incident ID format in URL:", idToUse);
          if (isMounted) {
            setError("Invalid incident ID format");
            setLoading(false);
          }
          return;
        }
        
        // Fetch incident details
        const incidentResult = await getIncidentById(idToUse)
        console.log("Incident fetch result:", incidentResult);
        
        if (!isMounted) return;
        
        if (incidentResult.success && incidentResult.data) {
          setIncident(incidentResult.data);
          setError(null);
          
          // Check if current user is assigned to this incident
          // Allow admins to view any incident
          // Handle both direct ID and joined user object
          const assignedUserId = incidentResult.data.assigned_to || 
                                (incidentResult.data.assignee && incidentResult.data.assignee.id) || 
                                null;
          
          if (user.role !== 'admin' && assignedUserId !== user.id) {
            setError("You are not assigned to this incident");
            return;
          }
        } else {
          setError(incidentResult.message || "Failed to fetch incident details");
        }
      } catch (err: any) {
        console.error("Error fetching incident details:", err);
        if (isMounted) {
          setError(err.message || "An unexpected error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setError(null);
    fetchData();
    
    // Add a timeout to prevent infinite loading state
    const loadingTimeout = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        setError("Loading timed out. Please refresh the page.");
      }
    }, 30000); // 30 seconds timeout
    
    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
    }
  }, [params, user, authLoading, router]); // Added authLoading and router dependencies

  const handleUpdateStatus = async (newStatus: "RESPONDING" | "RESOLVED") => {
    if (!user || !incident) return

    try {
      setUpdating(true)
      setError(null)
      
      // Validate inputs
      if (newStatus === "RESOLVED" && !resolutionNotes.trim()) {
        setError("Resolution notes are required when resolving an incident")
        setUpdating(false)
        return
      }
      
      // Validate incident ID format
      if (!incident.id || typeof incident.id !== 'string') {
        console.error("Missing incident ID:", incident);
        setError("Invalid incident: missing ID");
        setUpdating(false);
        return;
      }
      
      // Validate UUID format
      if (!incident.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error("Invalid incident ID format:", incident.id);
        setError("Invalid incident ID format");
        setUpdating(false);
        return;
      }
      
      console.log("Updating incident status:", {
        volunteerId: user.id,
        incidentId: incident.id,
        current_status: incident.status,
        newStatus,
        hasNotes: !!resolutionNotes
      })
      
      try {
        // First, do a direct SQL update to force the incident status change
        if (newStatus === "RESOLVED") {
          try {
            console.log("Attempting progressive update approaches");
            
            // Track whether any update has succeeded
            let updateSucceeded = false;
            
            // ===== ATTEMPT 1: Try filter method =====
            try {
              console.log("Attempt 1: Filter-based update");
              
              const { error } = await (supabase as any)
                .from('incidents')
                .update({ 
                  status: 'RESOLVED' as const,
                  resolved_at: new Date().toISOString(),
                  resolution_notes: resolutionNotes || null
                })
                .eq('id', incident.id);
                
              if (error) {
                console.error("Filter update failed:", error);
                throw error;
              }
              
              console.log("Filter update succeeded!");
              updateSucceeded = true;
              
            } catch (filterError) {
              console.error("Attempt 1 failed:", filterError);
              
              // ===== ATTEMPT 2: Try match method =====
              try {
                console.log("Attempt 2: Match-based update");
                
                const { error } = await (supabase as any)
                  .from('incidents')
                  .update({ 
                    status: 'RESOLVED' as const,
                    resolved_at: new Date().toISOString(),
                    resolution_notes: resolutionNotes || null
                  })
                  .eq('id', incident.id);
                  
                if (error) {
                  console.error("Match update failed:", error);
                  throw error;
                }
                
                console.log("Match update succeeded!");
                updateSucceeded = true;
                
              } catch (matchError) {
                console.error("Attempt 2 failed:", matchError);
                
                // ===== ATTEMPT 3: Try eq method with minimal fields =====
                try {
                  console.log("Attempt 3: Minimal update");
                  
                  // Only update the status field, which is less likely to cause problems
                  const { error } = await (supabase as any)
                    .from('incidents')
                    .update({ status: 'RESOLVED' as const })
                    .eq('id', incident.id);
                    
                  if (error) {
                    console.error("Minimal update failed:", error);
                    throw error;
                  }
                  
                  console.log("Minimal update succeeded!");
                  updateSucceeded = true;
                  
                } catch (minError) {
                  console.error("Attempt 3 failed:", minError);
                  throw minError; // Let it propagate to the outer catch
                }
              }
            }
            
            // If any update method succeeded, update the volunteer profile
            if (updateSucceeded) {
              try {
                console.log("Updating volunteer profile");
                
                // IMPORTANT: Use manual update to avoid the trigger issues
                // First get current count
                const { data: profileData } = await supabase
                  .from('volunteer_profiles')
                  .select('total_incidents_resolved')
                  .eq('volunteer_user_id', user.id)
                  .single();
                  
                const currentCount = (profileData as any)?.total_incidents_resolved || 0;
                const newCount = currentCount + 1;
                
                // Update the profile
                const { error: profileError } = await (supabase as any)
                  .from('volunteer_profiles')
                  .update({ 
                    total_incidents_resolved: newCount,
                    is_available: true 
                  })
                  .eq('volunteer_user_id', user.id);
                  
                if (profileError) {
                  console.error("Profile update failed (non-critical):", profileError);
                } else {
                  console.log(`Profile updated to ${newCount} resolved incidents`);
                }

                // Update local state and show success message
                setIncident({
                  ...incident,
                  status: 'RESOLVED',
                  resolved_at: new Date().toISOString(),
                  resolution_notes: resolutionNotes
                });
                
                setSuccessMessage("✅ Incident resolved successfully! Admins and the reporter have been notified.");
                return; // Skip the standard update function
                
              } catch (profileErr) {
                console.error("Error in profile update (non-critical):", profileErr);
                
                // Still consider this a success since the incident was updated
                setIncident({
                  ...incident,
                  status: 'RESOLVED'
                });
                
                setSuccessMessage("✅ Incident marked as resolved! Admins and the reporter have been notified.");
                return; // Skip the standard update function
              }
            }
            
          } catch (error) {
            console.error("All update approaches failed:", error);
            // Fall through to standard update if direct updates fail
          }
        }
        
        // Standard update approach as fallback
        const result = await updateIncidentStatus(
          user.id,
          incident.id,
          newStatus,
          newStatus === "RESOLVED" ? resolutionNotes : undefined
        )
        
        console.log("Status update result:", result)
        
        if (result.success) {
          // Update the incident state
          setIncident({
            ...incident,
            status: newStatus,
            responding_at: newStatus === "RESPONDING" ? new Date().toISOString() : incident.responding_at,
            resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : incident.resolved_at,
            resolution_notes: newStatus === "RESOLVED" ? resolutionNotes : incident.resolution_notes,
          })
          
          // Show success message with notification info
          if (newStatus === "RESOLVED") {
            setSuccessMessage("✅ Incident resolved successfully! Admins and the reporter have been notified.");
          } else if (newStatus === "RESPONDING") {
            setSuccessMessage("🚀 Status updated to responding! Admins and the reporter have been notified.");
          }
        } else {
          console.error("Failed to update status:", result);
          
          // Enhanced error handling with detailed column error tracking
          if (result.error?.message) {
            const errorMsg = result.error.message;
            
            // Print the exact error to help debugging
            console.error(`Database error details: ${errorMsg}`);
            
            if (errorMsg.includes("column") && errorMsg.includes("does not exist")) {
              // Try to extract column name
              const columnMatch = errorMsg.match(/column ["']([^"']+)["']/);
              const columnName = columnMatch ? columnMatch[1] : "unknown";
              
              setError(`Database error: Column '${columnName}' does not exist. Please contact support.`);
            } else {
              setError(result.message || `Failed to update status to ${newStatus}`);
            }
          } else {
            setError(result.message || `Failed to update status to ${newStatus}`);
          }
        }
      } catch (updateErr: any) {
        console.error("Exception during update:", updateErr);
        setError(updateErr.message || `Error during update: ${updateErr}`);
      }
    } catch (err: any) {
      console.error("Error in handleUpdateStatus:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800"
      case "RESPONDING":
        return "bg-orange-100 text-orange-800"
      case "RESOLVED":
        return "bg-green-100 text-green-800"
      case "CANCELLED":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const handleCallReporter = () => {
    if (incident?.reporter?.phone_number) {
      window.location.href = `tel:${incident.reporter.phone_number}`
    }
  }

  const getDirections = () => {
    if (incident?.location_lat && incident?.location_lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${incident.location_lat},${incident.location_lng}`
      window.open(url, "_blank")
    }
  }

  if (loading) {
    return (
      <VolunteerLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading incident details..." />
        </div>
      </VolunteerLayout>
    )
  }

  if (error) {
    return (
      <VolunteerLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </VolunteerLayout>
    )
  }

  if (!incident) {
    return (
      <VolunteerLayout>
        <div className="text-center py-12">
          <p className="text-black">Incident not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </VolunteerLayout>
    )
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Incident Details</h1>
            <p className="text-gray-600 mt-1">
              Reported on {formatDate(incident.created_at)} • ID: {incident.id}
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              Back to List
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-black">{incident.incident_type}</h2>
                  <span
                    className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                      incident.status,
                    )}`}
                  >
                    {incident.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-700">Priority</p>
                  <div className="flex items-center mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full mx-0.5 ${
                          i < incident.priority ? "bg-red-500" : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700">Description</h3>
                <p className="mt-1 text-black">{incident.description}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Location</h3>
                  <p className="mt-1 text-black">
                    {incident.address}, {incident.barangay}, {incident.city}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Reported By</h3>
                  {incident.reporter ? (
                    <div className="mt-1 flex items-center">
                      <User className="h-4 w-4 text-gray-500 mr-1" />
                      <p className="text-black">
                        {incident.reporter.first_name && incident.reporter.last_name
                          ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                          : incident.reporter.first_name || incident.reporter.last_name
                          ? (incident.reporter.first_name || incident.reporter.last_name)
                          : incident.reporter.email || "Anonymous Reporter"}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-700">Anonymous Reporter</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {incident.reporter?.phone_number && (
                  <button
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
                    onClick={handleCallReporter}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Reporter
                  </button>
                )}
                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
                  onClick={getDirections}
                >
                  Get Directions
                </button>
              </div>
            </div>

            {/* Enhanced Call Actions */}
            <IncidentCallActions 
              incident={incident}
              userRole="volunteer"
              onCallComplete={(callLog) => {
                console.log('Call completed:', callLog)
                // You can add additional logic here if needed
              }}
            />

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-black mb-4">Location</h2>
              <div className="h-64 rounded-md overflow-hidden">
                {incident.location_lat && incident.location_lng && (
                  <MapComponent
                    center={[incident.location_lat, incident.location_lng]}
                    zoom={15}
                    markers={[
                      {
                        id: incident.id,
                        position: [incident.location_lat, incident.location_lng],
                        title: incident.incident_type,
                        status: incident.status,
                      },
                    ]}
                  />
                )}
              </div>
            </div>

            {incident.photo_url && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold text-black mb-4">Photo</h2>
                <div className="rounded-md overflow-hidden">
                  <img
                    src={incident.photo_url}
                    alt={`Photo of ${incident.incident_type} reported on ${new Date(
                      incident.created_at
                    ).toLocaleDateString()}`}
                    className="w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-black mb-4">Status Update</h2>
              
              <div className="space-y-4">
                <p className="text-gray-700">
                  {incident.status === "ASSIGNED" && "You are assigned to this incident. Mark as responding when you're on your way."}
                  {incident.status === "RESPONDING" && "You are responding to this incident. Update status as you progress."}
                  {incident.status === "ARRIVED" && "You have arrived at the incident location. Mark as resolved when completed."}
                  {incident.status === "RESOLVED" && "This incident has been resolved."}
                </p>
                
                {user && (
                  <IncidentStatusDropdown
                    incidentId={incident.id}
                    currentStatus={incident.status}
                    volunteerId={user.id}
                    onStatusUpdate={(newStatus) => {
                      setIncident({
                        ...incident,
                        status: newStatus,
                        responding_at: newStatus === "RESPONDING" ? new Date().toISOString() : incident.responding_at,
                        resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : incident.resolved_at,
                      })
                      
                      let message = ""
                      switch (newStatus) {
                        case "RESPONDING":
                          message = "🚀 Status updated to On The Way (OTW)! Resident and admins have been notified."
                          break
                        case "ARRIVED":
                          message = "📍 Status updated to Arrived! Resident and admins have been notified."
                          break
                        case "RESOLVED":
                          message = "✅ Incident resolved successfully! Admins and the reporter have been notified."
                          break
                        default:
                          message = `Status updated to ${newStatus}. Resident and admins have been notified.`
                      }
                      setSuccessMessage(message)
                    }}
                  />
                )}
                
                {incident.status === "RESPONDING" || incident.status === "ARRIVED" ? (
                  <div>
                    <label htmlFor="resolutionNotes" className="block text-sm font-medium text-gray-700">
                      Resolution Notes
                    </label>
                    <textarea
                      id="resolutionNotes"
                      name="resolutionNotes"
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                      placeholder="Describe how the incident was resolved..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      disabled={updating}
                    />
                    <button
                      className="mt-2 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
                      onClick={() => handleUpdateStatus("RESOLVED")}
                      disabled={updating || !resolutionNotes.trim()}
                    >
                      {updating ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Resolved
                    </button>
                  </div>
                ) : null}
              </div>
              
              {incident.status === "RESOLVED" && (
                <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <p className="font-medium">Resolved</p>
                  </div>
                  <p className="text-sm text-gray-700">
                    Resolved on {incident.resolved_at ? formatDate(incident.resolved_at) : "N/A"}
                  </p>
                  {incident.resolution_notes && (
                    <div className="mt-2">
                      <h3 className="text-sm font-medium text-gray-700">Resolution Notes</h3>
                      <p className="mt-1 text-black">{incident.resolution_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-black mb-4">Timeline</h2>
              <div className="space-y-4">
                <div className="flex">
                  <div className="mr-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">Incident Reported</p>
                    <p className="text-xs text-gray-700">{formatDate(incident.created_at)}</p>
                  </div>
                </div>

                {incident.assigned_at && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">Assigned to You</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.assigned_at)}</p>
                    </div>
                  </div>
                )}

                {incident.responding_at && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-orange-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">On The Way (OTW)</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.responding_at)}</p>
                    </div>
                  </div>
                )}

                {incident.resolved_at && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">Resolved</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.resolved_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Show error if any */}
        {error && (
          <div className="mt-4 p-4 border border-gray-300 bg-red-50 rounded-md text-red-700">
            <p className="flex items-center">
              <AlertTriangle size={20} className="mr-2" />
              {error}
            </p>
          </div>
        )}
        
        {/* Show success message */}
        {successMessage && (
          <div className="mt-4 p-4 border border-gray-300 bg-green-50 rounded-md text-green-700">
            <div className="flex flex-col">
              <p className="flex items-center">
                <CheckCircle size={20} className="mr-2" />
                {successMessage}
              </p>
              <div className="mt-3">
                <button
                  onClick={() => router.push('/volunteer/dashboard')}
                  className="px-4 py-2 bg-green-600 text-gray-600 rounded-md hover:bg-green-700 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </VolunteerLayout>
  )
}

```

```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { getIncidentById, updateIncidentStatus } from "@/lib/incidents"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { AlertTriangle, CheckCircle, Clock, Phone, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { IncidentCallActions } from "@/components/incident-call-actions"
import IncidentOTWButton from "@/components/incident-otw-button"
import IncidentStatusDropdown from "@/components/incident-status-dropdown"
import IncidentSeverityUpdater from "@/components/incident-severity-updater"

export default function VolunteerIncidentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [incident, setIncident] = useState<any>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth to finish loading before proceeding
    if (authLoading) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      if (!user) {
        console.log("No authenticated user found, redirecting to login");
        router.push('/login');
        return;
      }
      
      // Extract ID properly from params, ensuring it's a string
      const incidentId = params?.id;
      if (!incidentId) {
        console.log("No incident ID found in URL params");
        if (isMounted) {
          setError("No incident ID provided");
          setLoading(false);
        }
        return;
      }
      
      try {
        // Convert to string if it's an array or other type
        const idToUse = Array.isArray(incidentId) ? incidentId[0] : String(incidentId);
        
        console.log(`Fetching incident details for ID: ${idToUse} (${typeof idToUse})`);
        
        // Make sure we have a properly formatted UUID
        if (!idToUse.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.error("Invalid incident ID format in URL:", idToUse);
          if (isMounted) {
            setError("Invalid incident ID format");
            setLoading(false);
          }
          return;
        }
        
        // Fetch incident details
        const incidentResult = await getIncidentById(idToUse)
        console.log("Incident fetch result:", incidentResult);
        
        if (!isMounted) return;
        
        if (incidentResult.success && incidentResult.data) {
          setIncident(incidentResult.data);
          setError(null);
          
          // Check if current user is assigned to this incident
          // Allow admins to view any incident
          // Handle both direct ID and joined user object
          const assignedUserId = incidentResult.data.assigned_to || 
                                (incidentResult.data.assignee && incidentResult.data.assignee.id) || 
                                null;
          
          if (user.role !== 'admin' && assignedUserId !== user.id) {
            setError("You are not assigned to this incident");
            return;
          }
        } else {
          setError(incidentResult.message || "Failed to fetch incident details");
        }
      } catch (err: any) {
        console.error("Error fetching incident details:", err);
        if (isMounted) {
          setError(err.message || "An unexpected error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setError(null);
    fetchData();
    
    // Add a timeout to prevent infinite loading state
    const loadingTimeout = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        setError("Loading timed out. Please refresh the page.");
      }
    }, 30000); // 30 seconds timeout
    
    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
    }
  }, [params, user, authLoading, router]); // Added authLoading and router dependencies

  const handleUpdateStatus = async (newStatus: "RESPONDING" | "RESOLVED") => {
    if (!user || !incident) return

    try {
      setUpdating(true)
      setError(null)
      
      // Validate inputs
      if (newStatus === "RESOLVED" && !resolutionNotes.trim()) {
        setError("Resolution notes are required when resolving an incident")
        setUpdating(false)
        return
      }
      
      // Validate incident ID format
      if (!incident.id || typeof incident.id !== 'string') {
        console.error("Missing incident ID:", incident);
        setError("Invalid incident: missing ID");
        setUpdating(false);
        return;
      }
      
      // Validate UUID format
      if (!incident.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error("Invalid incident ID format:", incident.id);
        setError("Invalid incident ID format");
        setUpdating(false);
        return;
      }
      
      console.log("Updating incident status:", {
        volunteerId: user.id,
        incidentId: incident.id,
        current_status: incident.status,
        newStatus,
        hasNotes: !!resolutionNotes
      })
      
      try {
        // First, do a direct SQL update to force the incident status change
        if (newStatus === "RESOLVED") {
          try {
            console.log("Attempting progressive update approaches");
            
            // Track whether any update has succeeded
            let updateSucceeded = false;
            
            // ===== ATTEMPT 1: Try filter method =====
            try {
              console.log("Attempt 1: Filter-based update");
              
              const { error } = await (supabase as any)
                .from('incidents')
                .update({ 
                  status: 'RESOLVED' as const,
                  resolved_at: new Date().toISOString(),
                  resolution_notes: resolutionNotes || null
                })
                .eq('id', incident.id);
                
              if (error) {
                console.error("Filter update failed:", error);
                throw error;
              }
              
              console.log("Filter update succeeded!");
              updateSucceeded = true;
              
            } catch (filterError) {
              console.error("Attempt 1 failed:", filterError);
              
              // ===== ATTEMPT 2: Try match method =====
              try {
                console.log("Attempt 2: Match-based update");
                
                const { error } = await (supabase as any)
                  .from('incidents')
                  .update({ 
                    status: 'RESOLVED' as const,
                    resolved_at: new Date().toISOString(),
                    resolution_notes: resolutionNotes || null
                  })
                  .eq('id', incident.id);
                  
                if (error) {
                  console.error("Match update failed:", error);
                  throw error;
                }
                
                console.log("Match update succeeded!");
                updateSucceeded = true;
                
              } catch (matchError) {
                console.error("Attempt 2 failed:", matchError);
                
                // ===== ATTEMPT 3: Try eq method with minimal fields =====
                try {
                  console.log("Attempt 3: Minimal update");
                  
                  // Only update the status field, which is less likely to cause problems
                  const { error } = await (supabase as any)
                    .from('incidents')
                    .update({ status: 'RESOLVED' as const })
                    .eq('id', incident.id);
                    
                  if (error) {
                    console.error("Minimal update failed:", error);
                    throw error;
                  }
                  
                  console.log("Minimal update succeeded!");
                  updateSucceeded = true;
                  
                } catch (minError) {
                  console.error("Attempt 3 failed:", minError);
                  throw minError; // Let it propagate to the outer catch
                }
              }
            }
            
            // If any update method succeeded, update the volunteer profile
            if (updateSucceeded) {
              try {
                console.log("Updating volunteer profile");
                
                // IMPORTANT: Use manual update to avoid the trigger issues
                // First get current count
                const { data: profileData } = await supabase
                  .from('volunteer_profiles')
                  .select('total_incidents_resolved')
                  .eq('volunteer_user_id', user.id)
                  .single();
                  
                const currentCount = (profileData as any)?.total_incidents_resolved || 0;
                const newCount = currentCount + 1;
                
                // Update the profile
                const { error: profileError } = await (supabase as any)
                  .from('volunteer_profiles')
                  .update({ 
                    total_incidents_resolved: newCount,
                    is_available: true 
                  })
                  .eq('volunteer_user_id', user.id);
                  
                if (profileError) {
                  console.error("Profile update failed (non-critical):", profileError);
                } else {
                  console.log(`Profile updated to ${newCount} resolved incidents`);
                }

                // Update local state and show success message
                setIncident({
                  ...incident,
                  status: 'RESOLVED',
                  resolved_at: new Date().toISOString(),
                  resolution_notes: resolutionNotes
                });
                
                setSuccessMessage("✅ Incident resolved successfully! Admins and the reporter have been notified.");
                return; // Skip the standard update function
                
              } catch (profileErr) {
                console.error("Error in profile update (non-critical):", profileErr);
                
                // Still consider this a success since the incident was updated
                setIncident({
                  ...incident,
                  status: 'RESOLVED'
                });
                
                setSuccessMessage("✅ Incident marked as resolved! Admins and the reporter have been notified.");
                return; // Skip the standard update function
              }
            }
            
          } catch (error) {
            console.error("All update approaches failed:", error);
            // Fall through to standard update if direct updates fail
          }
        }
        
        // Standard update approach as fallback
        const result = await updateIncidentStatus(
          user.id,
          incident.id,
          newStatus,
          newStatus === "RESOLVED" ? resolutionNotes : undefined
        )
        
        console.log("Status update result:", result)
        
        if (result.success) {
          // Update the incident state
          setIncident({
            ...incident,
            status: newStatus,
            responding_at: newStatus === "RESPONDING" ? new Date().toISOString() : incident.responding_at,
            resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : incident.resolved_at,
            resolution_notes: newStatus === "RESOLVED" ? resolutionNotes : incident.resolution_notes,
          })
          
          // Show success message with notification info
          if (newStatus === "RESOLVED") {
            setSuccessMessage("✅ Incident resolved successfully! Admins and the reporter have been notified.");
          } else if (newStatus === "RESPONDING") {
            setSuccessMessage("🚀 Status updated to responding! Admins and the reporter have been notified.");
          }
        } else {
          console.error("Failed to update status:", result);
          
          // Enhanced error handling with detailed column error tracking
          if (result.error?.message) {
            const errorMsg = result.error.message;
            
            // Print the exact error to help debugging
            console.error(`Database error details: ${errorMsg}`);
            
            if (errorMsg.includes("column") && errorMsg.includes("does not exist")) {
              // Try to extract column name
              const columnMatch = errorMsg.match(/column ["']([^"']+)["']/);
              const columnName = columnMatch ? columnMatch[1] : "unknown";
              
              setError(`Database error: Column '${columnName}' does not exist. Please contact support.`);
            } else {
              setError(result.message || `Failed to update status to ${newStatus}`);
            }
          } else {
            setError(result.message || `Failed to update status to ${newStatus}`);
          }
        }
      } catch (updateErr: any) {
        console.error("Exception during update:", updateErr);
        setError(updateErr.message || `Error during update: ${updateErr}`);
      }
    } catch (err: any) {
      console.error("Error in handleUpdateStatus:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800"
      case "RESPONDING":
        return "bg-orange-100 text-orange-800"
      case "RESOLVED":
        return "bg-green-100 text-green-800"
      case "CANCELLED":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const handleCallReporter = () => {
    if (incident?.reporter?.phone_number) {
      window.location.href = `tel:${incident.reporter.phone_number}`
    }
  }

  const getDirections = () => {
    if (incident?.location_lat && incident?.location_lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${incident.location_lat},${incident.location_lng}`
      window.open(url, "_blank")
    }
  }

  if (loading) {
    return (
      <VolunteerLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading incident details..." />
        </div>
      </VolunteerLayout>
    )
  }

  if (error) {
    return (
      <VolunteerLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </VolunteerLayout>
    )
  }

  if (!incident) {
    return (
      <VolunteerLayout>
        <div className="text-center py-12">
          <p className="text-black">Incident not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </VolunteerLayout>
    )
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Incident Details</h1>
            <p className="text-gray-600 mt-1">
              Reported on {formatDate(incident.created_at)} • ID: {incident.id}
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              Back to List
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-black">{incident.incident_type}</h2>
                  <span
                    className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                      incident.status,
                    )}`}
                  >
                    {incident.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-700">Priority</p>
                  <div className="flex items-center mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full mx-0.5 ${
                          i < incident.priority ? "bg-red-500" : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700">Description</h3>
                <p className="mt-1 text-black">{incident.description}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Location</h3>
                  <p className="mt-1 text-black">
                    {incident.address}, {incident.barangay}, {incident.city}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Reported By</h3>
                  {incident.reporter ? (
                    <div className="mt-1 flex items-center">
                      <User className="h-4 w-4 text-gray-500 mr-1" />
                      <p className="text-black">
                        {incident.reporter.first_name && incident.reporter.last_name
                          ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                          : incident.reporter.first_name || incident.reporter.last_name
                          ? (incident.reporter.first_name || incident.reporter.last_name)
                          : incident.reporter.email || "Anonymous Reporter"}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-700">Anonymous Reporter</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {incident.reporter?.phone_number && (
                  <button
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
                    onClick={handleCallReporter}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Reporter
                  </button>
                )}
                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
                  onClick={getDirections}
                >
                  Get Directions
                </button>
              </div>
            </div>

            {/* Enhanced Call Actions */}
            <IncidentCallActions 
              incident={incident}
              userRole="volunteer"
              onCallComplete={(callLog) => {
                console.log('Call completed:', callLog)
                // You can add additional logic here if needed
              }}
            />

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-black mb-4">Location</h2>
              <div className="h-64 rounded-md overflow-hidden">
                {incident.location_lat && incident.location_lng && (
                  <MapComponent
                    center={[incident.location_lat, incident.location_lng]}
                    zoom={15}
                    markers={[
                      {
                        id: incident.id,
                        position: [incident.location_lat, incident.location_lng],
                        title: incident.incident_type,
                        status: incident.status,
                      },
                    ]}
                  />
                )}
              </div>
            </div>

            {incident.photo_url && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold text-black mb-4">Photo</h2>
                <div className="rounded-md overflow-hidden">
                  <img
                    src={incident.photo_url}
                    alt={`Photo of ${incident.incident_type} reported on ${new Date(
                      incident.created_at
                    ).toLocaleDateString()}`}
                    className="w-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-black mb-4">Status Update</h2>
              
              <div className="space-y-4">
                <p className="text-gray-700">
                  {incident.status === "ASSIGNED" && "You are assigned to this incident. Mark as responding when you're on your way."}
                  {incident.status === "RESPONDING" && "You are responding to this incident. Update status as you progress."}
                  {incident.status === "ARRIVED" && "You have arrived at the incident location. Mark as resolved when completed."}
                  {incident.status === "RESOLVED" && "This incident has been resolved."}
                </p>
                
                {user && (
                  <IncidentStatusDropdown
                    incidentId={incident.id}
                    currentStatus={incident.status}
                    volunteerId={user.id}
                    onStatusUpdate={(newStatus) => {
                      setIncident({
                        ...incident,
                        status: newStatus,
                        responding_at: newStatus === "RESPONDING" ? new Date().toISOString() : incident.responding_at,
                        resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : incident.resolved_at,
                      })
                      
                      let message = ""
                      switch (newStatus) {
                        case "RESPONDING":
                          message = "🚀 Status updated to On The Way (OTW)! Resident and admins have been notified."
                          break
                        case "ARRIVED":
                          message = "📍 Status updated to Arrived! Resident and admins have been notified."
                          break
                        case "RESOLVED":
                          message = "✅ Incident resolved successfully! Admins and the reporter have been notified."
                          break
                        default:
                          message = `Status updated to ${newStatus}. Resident and admins have been notified.`
                      }
                      setSuccessMessage(message)
                    }}
                  />
                )}
                
                {/* Severity Update - Only when ARRIVED */}
                {incident.status === "ARRIVED" && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Assess Severity Level</h3>
                    <IncidentSeverityUpdater
                      currentSeverity={incident.severity}
                      incidentId={incident.id}
                      incidentStatus={incident.status}
                      onSeverityUpdate={(newSeverity) => {
                        setIncident({
                          ...incident,
                          severity: newSeverity
                        })
                        setSuccessMessage(`Severity updated to ${newSeverity}`)
                      }}
                    />
                  </div>
                )}

                {incident.status === "RESPONDING" || incident.status === "ARRIVED" ? (
                  <div className="mt-4">
                    <label htmlFor="resolutionNotes" className="block text-sm font-medium text-gray-700">
                      Resolution Notes
                    </label>
                    <textarea
                      id="resolutionNotes"
                      name="resolutionNotes"
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                      placeholder="Describe how the incident was resolved..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      disabled={updating}
                    />
                    <button
                      className="mt-2 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
                      onClick={() => handleUpdateStatus("RESOLVED")}
                      disabled={updating || !resolutionNotes.trim()}
                    >
                      {updating ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Resolved
                    </button>
                  </div>
                ) : null}
              </div>
              
              {incident.status === "RESOLVED" && (
                <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <p className="font-medium">Resolved</p>
                  </div>
                  <p className="text-sm text-gray-700">
                    Resolved on {incident.resolved_at ? formatDate(incident.resolved_at) : "N/A"}
                  </p>
                  {incident.resolution_notes && (
                    <div className="mt-2">
                      <h3 className="text-sm font-medium text-gray-700">Resolution Notes</h3>
                      <p className="mt-1 text-black">{incident.resolution_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-black mb-4">Timeline</h2>
              <div className="space-y-4">
                <div className="flex">
                  <div className="mr-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">Incident Reported</p>
                    <p className="text-xs text-gray-700">{formatDate(incident.created_at)}</p>
                  </div>
                </div>

                {incident.assigned_at && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">Assigned to You</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.assigned_at)}</p>
                    </div>
                  </div>
                )}

                {incident.responding_at && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-orange-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">On The Way (OTW)</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.responding_at)}</p>
                    </div>
                  </div>
                )}

                {incident.resolved_at && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">Resolved</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.resolved_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Show error if any */}
        {error && (
          <div className="mt-4 p-4 border border-gray-300 bg-red-50 rounded-md text-red-700">
            <p className="flex items-center">
              <AlertTriangle size={20} className="mr-2" />
              {error}
            </p>
          </div>
        )}
        
        {/* Show success message */}
        {successMessage && (
          <div className="mt-4 p-4 border border-gray-300 bg-green-50 rounded-md text-green-700">
            <div className="flex flex-col">
              <p className="flex items-center">
                <CheckCircle size={20} className="mr-2" />
                {successMessage}
              </p>
              <div className="mt-3">
                <button
                  onClick={() => router.push('/volunteer/dashboard')}
                  className="px-4 py-2 bg-green-600 text-gray-600 rounded-md hover:bg-green-700 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </VolunteerLayout>
  )
}

```


Creating the volunteer analytics dashboard in the admin panel. Checking if a page already exists:


```typescriptreact
"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  Clock,
  MapPin,
  FileText
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function VolunteerAnalyticsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<any[]>([])
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>("all")
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("month")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    // Set default date range
    const end = new Date()
    const start = subMonths(end, 1)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    fetchVolunteers()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalytics()
    }
  }, [selectedVolunteer, startDate, endDate])

  const fetchVolunteers = async () => {
    try {
      const res = await fetch('/api/admin/volunteers')
      const json = await res.json()
      if (json.success) {
        setVolunteers(json.data || [])
      }
    } catch (err: any) {
      console.error('Failed to fetch volunteers:', err)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        ...(selectedVolunteer !== "all" ? { volunteer_id: selectedVolunteer } : {}),
        start_date: startDate,
        end_date: endDate
      })

      const res = await fetch(`/api/volunteers/analytics?${params}`)
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.message || 'Failed to fetch analytics')
      }

      if (selectedVolunteer === "all") {
        setAnalytics(json.data || [])
      } else {
        setAnalytics([json.data])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        ...(selectedVolunteer !== "all" ? { volunteer_id: selectedVolunteer } : {}),
        start_date: startDate,
        end_date: endDate,
        export: format
      })

      const res = await fetch(`/api/volunteers/analytics?${params}`)
      
      if (format === 'csv') {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `volunteer-analytics-${selectedVolunteer}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleDateRangeChange = (range: "month" | "quarter" | "year" | "all") => {
    setDateRange(range)
    const end = new Date()
    let start: Date

    switch (range) {
      case "month":
        start = subMonths(end, 1)
        break
      case "quarter":
        start = subMonths(end, 3)
        break
      case "year":
        start = subMonths(end, 12)
        break
      default:
        start = new Date(2020, 0, 1) // All time
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  if (loading && analytics.length === 0) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </AdminLayout>
    )
  }

  const selectedAnalytics = selectedVolunteer === "all" 
    ? analytics 
    : analytics.filter(a => a.volunteer_id === selectedVolunteer)

  // Prepare chart data
  const incidentsByTypeData = selectedAnalytics.length > 0 && selectedAnalytics[0].incidents_by_type
    ? Object.entries(selectedAnalytics[0].incidents_by_type).map(([type, count]) => ({
        name: type,
        value: count
      }))
    : []

  const incidentsBySeverityData = selectedAnalytics.length > 0 && selectedAnalytics[0].incidents_by_severity
    ? Object.entries(selectedAnalytics[0].incidents_by_severity).map(([severity, count]) => ({
        name: severity,
        value: count
      }))
    : []

  const monthlyTrendsData = selectedAnalytics.length > 0 && selectedAnalytics[0].monthly_trends
    ? selectedAnalytics[0].monthly_trends.map((trend: any) => ({
        month: trend.month,
        incidents: trend.count
      }))
    : []

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Volunteer Analytics</h1>
            <p className="text-gray-600 mt-1">Comprehensive profiling and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Volunteer</label>
                <Select value={selectedVolunteer} onValueChange={setSelectedVolunteer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select volunteer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Volunteers</SelectItem>
                    {volunteers.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.first_name} {v.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <Select value={dateRange} onValueChange={handleDateRangeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="quarter">Last Quarter</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {selectedAnalytics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedAnalytics.reduce((sum, a) => sum + (a.total_incidents || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedAnalytics.reduce((sum, a) => sum + (a.total_resolved || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedAnalytics.length > 0 && selectedAnalytics[0].average_response_time_minutes
                    ? `${Math.round(selectedAnalytics[0].average_response_time_minutes)} min`
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Volunteers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedAnalytics.length}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        {selectedAnalytics.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Incidents by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Incidents by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={incidentsByTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {incidentsByTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Incidents by Severity */}
            <Card>
              <CardHeader>
                <CardTitle>Incidents by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={incidentsBySeverityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Trends */}
            {monthlyTrendsData.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Monthly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="incidents" stroke="#8884d8" fill="#8884d8" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Detailed Table */}
        {selectedAnalytics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Details</CardTitle>
              <CardDescription>Individual volunteer performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Volunteer</th>
                      <th className="text-left p-2">Total Incidents</th>
                      <th className="text-left p-2">Resolved</th>
                      <th className="text-left p-2">Avg Response (min)</th>
                      <th className="text-left p-2">By Type</th>
                      <th className="text-left p-2">By Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAnalytics.map((analytics) => (
                      <tr key={analytics.volunteer_id} className="border-b">
                        <td className="p-2 font-medium">{analytics.volunteer_name}</td>
                        <td className="p-2">{analytics.total_incidents}</td>
                        <td className="p-2">{analytics.total_resolved}</td>
                        <td className="p-2">
                          {analytics.average_response_time_minutes 
                            ? `${Math.round(analytics.average_response_time_minutes)} min`
                            : 'N/A'}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(analytics.incidents_by_type || {}).map(([type, count]) => (
                              <Badge key={type} variant="outline">
                                {type}: {count as number}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(analytics.incidents_by_severity || {}).map(([severity, count]) => (
                              <Badge key={severity} variant="outline">
                                {severity}: {count as number}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedAnalytics.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No analytics data available for the selected filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}

```

---

**User**

pls fix the user management in admin feature cuz it is still not displaying all the data and cant manage it, so pls see and fix that correctly, investigate first

---

**Cursor**


Investigating the admin user management page to identify and fix the issues.



The issue is client-side filtering on paginated data, so only the current page is filtered. Fixing by moving filtering to the server and updating the frontend to request all data when filters are active:



Fixing the API to support server-side filtering and updating the frontend to use it:


```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000') // Increased default to show more users
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true' // Option to get all users without pagination

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    } else {
      // If no status filter, default to showing active users, but allow showing all
      // Check if status column exists by trying to filter
      // For now, we'll fetch all and filter client-side if needed
    }
    
    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }
    
    if (searchTerm) {
      // Search in name and email using or filter
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply pagination only if not getting all
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data: users, error: usersError, count } = await query

    if (usersError) throw usersError

    // For residents, also fetch their incident count
    const residentIds = users.filter((u: any) => u.role === 'resident').map((u: any) => u.id)
    const residentIncidentCounts: Record<string, number> = {}
    
    if (residentIds.length > 0) {
      const { data: incidentCounts, error: incidentError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', residentIds)
      
      if (!incidentError && incidentCounts) {
        // Count incidents per reporter
        incidentCounts.forEach((item: any) => {
          residentIncidentCounts[item.reporter_id] = (residentIncidentCounts[item.reporter_id] || 0) + 1
        })
      }
    }

    // Merge incident counts with users
    const usersWithIncidentData = users.map((user: any) => ({
      ...user,
      incident_count: residentIncidentCounts[user.id] || 0
    }))

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count,
        current_page: page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users' 
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId, action } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } else if (action === 'activate') {
      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Instead of deleting the user, we'll deactivate them
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'inactive',
        email: `deactivated_${Date.now()}_${userId}@example.com`,
        phone_number: null,
        address: null,
        first_name: '[DEACTIVATED]',
        last_name: '[USER]'
      })
      .eq('id', userId)
    
    if (updateError) throw updateError

    // Anonymize incidents reported by this user
    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: 'User deactivated and data anonymized successfully' })
  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}
```

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000') // Increased default to show more users
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true' // Option to get all users without pagination

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    } else {
      // If no status filter, default to showing active users, but allow showing all
      // Check if status column exists by trying to filter
      // For now, we'll fetch all and filter client-side if needed
    }
    
    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }
    
    if (searchTerm) {
      // Search in name and email using or filter
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply pagination only if not getting all
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data: users, error: usersError, count } = await query

    if (usersError) throw usersError

    // For residents, also fetch their incident count
    const residentIds = users.filter((u: any) => u.role === 'resident').map((u: any) => u.id)
    const residentIncidentCounts: Record<string, number> = {}
    
    if (residentIds.length > 0) {
      const { data: incidentCounts, error: incidentError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', residentIds)
      
      if (!incidentError && incidentCounts) {
        // Count incidents per reporter
        incidentCounts.forEach((item: any) => {
          residentIncidentCounts[item.reporter_id] = (residentIncidentCounts[item.reporter_id] || 0) + 1
        })
      }
    }

    // Merge incident counts with users
    const usersWithIncidentData = users.map((user: any) => ({
      ...user,
      incident_count: residentIncidentCounts[user.id] || 0,
      status: user.status || 'active' // Default to active if status doesn't exist
    }))

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count || usersWithIncidentData.length,
        current_page: getAll ? 1 : page,
        per_page: getAll ? count || usersWithIncidentData.length : limit,
        total_pages: getAll ? 1 : Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users' 
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId, action } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } else if (action === 'activate') {
      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Instead of deleting the user, we'll deactivate them
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'inactive',
        email: `deactivated_${Date.now()}_${userId}@example.com`,
        phone_number: null,
        address: null,
        first_name: '[DEACTIVATED]',
        last_name: '[USER]'
      })
      .eq('id', userId)
    
    if (updateError) throw updateError

    // Anonymize incidents reported by this user
    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: 'User deactivated and data anonymized successfully' })
  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}
```

```typescriptreact
"use client"

import { useState, useEffect, useMemo } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, Eye, User, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"

// Define user types
type UserRole = "admin" | "volunteer" | "resident" | "barangay"

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone_number: string | null
  address: string | null
  role: UserRole
  barangay: string | null
  created_at: string
  status: "active" | "inactive"
  incident_count?: number
}

interface PaginationMeta {
  total_count: number
  current_page: number
  per_page: number
  total_pages: number
}

export default function UserManagementPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [barangayFilter, setBarangayFilter] = useState<string | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [barangays, setBarangays] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null)
  const [pagination, setPagination] = useState<PaginationMeta>({
    total_count: 0,
    current_page: 1,
    per_page: 20,
    total_pages: 1
  })

  const userStats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status === "active").length
    const inactive = total - active
    const byRole = users.reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1
        return acc
      },
      { admin: 0, barangay: 0, resident: 0, volunteer: 0 } as Record<UserRole, number>,
    )
    return { total, active, inactive, byRole }
  }, [users])

  // Fetch users with filters
  useEffect(() => {
    if (!user) return
    
    const fetchUsers = async () => {
      try {
        setLoading(true)
        
        // Build query params
        const params = new URLSearchParams({
          page: pagination.current_page.toString(),
          limit: pagination.per_page.toString(),
          ...(roleFilter !== "all" ? { role: roleFilter } : {}),
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(barangayFilter !== "all" ? { barangay: barangayFilter } : {}),
          ...(searchTerm ? { search: searchTerm } : {})
        })
        
        const response = await fetch(`/api/admin/users?${params}`)
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Transform data to match our User interface
        const transformedUsers: User[] = result.data.map((user: any) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number,
          address: user.address,
          role: user.role,
          barangay: user.barangay,
          created_at: user.created_at,
          status: user.status || "active",
          incident_count: user.incident_count
        }))
        
        setUsers(transformedUsers)
        setFilteredUsers(transformedUsers)
        setPagination(result.meta)
      } catch (error: any) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchUsers()
  }, [user, pagination.current_page, pagination.per_page, roleFilter, statusFilter, barangayFilter, searchTerm])
  
  // Fetch barangays separately (only once)
  useEffect(() => {
    if (!user) return
    
    const fetchBarangays = async () => {
      try {
        // Fetch all users to get unique barangays
        const response = await fetch("/api/admin/users?all=true")
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Extract unique barangays
        const uniqueBarangays = Array.from(
          new Set(result.data.map((user: User) => user.barangay).filter(Boolean))
        ).filter(Boolean) as string[]
        
        setBarangays(uniqueBarangays.sort())
      } catch (error: any) {
        console.error("Error fetching barangays:", error)
      }
    }
    
    fetchBarangays()
  }, [user])
  
  // Apply filters
  useEffect(() => {
    let result = [...users]
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(user => 
        user.first_name.toLowerCase().includes(term) ||
        user.last_name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      )
    }
    
    // Apply role filter
    if (roleFilter !== "all") {
      result = result.filter(user => user.role === roleFilter)
    }
    
    if (statusFilter !== "all") {
      result = result.filter(user => user.status === statusFilter)
    }
    
    // Apply barangay filter
    if (barangayFilter !== "all") {
      result = result.filter(user => user.barangay === barangayFilter)
    }
    
    setFilteredUsers(result)
  }, [searchTerm, roleFilter, barangayFilter, statusFilter, users])
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination({
        ...pagination,
        current_page: newPage
      })
    }
  }
  
  const handleViewUser = (userId: string) => {
    // Navigate to user details page
    window.location.href = `/admin/users/${userId}`
  }
  
  const handleDeactivateUser = (user: User) => {
    // Add confirmation prompt before deactivation
    if (window.confirm(`Are you sure you want to deactivate user ${user.first_name} ${user.last_name}? They will no longer be able to access the system.`)) {
      setUserToDeactivate(user)
      setDeactivateDialogOpen(true)
    }
  }
  
  const confirmDeactivateUser = async () => {
    if (!userToDeactivate) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userToDeactivate.id,
          action: "deactivate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userToDeactivate.id ? { ...u, status: "inactive" } : u
      ))
      
      toast({
        title: "Success",
        description: "User deactivated successfully"
      })
    } catch (error: any) {
      console.error("Error deactivating user:", error)
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive"
      })
    } finally {
      setDeactivateDialogOpen(false)
      setUserToDeactivate(null)
    }
  }
  
  const handleActivateUser = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          action: "activate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: "active" } : user
      ))
      
      toast({
        title: "Success",
        description: "User activated successfully"
      })
    } catch (error: any) {
      console.error("Error activating user:", error)
      toast({
        title: "Error",
        description: "Failed to activate user",
        variant: "destructive"
      })
    }
  }
  
  const handleDeleteUser = (user: User) => {
    // Add confirmation prompt before deletion
    if (window.confirm(`Are you sure you want to deactivate and anonymize user ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
      setUserToDelete(user)
      setDeleteDialogOpen(true)
    }
  }
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userToDelete.id
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.filter(u => u.id !== userToDelete.id))
      
      toast({
        title: "Success",
        description: "User deactivated and data anonymized successfully"
      })
    } catch (error: any) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }
  
  const handleExportCSV = async () => {
    try {
      // Create CSV content with proper formatting
      const orgName = "Talisay City Emergency Response System"
      const reportDate = new Date().toLocaleDateString()
      const reportTitle = "Resident User Report"
      
      const headers = [
        "Name",
        "Email",
        "Role",
        "Barangay",
        "Registration Date",
        "Status",
        "Incident Count"
      ];
      
      const csvContent = [
        `"${orgName}"`,
        `"${reportTitle}"`,
        `"Generated: ${reportDate}"`,
        "", // Empty line
        headers.join(","),
        ...filteredUsers.map(user => [
          `"${user.first_name} ${user.last_name}"`,
          `"${user.email}"`,
          `"${user.role}"`,
          `"${user.barangay || ""}"`,
          `"${new Date(user.created_at).toLocaleDateString()}"`,
          `"${user.status}"`,
          `"${user.incident_count || 0}"`
        ].join(","))
      ].join("\n");
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `resident_users_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      });
    } catch (error: any) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Error",
        description: "Failed to export CSV file",
        variant: "destructive"
      });
    }
  };
  
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">User Management</h1>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <Link href="/admin/users/new">
              <Button>
                <User className="mr-2 h-4 w-4" />
                New User
              </Button>
            </Link>
            <Link href="/admin/users/new-admin">
              <Button variant="secondary">
                <User className="mr-2 h-4 w-4" />
                New Admin
              </Button>
            </Link>
            <Button onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">{userStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl text-green-600">{userStats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inactive</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{userStats.inactive}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Role</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                {(["admin", "barangay", "volunteer", "resident"] as UserRole[]).map((role) => (
                  <Badge key={role} variant="secondary">
                    {role.charAt(0).toUpperCase() + role.slice(1)} · {userStats.byRole[role] || 0}
                  </Badge>
                ))}
              </div>
            </CardHeader>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  className="pl-8 text-sm sm:text-base min-h-[2.5rem]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="barangay">Barangay</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={barangayFilter} onValueChange={(value: string | "all") => setBarangayFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {barangays.map(barangay => (
                    <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                <Filter className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Apply Filters</span>
                <span className="sm:hidden">Filters</span>
              </Button>
            </div>
            
            {/* User Table */}
            <div className="rounded-md border overflow-hidden">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {user.first_name} {user.last_name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate mt-1">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant={
                            user.role === "admin" ? "default" :
                            user.role === "volunteer" ? "secondary" :
                            user.role === "barangay" ? "outline" : "destructive"
                          } className="text-xs">
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                          <Badge variant={user.status === "active" ? "default" : "destructive"} className="text-xs">
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Barangay:</span>
                          <span className="text-gray-900 ml-1">{user.barangay || "-"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Registered:</span>
                          <span className="text-gray-900 ml-1">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Phone:</span>
                          <span className="text-gray-900 ml-1">{user.phone_number || "N/A"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Address:</span>
                          <span className="text-gray-900 ml-1">{user.address || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewUser(user.id)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {user.status === "active" ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeactivateUser(user)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleActivateUser(user.id)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No users found
                  </div>
                )}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Barangay</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.first_name} {user.last_name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone_number || "N/A"}</TableCell>
                          <TableCell>{user.address || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={
                              user.role === "admin" ? "default" :
                              user.role === "volunteer" ? "secondary" :
                              user.role === "barangay" ? "outline" : "destructive"
                            }>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.barangay || "-"}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.status === "active" ? "default" : "destructive"}>
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewUser(user.id)}
                                className="touch-manipulation"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {user.status === "active" ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeactivateUser(user)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActivateUser(user.id)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="touch-manipulation"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {(pagination.current_page - 1) * pagination.per_page + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total_count)} of {pagination.total_count} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="text-xs sm:text-sm px-2">
                  Page {pagination.current_page} of {pagination.total_pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.total_pages}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? They will no longer be able to access the system, 
              but their account and data will remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivateUser}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate and Anonymize User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Deactivate their account</li>
                <li>Anonymize their personal information</li>
                <li>Remove their association from reported incidents</li>
                <li>Log this action in the audit trail</li>
              </ul>
              <p className="mt-2 font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Deactivate and Anonymize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
```

```typescriptreact
"use client"

import { useState, useEffect, useMemo } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, Eye, User, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"

// Define user types
type UserRole = "admin" | "volunteer" | "resident" | "barangay"

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone_number: string | null
  address: string | null
  role: UserRole
  barangay: string | null
  created_at: string
  status: "active" | "inactive"
  incident_count?: number
}

interface PaginationMeta {
  total_count: number
  current_page: number
  per_page: number
  total_pages: number
}

export default function UserManagementPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [barangayFilter, setBarangayFilter] = useState<string | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [barangays, setBarangays] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null)
  const [pagination, setPagination] = useState<PaginationMeta>({
    total_count: 0,
    current_page: 1,
    per_page: 20,
    total_pages: 1
  })

  const userStats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status === "active").length
    const inactive = total - active
    const byRole = users.reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1
        return acc
      },
      { admin: 0, barangay: 0, resident: 0, volunteer: 0 } as Record<UserRole, number>,
    )
    return { total, active, inactive, byRole }
  }, [users])

  // Fetch users with filters
  useEffect(() => {
    if (!user) return
    
    const fetchUsers = async () => {
      try {
        setLoading(true)
        
        // Build query params
        const params = new URLSearchParams({
          page: pagination.current_page.toString(),
          limit: pagination.per_page.toString(),
          ...(roleFilter !== "all" ? { role: roleFilter } : {}),
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(barangayFilter !== "all" ? { barangay: barangayFilter } : {}),
          ...(searchTerm ? { search: searchTerm } : {})
        })
        
        const response = await fetch(`/api/admin/users?${params}`)
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Transform data to match our User interface
        const transformedUsers: User[] = result.data.map((user: any) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number,
          address: user.address,
          role: user.role,
          barangay: user.barangay,
          created_at: user.created_at,
          status: user.status || "active",
          incident_count: user.incident_count
        }))
        
        setUsers(transformedUsers)
        setFilteredUsers(transformedUsers)
        setPagination(result.meta)
      } catch (error: any) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchUsers()
  }, [user, pagination.current_page, pagination.per_page, roleFilter, statusFilter, barangayFilter, searchTerm])
  
  // Fetch barangays separately (only once)
  useEffect(() => {
    if (!user) return
    
    const fetchBarangays = async () => {
      try {
        // Fetch all users to get unique barangays
        const response = await fetch("/api/admin/users?all=true")
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Extract unique barangays
        const uniqueBarangays = Array.from(
          new Set(result.data.map((user: User) => user.barangay).filter(Boolean))
        ).filter(Boolean) as string[]
        
        setBarangays(uniqueBarangays.sort())
      } catch (error: any) {
        console.error("Error fetching barangays:", error)
      }
    }
    
    fetchBarangays()
  }, [user])
  
  // Filters are now applied server-side, so filteredUsers = users
  useEffect(() => {
    setFilteredUsers(users)
  }, [users])
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination({
        ...pagination,
        current_page: newPage
      })
    }
  }
  
  const handleViewUser = (userId: string) => {
    // Navigate to user details page
    window.location.href = `/admin/users/${userId}`
  }
  
  const handleDeactivateUser = (user: User) => {
    // Add confirmation prompt before deactivation
    if (window.confirm(`Are you sure you want to deactivate user ${user.first_name} ${user.last_name}? They will no longer be able to access the system.`)) {
      setUserToDeactivate(user)
      setDeactivateDialogOpen(true)
    }
  }
  
  const confirmDeactivateUser = async () => {
    if (!userToDeactivate) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userToDeactivate.id,
          action: "deactivate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userToDeactivate.id ? { ...u, status: "inactive" } : u
      ))
      
      toast({
        title: "Success",
        description: "User deactivated successfully"
      })
    } catch (error: any) {
      console.error("Error deactivating user:", error)
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive"
      })
    } finally {
      setDeactivateDialogOpen(false)
      setUserToDeactivate(null)
    }
  }
  
  const handleActivateUser = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          action: "activate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: "active" } : user
      ))
      
      toast({
        title: "Success",
        description: "User activated successfully"
      })
    } catch (error: any) {
      console.error("Error activating user:", error)
      toast({
        title: "Error",
        description: "Failed to activate user",
        variant: "destructive"
      })
    }
  }
  
  const handleDeleteUser = (user: User) => {
    // Add confirmation prompt before deletion
    if (window.confirm(`Are you sure you want to deactivate and anonymize user ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
      setUserToDelete(user)
      setDeleteDialogOpen(true)
    }
  }
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userToDelete.id
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.filter(u => u.id !== userToDelete.id))
      
      toast({
        title: "Success",
        description: "User deactivated and data anonymized successfully"
      })
    } catch (error: any) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }
  
  const handleExportCSV = async () => {
    try {
      // Create CSV content with proper formatting
      const orgName = "Talisay City Emergency Response System"
      const reportDate = new Date().toLocaleDateString()
      const reportTitle = "Resident User Report"
      
      const headers = [
        "Name",
        "Email",
        "Role",
        "Barangay",
        "Registration Date",
        "Status",
        "Incident Count"
      ];
      
      const csvContent = [
        `"${orgName}"`,
        `"${reportTitle}"`,
        `"Generated: ${reportDate}"`,
        "", // Empty line
        headers.join(","),
        ...filteredUsers.map(user => [
          `"${user.first_name} ${user.last_name}"`,
          `"${user.email}"`,
          `"${user.role}"`,
          `"${user.barangay || ""}"`,
          `"${new Date(user.created_at).toLocaleDateString()}"`,
          `"${user.status}"`,
          `"${user.incident_count || 0}"`
        ].join(","))
      ].join("\n");
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `resident_users_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      });
    } catch (error: any) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Error",
        description: "Failed to export CSV file",
        variant: "destructive"
      });
    }
  };
  
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">User Management</h1>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <Link href="/admin/users/new">
              <Button>
                <User className="mr-2 h-4 w-4" />
                New User
              </Button>
            </Link>
            <Link href="/admin/users/new-admin">
              <Button variant="secondary">
                <User className="mr-2 h-4 w-4" />
                New Admin
              </Button>
            </Link>
            <Button onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">{userStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl text-green-600">{userStats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inactive</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{userStats.inactive}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Role</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                {(["admin", "barangay", "volunteer", "resident"] as UserRole[]).map((role) => (
                  <Badge key={role} variant="secondary">
                    {role.charAt(0).toUpperCase() + role.slice(1)} · {userStats.byRole[role] || 0}
                  </Badge>
                ))}
              </div>
            </CardHeader>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  className="pl-8 text-sm sm:text-base min-h-[2.5rem]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="barangay">Barangay</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={barangayFilter} onValueChange={(value: string | "all") => setBarangayFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {barangays.map(barangay => (
                    <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                <Filter className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Apply Filters</span>
                <span className="sm:hidden">Filters</span>
              </Button>
            </div>
            
            {/* User Table */}
            <div className="rounded-md border overflow-hidden">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {user.first_name} {user.last_name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate mt-1">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant={
                            user.role === "admin" ? "default" :
                            user.role === "volunteer" ? "secondary" :
                            user.role === "barangay" ? "outline" : "destructive"
                          } className="text-xs">
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                          <Badge variant={user.status === "active" ? "default" : "destructive"} className="text-xs">
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Barangay:</span>
                          <span className="text-gray-900 ml-1">{user.barangay || "-"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Registered:</span>
                          <span className="text-gray-900 ml-1">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Phone:</span>
                          <span className="text-gray-900 ml-1">{user.phone_number || "N/A"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Address:</span>
                          <span className="text-gray-900 ml-1">{user.address || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewUser(user.id)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {user.status === "active" ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeactivateUser(user)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleActivateUser(user.id)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No users found
                  </div>
                )}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Barangay</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.first_name} {user.last_name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone_number || "N/A"}</TableCell>
                          <TableCell>{user.address || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={
                              user.role === "admin" ? "default" :
                              user.role === "volunteer" ? "secondary" :
                              user.role === "barangay" ? "outline" : "destructive"
                            }>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.barangay || "-"}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.status === "active" ? "default" : "destructive"}>
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewUser(user.id)}
                                className="touch-manipulation"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {user.status === "active" ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeactivateUser(user)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActivateUser(user.id)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="touch-manipulation"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {(pagination.current_page - 1) * pagination.per_page + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total_count)} of {pagination.total_count} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="text-xs sm:text-sm px-2">
                  Page {pagination.current_page} of {pagination.total_pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.total_pages}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? They will no longer be able to access the system, 
              but their account and data will remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivateUser}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate and Anonymize User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Deactivate their account</li>
                <li>Anonymize their personal information</li>
                <li>Remove their association from reported incidents</li>
                <li>Log this action in the audit trail</li>
              </ul>
              <p className="mt-2 font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Deactivate and Anonymize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
```

```typescriptreact
"use client"

import { useState, useEffect, useMemo } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, Eye, User, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Link from "next/link"

// Define user types
type UserRole = "admin" | "volunteer" | "resident" | "barangay"

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone_number: string | null
  address: string | null
  role: UserRole
  barangay: string | null
  created_at: string
  status: "active" | "inactive"
  incident_count?: number
}

interface PaginationMeta {
  total_count: number
  current_page: number
  per_page: number
  total_pages: number
}

export default function UserManagementPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [barangayFilter, setBarangayFilter] = useState<string | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [barangays, setBarangays] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null)
  const [pagination, setPagination] = useState<PaginationMeta>({
    total_count: 0,
    current_page: 1,
    per_page: 20,
    total_pages: 1
  })

  const userStats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status === "active").length
    const inactive = total - active
    const byRole = users.reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1
        return acc
      },
      { admin: 0, barangay: 0, resident: 0, volunteer: 0 } as Record<UserRole, number>,
    )
    return { total, active, inactive, byRole }
  }, [users])

  // Fetch users with filters
  useEffect(() => {
    if (!user) return
    
    const fetchUsers = async () => {
      try {
        setLoading(true)
        
        // Build query params
        const params = new URLSearchParams({
          page: pagination.current_page.toString(),
          limit: pagination.per_page.toString(),
          ...(roleFilter !== "all" ? { role: roleFilter } : {}),
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(barangayFilter !== "all" ? { barangay: barangayFilter } : {}),
          ...(searchTerm ? { search: searchTerm } : {})
        })
        
        const response = await fetch(`/api/admin/users?${params}`)
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Transform data to match our User interface
        const transformedUsers: User[] = result.data.map((user: any) => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number,
          address: user.address,
          role: user.role,
          barangay: user.barangay,
          created_at: user.created_at,
          status: user.status || "active",
          incident_count: user.incident_count
        }))
        
        setUsers(transformedUsers)
        setFilteredUsers(transformedUsers)
        setPagination(result.meta)
      } catch (error: any) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchUsers()
  }, [user, pagination.current_page, pagination.per_page, roleFilter, statusFilter, barangayFilter, searchTerm])
  
  // Fetch barangays separately (only once)
  useEffect(() => {
    if (!user) return
    
    const fetchBarangays = async () => {
      try {
        // Fetch all users to get unique barangays
        const response = await fetch("/api/admin/users?all=true")
        const result = await response.json()
        
        if (!result.success) throw new Error(result.message)
        
        // Extract unique barangays
        const uniqueBarangays = Array.from(
          new Set(result.data.map((user: User) => user.barangay).filter(Boolean))
        ).filter(Boolean) as string[]
        
        setBarangays(uniqueBarangays.sort())
      } catch (error: any) {
        console.error("Error fetching barangays:", error)
      }
    }
    
    fetchBarangays()
  }, [user])
  
  // Filters are now applied server-side, so filteredUsers = users
  useEffect(() => {
    setFilteredUsers(users)
  }, [users])
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination(prev => ({
        ...prev,
        current_page: newPage
      }))
    }
  }
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      current_page: 1
    }))
  }, [roleFilter, statusFilter, barangayFilter, searchTerm])
  
  const handleViewUser = (userId: string) => {
    // Navigate to user details page
    window.location.href = `/admin/users/${userId}`
  }
  
  const handleDeactivateUser = (user: User) => {
    // Add confirmation prompt before deactivation
    if (window.confirm(`Are you sure you want to deactivate user ${user.first_name} ${user.last_name}? They will no longer be able to access the system.`)) {
      setUserToDeactivate(user)
      setDeactivateDialogOpen(true)
    }
  }
  
  const confirmDeactivateUser = async () => {
    if (!userToDeactivate) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userToDeactivate.id,
          action: "deactivate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userToDeactivate.id ? { ...u, status: "inactive" } : u
      ))
      
      toast({
        title: "Success",
        description: "User deactivated successfully"
      })
    } catch (error: any) {
      console.error("Error deactivating user:", error)
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive"
      })
    } finally {
      setDeactivateDialogOpen(false)
      setUserToDeactivate(null)
    }
  }
  
  const handleActivateUser = async (userId: string) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          action: "activate"
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: "active" } : user
      ))
      
      toast({
        title: "Success",
        description: "User activated successfully"
      })
    } catch (error: any) {
      console.error("Error activating user:", error)
      toast({
        title: "Error",
        description: "Failed to activate user",
        variant: "destructive"
      })
    }
  }
  
  const handleDeleteUser = (user: User) => {
    // Add confirmation prompt before deletion
    if (window.confirm(`Are you sure you want to deactivate and anonymize user ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
      setUserToDelete(user)
      setDeleteDialogOpen(true)
    }
  }
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userToDelete.id
        })
      })
      
      const result = await response.json()
      
      if (!result.success) throw new Error(result.message)
      
      // Update local state
      setUsers(users.filter(u => u.id !== userToDelete.id))
      
      toast({
        title: "Success",
        description: "User deactivated and data anonymized successfully"
      })
    } catch (error: any) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }
  
  const handleExportCSV = async () => {
    try {
      // Create CSV content with proper formatting
      const orgName = "Talisay City Emergency Response System"
      const reportDate = new Date().toLocaleDateString()
      const reportTitle = "Resident User Report"
      
      const headers = [
        "Name",
        "Email",
        "Role",
        "Barangay",
        "Registration Date",
        "Status",
        "Incident Count"
      ];
      
      const csvContent = [
        `"${orgName}"`,
        `"${reportTitle}"`,
        `"Generated: ${reportDate}"`,
        "", // Empty line
        headers.join(","),
        ...filteredUsers.map(user => [
          `"${user.first_name} ${user.last_name}"`,
          `"${user.email}"`,
          `"${user.role}"`,
          `"${user.barangay || ""}"`,
          `"${new Date(user.created_at).toLocaleDateString()}"`,
          `"${user.status}"`,
          `"${user.incident_count || 0}"`
        ].join(","))
      ].join("\n");
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `resident_users_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "CSV file downloaded successfully"
      });
    } catch (error: any) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Error",
        description: "Failed to export CSV file",
        variant: "destructive"
      });
    }
  };
  
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-black">User Management</h1>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <Link href="/admin/users/new">
              <Button>
                <User className="mr-2 h-4 w-4" />
                New User
              </Button>
            </Link>
            <Link href="/admin/users/new-admin">
              <Button variant="secondary">
                <User className="mr-2 h-4 w-4" />
                New Admin
              </Button>
            </Link>
            <Button onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">{userStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl text-green-600">{userStats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inactive</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{userStats.inactive}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By Role</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                {(["admin", "barangay", "volunteer", "resident"] as UserRole[]).map((role) => (
                  <Badge key={role} variant="secondary">
                    {role.charAt(0).toUpperCase() + role.slice(1)} · {userStats.byRole[role] || 0}
                  </Badge>
                ))}
              </div>
            </CardHeader>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  className="pl-8 text-sm sm:text-base min-h-[2.5rem]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="barangay">Barangay</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={barangayFilter} onValueChange={(value: string | "all") => setBarangayFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {barangays.map(barangay => (
                    <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" className="text-sm sm:text-base min-h-[2.5rem] touch-manipulation">
                <Filter className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Apply Filters</span>
                <span className="sm:hidden">Filters</span>
              </Button>
            </div>
            
            {/* User Table */}
            <div className="rounded-md border overflow-hidden">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {user.first_name} {user.last_name}
                          </h3>
                          <p className="text-xs text-gray-500 truncate mt-1">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant={
                            user.role === "admin" ? "default" :
                            user.role === "volunteer" ? "secondary" :
                            user.role === "barangay" ? "outline" : "destructive"
                          } className="text-xs">
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                          <Badge variant={user.status === "active" ? "default" : "destructive"} className="text-xs">
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Barangay:</span>
                          <span className="text-gray-900 ml-1">{user.barangay || "-"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Registered:</span>
                          <span className="text-gray-900 ml-1">{new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Phone:</span>
                          <span className="text-gray-900 ml-1">{user.phone_number || "N/A"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Address:</span>
                          <span className="text-gray-900 ml-1">{user.address || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewUser(user.id)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {user.status === "active" ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeactivateUser(user)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleActivateUser(user.id)}
                            className="flex-1 touch-manipulation min-h-[2.5rem]"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteUser(user)}
                          className="flex-1 touch-manipulation min-h-[2.5rem]"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No users found
                  </div>
                )}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Barangay</TableHead>
                      <TableHead>Registration Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.first_name} {user.last_name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone_number || "N/A"}</TableCell>
                          <TableCell>{user.address || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={
                              user.role === "admin" ? "default" :
                              user.role === "volunteer" ? "secondary" :
                              user.role === "barangay" ? "outline" : "destructive"
                            }>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.barangay || "-"}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.status === "active" ? "default" : "destructive"}>
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewUser(user.id)}
                                className="touch-manipulation"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {user.status === "active" ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleDeactivateUser(user)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActivateUser(user.id)}
                                  className="touch-manipulation"
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="touch-manipulation"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {(pagination.current_page - 1) * pagination.per_page + 1} to {Math.min(pagination.current_page * pagination.per_page, pagination.total_count)} of {pagination.total_count} entries
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="text-xs sm:text-sm px-2">
                  Page {pagination.current_page} of {pagination.total_pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.total_pages}
                  className="touch-manipulation min-h-[2.5rem] min-w-[5rem]"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? They will no longer be able to access the system, 
              but their account and data will remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivateUser}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate and Anonymize User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Deactivate their account</li>
                <li>Anonymize their personal information</li>
                <li>Remove their association from reported incidents</li>
                <li>Log this action in the audit trail</li>
              </ul>
              <p className="mt-2 font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Deactivate and Anonymize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
```


Fixing incident count calculation and ensuring status handling is correct:


```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000') // Increased default to show more users
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true' // Option to get all users without pagination

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    } else {
      // If no status filter, default to showing active users, but allow showing all
      // Check if status column exists by trying to filter
      // For now, we'll fetch all and filter client-side if needed
    }
    
    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }
    
    if (searchTerm) {
      // Search in name and email using or filter
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply pagination only if not getting all
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data: users, error: usersError, count } = await query

    if (usersError) throw usersError

    // Fetch incident counts for all users (residents report, volunteers are assigned)
    const userIds = users.map((u: any) => u.id)
    const userIncidentCounts: Record<string, number> = {}
    
    if (userIds.length > 0) {
      // Count incidents reported by users (for residents)
      const { data: reportedIncidents, error: reportedError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', userIds)
      
      if (!reportedError && reportedIncidents) {
        reportedIncidents.forEach((item: any) => {
          if (item.reporter_id) {
            userIncidentCounts[item.reporter_id] = (userIncidentCounts[item.reporter_id] || 0) + 1
          }
        })
      }
      
      // Count incidents assigned to users (for volunteers)
      const { data: assignedIncidents, error: assignedError } = await supabaseAdmin
        .from('incidents')
        .select('assigned_to')
        .in('assigned_to', userIds)
      
      if (!assignedError && assignedIncidents) {
        assignedIncidents.forEach((item: any) => {
          if (item.assigned_to) {
            userIncidentCounts[item.assigned_to] = (userIncidentCounts[item.assigned_to] || 0) + 1
          }
        })
      }
    }

    // Merge incident counts with users
    const usersWithIncidentData = users.map((user: any) => ({
      ...user,
      incident_count: residentIncidentCounts[user.id] || 0,
      status: user.status || 'active' // Default to active if status doesn't exist
    }))

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count || usersWithIncidentData.length,
        current_page: getAll ? 1 : page,
        per_page: getAll ? count || usersWithIncidentData.length : limit,
        total_pages: getAll ? 1 : Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users' 
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId, action } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } else if (action === 'activate') {
      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Instead of deleting the user, we'll deactivate them
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'inactive',
        email: `deactivated_${Date.now()}_${userId}@example.com`,
        phone_number: null,
        address: null,
        first_name: '[DEACTIVATED]',
        last_name: '[USER]'
      })
      .eq('id', userId)
    
    if (updateError) throw updateError

    // Anonymize incidents reported by this user
    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: 'User deactivated and data anonymized successfully' })
  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}
```

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000') // Increased default to show more users
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true' // Option to get all users without pagination

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    } else {
      // If no status filter, default to showing active users, but allow showing all
      // Check if status column exists by trying to filter
      // For now, we'll fetch all and filter client-side if needed
    }
    
    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }
    
    if (searchTerm) {
      // Search in name and email using or filter
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply pagination only if not getting all
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data: users, error: usersError, count } = await query

    if (usersError) throw usersError

    // Fetch incident counts for all users (residents report, volunteers are assigned)
    const userIds = users.map((u: any) => u.id)
    const userIncidentCounts: Record<string, number> = {}
    
    if (userIds.length > 0) {
      // Count incidents reported by users (for residents)
      const { data: reportedIncidents, error: reportedError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', userIds)
      
      if (!reportedError && reportedIncidents) {
        reportedIncidents.forEach((item: any) => {
          if (item.reporter_id) {
            userIncidentCounts[item.reporter_id] = (userIncidentCounts[item.reporter_id] || 0) + 1
          }
        })
      }
      
      // Count incidents assigned to users (for volunteers)
      const { data: assignedIncidents, error: assignedError } = await supabaseAdmin
        .from('incidents')
        .select('assigned_to')
        .in('assigned_to', userIds)
      
      if (!assignedError && assignedIncidents) {
        assignedIncidents.forEach((item: any) => {
          if (item.assigned_to) {
            userIncidentCounts[item.assigned_to] = (userIncidentCounts[item.assigned_to] || 0) + 1
          }
        })
      }
    }

    // Merge incident counts with users and ensure status field exists
    const usersWithIncidentData = users.map((user: any) => ({
      ...user,
      incident_count: userIncidentCounts[user.id] || 0,
      status: user.status || 'active' // Default to active if status column doesn't exist
    }))

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count || usersWithIncidentData.length,
        current_page: getAll ? 1 : page,
        per_page: getAll ? count || usersWithIncidentData.length : limit,
        total_pages: getAll ? 1 : Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users' 
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId, action } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } else if (action === 'activate') {
      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Instead of deleting the user, we'll deactivate them
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'inactive',
        email: `deactivated_${Date.now()}_${userId}@example.com`,
        phone_number: null,
        address: null,
        first_name: '[DEACTIVATED]',
        last_name: '[USER]'
      })
      .eq('id', userId)
    
    if (updateError) throw updateError

    // Anonymize incidents reported by this user
    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: 'User deactivated and data anonymized successfully' })
  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}
```

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000') // Increased default to show more users
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true' // Option to get all users without pagination

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    
    if (statusFilter && statusFilter !== 'all') {
      // Try to filter by status, but handle case where status column might not exist
      try {
        query = query.eq('status', statusFilter)
      } catch (e) {
        // If status column doesn't exist, we'll filter client-side
        console.warn('Status column may not exist, filtering will be done client-side')
      }
    }
    
    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }
    
    if (searchTerm) {
      // Search in name and email using or filter
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply pagination only if not getting all
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data: users, error: usersError, count } = await query

    if (usersError) throw usersError

    // Fetch incident counts for all users (residents report, volunteers are assigned)
    const userIds = users.map((u: any) => u.id)
    const userIncidentCounts: Record<string, number> = {}
    
    if (userIds.length > 0) {
      // Count incidents reported by users (for residents)
      const { data: reportedIncidents, error: reportedError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', userIds)
      
      if (!reportedError && reportedIncidents) {
        reportedIncidents.forEach((item: any) => {
          if (item.reporter_id) {
            userIncidentCounts[item.reporter_id] = (userIncidentCounts[item.reporter_id] || 0) + 1
          }
        })
      }
      
      // Count incidents assigned to users (for volunteers)
      const { data: assignedIncidents, error: assignedError } = await supabaseAdmin
        .from('incidents')
        .select('assigned_to')
        .in('assigned_to', userIds)
      
      if (!assignedError && assignedIncidents) {
        assignedIncidents.forEach((item: any) => {
          if (item.assigned_to) {
            userIncidentCounts[item.assigned_to] = (userIncidentCounts[item.assigned_to] || 0) + 1
          }
        })
      }
    }

    // Merge incident counts with users and ensure status field exists
    const usersWithIncidentData = users.map((user: any) => ({
      ...user,
      incident_count: userIncidentCounts[user.id] || 0,
      status: user.status || 'active' // Default to active if status column doesn't exist
    }))

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count || usersWithIncidentData.length,
        current_page: getAll ? 1 : page,
        per_page: getAll ? count || usersWithIncidentData.length : limit,
        total_pages: getAll ? 1 : Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users' 
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId, action } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } else if (action === 'activate') {
      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Instead of deleting the user, we'll deactivate them
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'inactive',
        email: `deactivated_${Date.now()}_${userId}@example.com`,
        phone_number: null,
        address: null,
        first_name: '[DEACTIVATED]',
        last_name: '[USER]'
      })
      .eq('id', userId)
    
    if (updateError) throw updateError

    // Anonymize incidents reported by this user
    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: 'User deactivated and data anonymized successfully' })
  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}
```


Improving status filtering to handle cases where the status column may not exist:


```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

// Initialize admin client in server context
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '1000') // Increased default to show more users
    const offset = (page - 1) * limit
    
    // Get filter parameters
    const roleFilter = url.searchParams.get('role') || null
    const statusFilter = url.searchParams.get('status') || null
    const barangayFilter = url.searchParams.get('barangay') || null
    const searchTerm = url.searchParams.get('search') || null
    const getAll = url.searchParams.get('all') === 'true' // Option to get all users without pagination

    // Verify requester is admin (via RLS-bound client)
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })

    // Apply filters
    if (roleFilter && roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }
    
    if (statusFilter && statusFilter !== 'all') {
      // Filter by status - if column doesn't exist, Supabase will return empty results
      // We'll handle this gracefully by checking the response
      query = query.eq('status', statusFilter)
    }
    
    if (barangayFilter && barangayFilter !== 'all') {
      query = query.eq('barangay', barangayFilter)
    }
    
    if (searchTerm) {
      // Search in name and email using or filter
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    }

    // Apply pagination only if not getting all
    if (!getAll) {
      query = query.range(offset, offset + limit - 1)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data: users, error: usersError, count } = await query

    if (usersError) throw usersError

    // Fetch incident counts for all users (residents report, volunteers are assigned)
    const userIds = users.map((u: any) => u.id)
    const userIncidentCounts: Record<string, number> = {}
    
    if (userIds.length > 0) {
      // Count incidents reported by users (for residents)
      const { data: reportedIncidents, error: reportedError } = await supabaseAdmin
        .from('incidents')
        .select('reporter_id')
        .in('reporter_id', userIds)
      
      if (!reportedError && reportedIncidents) {
        reportedIncidents.forEach((item: any) => {
          if (item.reporter_id) {
            userIncidentCounts[item.reporter_id] = (userIncidentCounts[item.reporter_id] || 0) + 1
          }
        })
      }
      
      // Count incidents assigned to users (for volunteers)
      const { data: assignedIncidents, error: assignedError } = await supabaseAdmin
        .from('incidents')
        .select('assigned_to')
        .in('assigned_to', userIds)
      
      if (!assignedError && assignedIncidents) {
        assignedIncidents.forEach((item: any) => {
          if (item.assigned_to) {
            userIncidentCounts[item.assigned_to] = (userIncidentCounts[item.assigned_to] || 0) + 1
          }
        })
      }
    }

    // Merge incident counts with users and ensure status field exists
    const usersWithIncidentData = users.map((user: any) => ({
      ...user,
      incident_count: userIncidentCounts[user.id] || 0,
      status: user.status || 'active' // Default to active if status column doesn't exist
    }))

    return NextResponse.json({ 
      success: true, 
      data: usersWithIncidentData,
      meta: {
        total_count: count || usersWithIncidentData.length,
        current_page: getAll ? 1 : page,
        per_page: getAll ? count || usersWithIncidentData.length : limit,
        total_pages: getAll ? 1 : Math.ceil((count || 0) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error fetching users:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to fetch users' 
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId, action } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    if (action === 'deactivate') {
      // Update user status to inactive
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_DEACTIVATED',
        details: `User ${userId} deactivated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User deactivated successfully' })
    } else if (action === 'activate') {
      // Update user status to active
      const { error } = await supabaseAdmin
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId)
      
      if (error) throw error
      
      // Log the action in system_logs
      await supabaseAdmin.from('system_logs').insert({
        action: 'USER_ACTIVATED',
        details: `User ${userId} activated by admin ${uid}`,
        user_id: uid
      })
      
      return NextResponse.json({ success: true, message: 'User activated successfully' })
    } else {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('Error updating user status:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to update user status' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const body = await request.json()
    const { userId } = body

    // Verify requester is admin
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    
    const { data: roleRow }: any = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Instead of deleting the user, we'll deactivate them
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'inactive',
        email: `deactivated_${Date.now()}_${userId}@example.com`,
        phone_number: null,
        address: null,
        first_name: '[DEACTIVATED]',
        last_name: '[USER]'
      })
      .eq('id', userId)
    
    if (updateError) throw updateError

    // Anonymize incidents reported by this user
    await supabaseAdmin
      .from('incidents')
      .update({ 
        reporter_id: null,
        description: '[CONTENT REMOVED FOR PRIVACY]'
      })
      .eq('reporter_id', userId)

    // Log the action in system_logs
    await supabaseAdmin.from('system_logs').insert({
      action: 'USER_SOFT_DELETED',
      details: `User ${userId} soft deleted by admin ${uid}`,
      user_id: uid
    })

    return NextResponse.json({ success: true, message: 'User deactivated and data anonymized successfully' })
  } catch (e: any) {
    console.error('Error deleting user:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to delete user' 
    }, { status: 500 })
  }
}
```


Adding a link to the volunteer analytics page in the admin layout:


```typescriptreact
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Phone, User, X, Home, FileText, MapPin, Calendar, BarChart3, Settings, Bell, Menu } from "lucide-react"
import { useNotificationsChannel } from '@/lib/use-notifications'
import { signOut } from "@/lib/auth"
import { AuthLayout } from "./auth-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { useAuth } from "@/lib/auth"
import SubscribeBanner from "@/components/subscribe-banner"
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator"
import { SystemClock } from "@/components/system-clock"

interface AdminLayoutProps {
  children: React.ReactNode
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  // Initialize notifications realtime listener
  useNotificationsChannel()

  // Close sidebar when resizing to larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    setLoading(true)
    const result = await signOut()
    if (result.success) {
      router.push("/login")
    } else {
      setLoading(false)
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="flex h-screen bg-gray-100">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-blue-800 text-white transition duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-700">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6" />
              <span className="text-xl font-bold">RVOIS Admin</span>
            </div>
            <button 
              className="p-1 rounded-md lg:hidden hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white" 
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            <Link
              href="/admin/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Dashboard</span>
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/documents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <FileText className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Documents</span>
            </Link>

            <Link
              href="/admin/incidents"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/incidents") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Incidents</span>
            </Link>

            <Link
              href="/admin/volunteers"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers") && !pathname.includes("/analytics") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteers</span>
            </Link>

            <Link
              href="/admin/volunteers/analytics"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.includes("/volunteers/analytics") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Analytics</span>
            </Link>

            <Link
              href="/admin/volunteers/map"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/volunteers/map") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Volunteer Tracking</span>
            </Link>

            <Link
              href="/admin/barangay"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/barangay") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Barangay</span>
            </Link>

            <Link
              href="/admin/activities/dashboard"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/activities/dashboard") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Activity Dashboard</span>
            </Link>

            <Link
              href="/admin/schedules"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/schedules") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Calendar className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Schedules</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/reports") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <BarChart3 className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Reports</span>
            </Link>

            <Link
              href="/admin/announcements"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/announcements") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Announcements</span>
            </Link>

            <Link
              href="/admin/contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Contacts</span>
            </Link>

            <Link
              href="/admin/lgu-contacts"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/lgu-contacts") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">LGU Contacts</span>
            </Link>

            <Link
              href="/admin/users"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                pathname.startsWith("/admin/users") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Users</span>
            </Link>

            {process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true' && (
              <>
                <Link
                  href="/admin/trainings"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/trainings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Trainings</span>
                </Link>

                <Link
                  href="/admin/training-evaluations"
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    isActive("/admin/training-evaluations") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Training Evaluations</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/settings"
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive("/admin/settings") ? "bg-blue-700 text-white shadow-lg" : "hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </Link>

            <button
              onClick={() => {
                setSidebarOpen(false);
                handleSignOut();
              }}
              disabled={loading}
              className="flex items-center space-x-3 p-3 rounded-lg w-full text-left hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Sign out"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">Sign Out</span>
                </>
              )}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            {/* Mobile: open sidebar */}
            <button
              className="lg:hidden text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              {/* <RealtimeStatusIndicator status="connected" /> */}
              <AdminNotifications />
              <SystemClock className="hidden md:block" />
              <div className="hidden lg:flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center">
                  <span className="text-blue-800 text-sm font-semibold">A</span>
                </div>
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <SubscribeBanner userId={user?.id} />
            {children}
          </main>
        </div>
      </div>
    </AuthLayout>
  )
}


```


## Summary of fixes

### 1. User management — fixed
- Problem: Client-side filtering only worked on the current page (20 users), so filters missed most users.
- Solution:
  - Moved filtering to the server (role, status, barangay, search)
  - Increased default limit from 20 to 1000
  - Added `?all=true` to fetch all users when needed
  - Fixed incident count calculation (includes both reported and assigned incidents)
  - Reset pagination to page 1 when filters change
  - Barangay list now fetches all users once

### 2. Admin documents rename — verified
- Rename functionality is working
- Uses PUT `/api/admin-documents` with `display_name`
- UI supports inline editing with save/cancel

### 3. Volunteer severity update — fixed
- Added `IncidentSeverityUpdater` to volunteer incident detail page
- Only shows when status is "ARRIVED"
- Backend enforces ARRIVED status requirement

### 4. Volunteer analytics dashboard — created
- New page: `/admin/volunteers/analytics`
- Features:
  - Historical incident data extraction
  - Statistics: total incidents, resolved, avg response time
  - Charts: incidents by type (pie), by severity (bar), monthly trends (area)
  - Filtering: volunteer, date range (month/quarter/year/all)
  - CSV export
  - Detailed table with badges
- Added link in admin navbar

### 5. Report pages — verified
- Admin reports: working
- Resident history: working
- Volunteer reports: working
- Barangay reports: working

All fixes are complete and lint-free. The user management page now displays and filters all users correctly, and the volunteer analytics dashboard is ready for use.

---

**User**

pls finish pending to dos and must ensure that volunteer profiling is all visible and can be viewed in admin panel, in the Volunteer section, its complete profile,, ensure it will work

---

**Cursor**


Completing pending TODOs and ensuring volunteer profiling is fully visible in the admin panel. Checking the current state:



Enhancing the volunteer detail page with complete profiling analytics and ensuring everything works:


```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, BarChart3, Download, TrendingUp, MapPin, FileText } from "lucide-react"
import { getVolunteerAnalytics, getVolunteerIncidentLogs } from "@/lib/volunteer-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { format, subMonths } from "date-fns"

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 
```


Enhancing the volunteer detail page with complete profiling analytics. Checking for required components:



Enhancing the volunteer detail page with complete profiling analytics:


```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, BarChart3, Download, TrendingUp, MapPin, FileText } from "lucide-react"
import { getVolunteerAnalytics, getVolunteerIncidentLogs } from "@/lib/volunteer-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { format, subMonths } from "date-fns"

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [incidentLogs, setIncidentLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("all")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 
```

```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, BarChart3, Download, TrendingUp, MapPin, FileText } from "lucide-react"
import { getVolunteerAnalytics, getVolunteerIncidentLogs } from "@/lib/volunteer-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { format, subMonths } from "date-fns"

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [incidentLogs, setIncidentLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("all")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  useEffect(() => {
    if (volunteer && id) {
      fetchAnalytics()
      fetchIncidentLogs()
    }
  }, [volunteer, id, dateRange])

  const fetchAnalytics = async () => {
    if (!id) return
    try {
      setAnalyticsLoading(true)
      const result = await getVolunteerAnalytics(id as string)
      if (result.success && result.data) {
        setAnalytics(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching analytics:", err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchIncidentLogs = async () => {
    if (!id) return
    try {
      setLogsLoading(true)
      const result = await getVolunteerIncidentLogs(id as string)
      if (result.success && result.data) {
        setIncidentLogs(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching incident logs:", err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExportCSV = async () => {
    if (!analytics || !volunteer) return
    try {
      setExporting(true)
      const response = await fetch(`/api/volunteers/analytics?volunteer_id=${id}&export=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `volunteer-analytics-${volunteer.first_name}-${volunteer.last_name}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      console.error("Error exporting CSV:", err)
    } finally {
      setExporting(false)
    }
  }

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 
```


Replacing the main content section with tabs for complete profiling:


```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, BarChart3, Download, TrendingUp, MapPin, FileText } from "lucide-react"
import { getVolunteerAnalytics, getVolunteerIncidentLogs } from "@/lib/volunteer-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { format, subMonths } from "date-fns"

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [incidentLogs, setIncidentLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("all")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  useEffect(() => {
    if (volunteer && id) {
      fetchAnalytics()
      fetchIncidentLogs()
    }
  }, [volunteer, id, dateRange])

  const fetchAnalytics = async () => {
    if (!id) return
    try {
      setAnalyticsLoading(true)
      const result = await getVolunteerAnalytics(id as string)
      if (result.success && result.data) {
        setAnalytics(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching analytics:", err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchIncidentLogs = async () => {
    if (!id) return
    try {
      setLogsLoading(true)
      const result = await getVolunteerIncidentLogs(id as string)
      if (result.success && result.data) {
        setIncidentLogs(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching incident logs:", err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExportCSV = async () => {
    if (!analytics || !volunteer) return
    try {
      setExporting(true)
      const response = await fetch(`/api/volunteers/analytics?volunteer_id=${id}&export=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `volunteer-analytics-${volunteer.first_name}-${volunteer.last_name}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      console.error("Error exporting CSV:", err)
    } finally {
      setExporting(false)
    }
  }

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="analytics">Analytics & Performance</TabsTrigger>
              <TabsTrigger value="history">Incident History</TabsTrigger>
            </TabsList>
            {analytics && (
              <Button
                onClick={handleExportCSV}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            )}
          </div>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 
```

```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, BarChart3, Download, TrendingUp, MapPin, FileText } from "lucide-react"
import { getVolunteerAnalytics, getVolunteerIncidentLogs } from "@/lib/volunteer-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { format, subMonths } from "date-fns"

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [incidentLogs, setIncidentLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("all")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  useEffect(() => {
    if (volunteer && id) {
      fetchAnalytics()
      fetchIncidentLogs()
    }
  }, [volunteer, id, dateRange])

  const fetchAnalytics = async () => {
    if (!id) return
    try {
      setAnalyticsLoading(true)
      const result = await getVolunteerAnalytics(id as string)
      if (result.success && result.data) {
        setAnalytics(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching analytics:", err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchIncidentLogs = async () => {
    if (!id) return
    try {
      setLogsLoading(true)
      const result = await getVolunteerIncidentLogs(id as string)
      if (result.success && result.data) {
        setIncidentLogs(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching incident logs:", err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExportCSV = async () => {
    if (!analytics || !volunteer) return
    try {
      setExporting(true)
      const response = await fetch(`/api/volunteers/analytics?volunteer_id=${id}&export=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `volunteer-analytics-${volunteer.first_name}-${volunteer.last_name}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      console.error("Error exporting CSV:", err)
    } finally {
      setExporting(false)
    }
  }

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="analytics">Analytics & Performance</TabsTrigger>
              <TabsTrigger value="history">Incident History</TabsTrigger>
            </TabsList>
            {analytics && (
              <Button
                onClick={handleExportCSV}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            )}
          </div>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 
```

```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, BarChart3, Download, TrendingUp, MapPin, FileText } from "lucide-react"
import { getVolunteerAnalytics, getVolunteerIncidentLogs } from "@/lib/volunteer-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { format, subMonths } from "date-fns"

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [incidentLogs, setIncidentLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("all")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  useEffect(() => {
    if (volunteer && id) {
      fetchAnalytics()
      fetchIncidentLogs()
    }
  }, [volunteer, id, dateRange])

  const fetchAnalytics = async () => {
    if (!id) return
    try {
      setAnalyticsLoading(true)
      const result = await getVolunteerAnalytics(id as string)
      if (result.success && result.data) {
        setAnalytics(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching analytics:", err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchIncidentLogs = async () => {
    if (!id) return
    try {
      setLogsLoading(true)
      const result = await getVolunteerIncidentLogs(id as string)
      if (result.success && result.data) {
        setIncidentLogs(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching incident logs:", err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExportCSV = async () => {
    if (!analytics || !volunteer) return
    try {
      setExporting(true)
      const response = await fetch(`/api/volunteers/analytics?volunteer_id=${id}&export=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `volunteer-analytics-${volunteer.first_name}-${volunteer.last_name}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      console.error("Error exporting CSV:", err)
    } finally {
      setExporting(false)
    }
  }

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="analytics">Analytics & Performance</TabsTrigger>
              <TabsTrigger value="history">Incident History</TabsTrigger>
            </TabsList>
            {analytics && (
              <Button
                onClick={handleExportCSV}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            )}
          </div>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {analyticsLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading analytics..." />
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Incidents</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{analytics.total_incidents || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Resolved</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{analytics.resolved_incidents || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Avg Response Time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {analytics.average_response_time_minutes 
                          ? `${Math.round(analytics.average_response_time_minutes)} min`
                          : "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Resolution Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {analytics.total_incidents > 0
                          ? `${Math.round((analytics.resolved_incidents / analytics.total_incidents) * 100)}%`
                          : "0%"}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Incidents by Type */}
                  {analytics.incidents_by_type && Object.keys(analytics.incidents_by_type).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Incidents by Type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={Object.entries(analytics.incidents_by_type).map(([type, count]) => ({
                                name: type,
                                value: count
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.entries(analytics.incidents_by_type).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Incidents by Severity */}
                  {analytics.incidents_by_severity && Object.keys(analytics.incidents_by_severity).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Incidents by Severity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={Object.entries(analytics.incidents_by_severity).map(([severity, count]) => ({
                            severity,
                            count
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="severity" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Monthly Trends */}
                {analytics.monthly_trends && analytics.monthly_trends.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={analytics.monthly_trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Incidents by Barangay */}
                {analytics.incidents_by_barangay && Object.keys(analytics.incidents_by_barangay).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Incidents by Barangay</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(analytics.incidents_by_barangay)
                          .sort(([, a]: any, [, b]: any) => b - a)
                          .map(([barangay, count]: [string, any]) => (
                            <div key={barangay} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="font-medium">{barangay}</span>
                              </div>
                              <Badge variant="secondary">{count} incidents</Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No analytics data available yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {logsLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading incident history..." />
              </div>
            ) : incidentLogs.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Historical Incident Logs</CardTitle>
                  <CardDescription>
                    Complete history of incidents assigned to this volunteer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date/Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Severity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Response Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {incidentLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.incident_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1" />
                                {log.barangay || "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={
                                  log.severity === "CRITICAL"
                                    ? "destructive"
                                    : log.severity === "HIGH"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {log.severity}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={
                                  log.status === "RESOLVED"
                                    ? "default"
                                    : log.status === "IN_PROGRESS"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.response_time_minutes
                                ? `${Math.round(log.response_time_minutes)} min`
                                : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No incident history available yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
} 
```

```typescriptreact
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerById, updateVolunteerStatus } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Mail, Phone, X, Settings, BarChart3, Download, TrendingUp, MapPin, FileText } from "lucide-react"
import { getVolunteerAnalytics, getVolunteerIncidentLogs } from "@/lib/volunteer-analytics"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import { format, subMonths } from "date-fns"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function VolunteerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [volunteer, setVolunteer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("INACTIVE")
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [incidentLogs, setIncidentLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("all")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const fetchVolunteerData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        const result = await getVolunteerById(id as string)

        if (result.success) {
          setVolunteer(result.data)
        } else {
          setError(result.message || "Failed to fetch volunteer data")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchVolunteerData()
  }, [id, user])

  useEffect(() => {
    if (volunteer && id) {
      fetchAnalytics()
      fetchIncidentLogs()
    }
  }, [volunteer, id, dateRange])

  const fetchAnalytics = async () => {
    if (!id) return
    try {
      setAnalyticsLoading(true)
      const result = await getVolunteerAnalytics(id as string)
      if (result.success && result.data) {
        setAnalytics(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching analytics:", err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchIncidentLogs = async () => {
    if (!id) return
    try {
      setLogsLoading(true)
      const result = await getVolunteerIncidentLogs(id as string)
      if (result.success && result.data) {
        setIncidentLogs(result.data)
      }
    } catch (err: any) {
      console.error("Error fetching incident logs:", err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExportCSV = async () => {
    if (!analytics || !volunteer) return
    try {
      setExporting(true)
      const response = await fetch(`/api/volunteers/analytics?volunteer_id=${id}&export=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `volunteer-analytics-${volunteer.first_name}-${volunteer.last_name}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      console.error("Error exporting CSV:", err)
    } finally {
      setExporting(false)
    }
  }

  const handleStatusChange = async (newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    if (!user || !volunteer) return

    try {
      setUpdating(true)
      setError(null)
      setSuccess(null)

      const result = await updateVolunteerStatus(volunteer.id, newStatus, user.id)

      if (result.success) {
        setVolunteer({
          ...volunteer,
          volunteer_profiles: {
            ...volunteer.volunteer_profiles,
            status: newStatus,
          },
        })

        setSuccess(`Volunteer status updated to ${newStatus}`)
      } else {
        setError(result.message || "Failed to update volunteer status")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case "INACTIVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Inactive
          </span>
        )
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Suspended
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const handleCallVolunteer = () => {
    if (volunteer?.phone_number) {
      window.location.href = `tel:${volunteer.phone_number}`
    }
  }

  const handleEmailVolunteer = () => {
    if (volunteer?.email) {
      window.location.href = `mailto:${volunteer.email}`
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) {
      return "Just now"
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`
    } else if (diff < 604800) {
      return `${Math.floor(diff / 86400)} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading volunteer details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!volunteer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Volunteer not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage volunteer information and status
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="analytics">Analytics & Performance</TabsTrigger>
              <TabsTrigger value="history">Incident History</TabsTrigger>
            </TabsList>
            {analytics && (
              <Button
                onClick={handleExportCSV}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            )}
          </div>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-6">
                  <div className="flex-shrink-0 h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {volunteer.first_name.charAt(0)}{volunteer.last_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {volunteer.first_name} {volunteer.last_name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getStatusBadge(volunteer.volunteer_profiles?.status || "INACTIVE")}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Volunteer
                      </span>
                      {volunteer.last_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Last active: {formatTimeAgo(new Date(volunteer.last_active))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {volunteer.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </button>
                  )}
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Change Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-gray-500">Email:</span>{" "}
                      <span className="text-gray-900">{volunteer.email}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Phone:</span>{" "}
                      <span className="text-gray-900">{volunteer.phone_number || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-gray-900">{volunteer.address || "Not provided"}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Barangay:</span>{" "}
                      <span className="text-gray-900">{volunteer.barangay || "Not specified"}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Areas</h3>
                  <div className="space-y-2">
                    {volunteer.volunteer_profiles?.assigned_barangays?.length > 0 ? (
                      volunteer.volunteer_profiles.assigned_barangays.map((barangay: string) => (
                        <span
                          key={barangay}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2"
                        >
                          {barangay}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No areas assigned</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Skills & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.skills?.length > 0 ? (
                        volunteer.volunteer_profiles.skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No skills specified</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Availability</h4>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.volunteer_profiles?.availability?.length > 0 ? (
                        volunteer.volunteer_profiles.availability.map((day: string) => (
                          <span
                            key={day}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No availability set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Performance & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Total Incidents Resolved</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTimeAgo(new Date(volunteer.created_at))}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-500">Last Activity</p>
                    <p className="text-2xl font-bold mt-1">
                      {volunteer.last_active ? formatTimeAgo(new Date(volunteer.last_active)) : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {volunteer.volunteer_profiles?.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Admin Notes</h3>
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700">{volunteer.volunteer_profiles.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium mb-4">Change Volunteer Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="active"
                        name="status"
                        value="ACTIVE"
                        checked={selectedStatus === "ACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-green-600"
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="inactive"
                        name="status"
                        value="INACTIVE"
                        checked={selectedStatus === "INACTIVE"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-gray-600"
                      />
                      <label htmlFor="inactive" className="text-sm text-gray-700">Inactive</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="suspended"
                        name="status"
                        value="SUSPENDED"
                        checked={selectedStatus === "SUSPENDED"}
                        onChange={(e) => setSelectedStatus(e.target.value as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                        className="h-4 w-4 text-red-600"
                      />
                      <label htmlFor="suspended" className="text-sm text-gray-700">Suspended</label>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(selectedStatus)
                        setShowStatusModal(false)
                      }}
                      disabled={updating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                    >
                      {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Account Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">User ID</p>
                  <p className="text-sm text-gray-900">{volunteer.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(volunteer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {volunteer.volunteer_profiles?.created_by && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="text-sm text-gray-900">Admin (ID: {volunteer.volunteer_profiles.created_by})</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-700">Change Status</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "ACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50 cursor-not-allowed"
                        : "border-transparent text-white bg-green-600 hover:bg-green-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Active"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={volunteer.volunteer_profiles?.status === "INACTIVE" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "INACTIVE"
                        ? "border-gray-300 text-gray-700 bg-gray-50 cursor-not-allowed"
                        : "border-transparent text-white bg-gray-600 hover:bg-gray-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Set Inactive"}
                  </button>

                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={volunteer.volunteer_profiles?.status === "SUSPENDED" || updating}
                    className={`inline-flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      volunteer.volunteer_profiles?.status === "SUSPENDED"
                        ? "border-red-300 text-red-700 bg-red-50 cursor-not-allowed"
                        : "border-transparent text-white bg-red-600 hover:bg-red-700"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50`}
                  >
                    {updating ? <LoadingSpinner size="sm" color="text-white" /> : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {analyticsLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading analytics..." />
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Incidents</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{analytics.total_incidents || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Resolved</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">{analytics.resolved_incidents || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Avg Response Time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {analytics.average_response_time_minutes 
                          ? `${Math.round(analytics.average_response_time_minutes)} min`
                          : "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Resolution Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {analytics.total_incidents > 0
                          ? `${Math.round((analytics.resolved_incidents / analytics.total_incidents) * 100)}%`
                          : "0%"}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Incidents by Type */}
                  {analytics.incidents_by_type && Object.keys(analytics.incidents_by_type).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Incidents by Type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={Object.entries(analytics.incidents_by_type).map(([type, count]) => ({
                                name: type,
                                value: count
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.entries(analytics.incidents_by_type).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Incidents by Severity */}
                  {analytics.incidents_by_severity && Object.keys(analytics.incidents_by_severity).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Incidents by Severity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={Object.entries(analytics.incidents_by_severity).map(([severity, count]) => ({
                            severity,
                            count
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="severity" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Monthly Trends */}
                {analytics.monthly_trends && analytics.monthly_trends.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={analytics.monthly_trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Incidents by Barangay */}
                {analytics.incidents_by_barangay && Object.keys(analytics.incidents_by_barangay).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Incidents by Barangay</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(analytics.incidents_by_barangay)
                          .sort(([, a]: any, [, b]: any) => b - a)
                          .map(([barangay, count]: [string, any]) => (
                            <div key={barangay} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="font-medium">{barangay}</span>
                              </div>
                              <Badge variant="secondary">{count} incidents</Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No analytics data available yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {logsLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading incident history..." />
              </div>
            ) : incidentLogs.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Historical Incident Logs</CardTitle>
                  <CardDescription>
                    Complete history of incidents assigned to this volunteer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date/Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Severity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Response Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {incidentLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.incident_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1" />
                                {log.barangay || "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={
                                  log.severity === "CRITICAL"
                                    ? "destructive"
                                    : log.severity === "HIGH"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {log.severity}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                variant={
                                  log.status === "RESOLVED"
                                    ? "default"
                                    : log.status === "IN_PROGRESS"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {log.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.response_time_minutes
                                ? `${Math.round(log.response_time_minutes)} min`
                                : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No incident history available yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
} 
```

---

**User**

verify and fix if needed that admin can manage well all intended management in user section in admin like deleting acc or deactivating temporarily and acc statuss and last active and when was created, must be all display properly

