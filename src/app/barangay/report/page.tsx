"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BarangayLayout } from "@/components/layout/barangay-layout"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { AlertTriangle, Camera, Upload, X, MapPin } from "lucide-react"
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { createIncident } from "@/lib/incidents"
import { LocationTracker } from "@/components/location-tracker"

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

export default function BarangayReportPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    incidentType: "",
    description: "",
    address: "",
    barangay: user?.barangay || "",
    priority: "3",
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
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

    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }))
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo size must be less than 5MB")
      return
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setError("File must be an image")
      return
    }

    // Create canvas for watermark
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw image
      if (ctx) {
        ctx.drawImage(img, 0, 0)

        // Add watermark background
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

        // Add location name
        const locationText = formData.barangay 
          ? `${formData.barangay}, Talisay City`
          : user?.barangay 
            ? `${user.barangay}, Talisay City`
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

        // Convert canvas to JPEG file with quality setting
        canvas.toBlob((blob) => {
          if (blob) {
            const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
            setPhotoFile(watermarkedFile)
            setPhotoPreview(canvas.toDataURL('image/jpeg', 0.8)) // 80% quality
          }
        }, 'image/jpeg', 0.8)
      }
    }

    img.src = URL.createObjectURL(file)
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

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      })
      return
    }

    // Validate photo if required
    if (!photoFile) {
      setError("Please take a photo of the incident")
      toast({
        variant: "destructive",
        title: "Photo Required",
        description: "Please take a photo of the incident"
      })
      return
    }

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
          barangay: user?.barangay || "",
          priority: "3",
        })
        setLocation(null)
        setPhotoFile(null)
        setPhotoPreview(null)

        // Redirect to dashboard
        router.push("/barangay/dashboard?offline=true")
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
        barangay: user?.barangay || "",
        priority: "3",
      })
      setLocation(null)
      setPhotoFile(null)
      setPhotoPreview(null)

      // Redirect to dashboard with success message
      router.push("/barangay/dashboard?success=Incident reported successfully")
    } catch (err: any) {
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
    <BarangayLayout>
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
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 bg-white"
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

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  Severity Level *
                </label>
                <select
                  id="priority"
                  name="priority"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 bg-white"
                  value={formData.priority}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select Severity</option>
                  <option value="1">🔴 Critical - Life-threatening emergency</option>
                  <option value="2">🟠 High - Urgent assistance needed</option>
                  <option value="3">🟡 Medium - Standard response required</option>
                  <option value="4">🟢 Low - Non-urgent situation</option>
                  <option value="5">ℹ️ Information - Report only</option>
                </select>
                <p className="mt-1 text-xs text-gray-600">
                  Higher severity levels trigger faster response times and notifications
                </p>
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
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 bg-white"
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
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 bg-white"
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
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 bg-white"
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
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <LoadingSpinner size="sm" color="text-blue-600" />
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
                showGeofence={true}
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
                        <span className="font-medium text-blue-600 hover:text-blue-500">Take a photo</span>
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
              onClick={() => router.push("/barangay/dashboard")}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-900 bg-white hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              disabled={loading}
              aria-label="Cancel and return to dashboard"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
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
    </BarangayLayout>
  )
}