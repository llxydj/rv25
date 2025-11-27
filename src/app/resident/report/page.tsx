// src/app/resident/report/page.tsx

"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
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
import { VoiceRecorder } from "@/components/voice-recorder"

const MAX_PHOTOS = 3

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
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  
  // Add effect to log location changes
  useEffect(() => {
    console.log("Location state changed:", location);
  }, [location]);
  
  useEffect(() => {
    previewUrlsRef.current = photoPreviews;
  }, [photoPreviews])

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [barangays, setBarangays] = useState<string[]>([])
  const [gettingLocation, setGettingLocation] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [pendingReports, setPendingReports] = useState<any[]>([])
  const [autoGeoLock, setAutoGeoLock] = useState<{ address: boolean; barangay: boolean }>({ address: false, barangay: false });
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [submitStage, setSubmitStage] = useState<string | null>(null);
  
  // Add effect to log locationCaptured changes
  useEffect(() => {
    console.log("Location captured state changed:", locationCaptured);
  }, [locationCaptured]);

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
    console.log("Main useEffect called - initializing page");
    // Check if online
    setIsOffline(!navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Fetch barangays from the database
    const fetchBarangays = async () => {
      try {
        if (!navigator.onLine) {
          // Use cached barangays if offline
          const cachedBarangays = localStorage.getItem("barangays");
          if (cachedBarangays) {
            setBarangays(JSON.parse(cachedBarangays));
            return;
          }
        }

        const response = await fetch("/api/barangays");
        const result = await response.json();
        
        console.log("Barangays API response:", result);
        
        if (result.data && Array.isArray(result.data)) {
          const barangayNames = result.data.map((b: any) => b.name);
          console.log("Setting barangays:", barangayNames);
          setBarangays(barangayNames);
          // Cache barangays for offline use
          localStorage.setItem("barangays", JSON.stringify(barangayNames));
        } else {
          console.error("Invalid barangays data:", result);
          throw new Error("Invalid response format from barangays API");
        }
      } catch (err) {
        console.error("Error fetching barangays:", err);
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
        ];
        setBarangays(fallbackBarangays);
        localStorage.setItem("barangays", JSON.stringify(fallbackBarangays));
      }
    };

    fetchBarangays();

    // Load any pending reports from localStorage
    const loadPendingReports = () => {
      const savedReports = localStorage.getItem("pendingIncidentReports");
      if (savedReports) {
        setPendingReports(JSON.parse(savedReports));
      }
    };

    loadPendingReports();

    // Get user's current location with a delay to ensure components are mounted
    // Increased delay to ensure all components are properly initialized
    const locationTimer = setTimeout(() => {
      console.log("Calling getCurrentLocation from main useEffect");
      getCurrentLocation();
    }, 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(locationTimer);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      toast({ title: 'Report queued', description: 'Your report will be sent automatically when back online.' })
    }
    window.addEventListener('incident-queued', handler as EventListener)
    return () => window.removeEventListener('incident-queued', handler as EventListener)
  }, [toast])

  // Reverse geocode when location changes and we're online
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!location || isOffline) return;
      try {
        setGeoMessage('Detecting address from map pin…');
        const [lat, lng] = location;
        const url = `/api/geocode/reverse?lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('Reverse geocoding failed');
        const data = await res.json();
        if (cancelled) return;

        const addr = data?.address || {};
        // Try several fields for barangay-like locality
        const brgyCandidate: string | undefined = (
          addr.suburb || addr.village || addr.neighbourhood || addr.city_district || addr.quarter || addr.town || addr.county
        );
        // Prefer matches from known barangays list (case-insensitive contains)
        let resolvedBarangay = '';
        if (Array.isArray(barangays) && barangays.length > 0 && brgyCandidate) {
          const cand = String(brgyCandidate).toUpperCase();
          const match = barangays.find(b => cand.includes(String(b).toUpperCase()));
          if (match) resolvedBarangay = match;
        }
        // If still empty, fallback to brgyCandidate uppercased
        if (!resolvedBarangay && brgyCandidate) {
          resolvedBarangay = String(brgyCandidate).toUpperCase();
        }

        // Compose a human-readable address line
        const addressLine = data?.display_name || [addr.road, addr.suburb || addr.village || addr.neighbourhood, addr.city || addr.town || 'Talisay City'].filter(Boolean).join(', ');

        // Update form and lock when we have confident values
        const updates: any = {};
        const newLocks = { ...autoGeoLock };
        if (addressLine) { updates.address = addressLine; newLocks.address = true; }
        if (resolvedBarangay) { updates.barangay = resolvedBarangay; newLocks.barangay = true; }
        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }));
          setAutoGeoLock(newLocks);
          setGeoMessage('Address auto-filled from map pin');
        } else {
          setGeoMessage('Unable to detect address; you can type it manually');
          setAutoGeoLock({ address: false, barangay: false });
        }
      } catch (e) {
        setGeoMessage('Unable to detect address (network or service issue). You can type it manually.');
        setAutoGeoLock({ address: false, barangay: false });
      }
    };
    // Small debounce to avoid rapid calls when moving pin
    const t = setTimeout(run, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [location, isOffline, barangays]);

  // Try to submit any pending reports when we come back online
  useEffect(() => {
    if (!isOffline && pendingReports.length > 0 && user) {
      const submitPendingReports = async () => {
        const updatedPendingReports = [...pendingReports]

        for (let i = 0; i < updatedPendingReports.length; i++) {
          const report = updatedPendingReports[i]
          if (report.originRole && report.originRole !== "resident") {
            continue
          }
          const reportLocation = report.location || TALISAY_CENTER

          try {
            // Try to submit the report
            const result = await createIncident(
              user.id,
              report.incidentType,
              report.description,
              reportLocation[0],
              reportLocation[1],
              report.address,
              report.barangay,
              [], // Photos can't be stored offline
              report.priority,
              true,
              report.createdAtLocal || report.createdAt,
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
    console.log("getCurrentLocation called");
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location acquired:", position);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy; // in meters
        
        // Check accuracy (target: 5-10 meters)
        if (accuracy > 20) {
          setError(`Location accuracy is ${Math.round(accuracy)}m. Please wait for better GPS signal or move to an open area.`);
        } else {
          setError(null);
        }
        
        setLocation([lat, lng]);
        setLocationCaptured(true);
        setGettingLocation(false);
        console.log("Location set:", [lat, lng]);

        // Check if location is within Talisay City
        if (!isWithinTalisayCity(lat, lng)) {
          setError("Your current location is outside Talisay City. You can only report incidents within Talisay City.");
        }
      },
      (error) => {
        console.log("Geolocation error code:", error.code);
        setGettingLocation(false);
        // Default to Talisay City center if location access is denied
        setLocation(TALISAY_CENTER);
        setLocationCaptured(true);
        setError("Unable to get your precise location. Using default location. You can click 'Use My Location' to try again.");
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );
  };

  // Add this useEffect to automatically capture location when the component mounts
  useEffect(() => {
    console.log("Auto-detection useEffect called", { locationCaptured, location });
    // Only auto-capture location if it hasn't been captured yet
    if (!locationCaptured && !location) {
      console.log("Triggering auto-location capture");
      // Add a small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        getCurrentLocation();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []); // Empty dependency array to run only once

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

  const processPhotoFile = (file: File): Promise<{ processed: File; previewUrl: string } | null> => {
    if (!file.type.startsWith('image/')) {
      setError('Please capture a photo using your camera')
      return Promise.resolve(null)
    }
  
    if (file.size > 3 * 1024 * 1024) {
      setError('Photo size must be less than 3MB')
      return Promise.resolve(null)
    }
  
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file)
      const isMobile = /Mobi|Android/i.test(navigator.userAgent)
      
      // Use createImageBitmap for better performance (if available), especially on mobile
      const loadImage = async () => {
        try {
          // Try createImageBitmap first (faster, especially on mobile)
          if (typeof createImageBitmap !== 'undefined') {
            const imageBitmap = await createImageBitmap(file)
            return { imageBitmap, width: imageBitmap.width, height: imageBitmap.height }
          }
        } catch {
          // Fallback to Image if createImageBitmap fails
        }
        
        // Fallback to traditional Image loading
        return new Promise<{ imageBitmap?: ImageBitmap; img?: HTMLImageElement; width: number; height: number }>((imgResolve, imgReject) => {
          const img = new Image()
          img.onload = () => imgResolve({ img, width: img.width, height: img.height })
          img.onerror = imgReject
          img.src = objectUrl
        })
      }
  
      loadImage().then(({ imageBitmap, img, width, height }) => {
        // Set max dimension & JPEG quality based on device - more aggressive for mobile
        const MAX_DIM = isMobile ? 800 : 1280
        const JPEG_QUALITY = isMobile ? 0.5 : 0.7
  
        let targetW = width
        let targetH = height
        if (Math.max(width, height) > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height)
          targetW = Math.round(width * scale)
          targetH = Math.round(height * scale)
        }
  
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        // Optimize canvas context for performance - willReadFrequently: false for better speed
        const ctx = canvas.getContext('2d', { 
          willReadFrequently: false,
          alpha: true,
          desynchronized: true // Allow async rendering on mobile
        })
        
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          resolve(null)
          return
        }
  
        // Draw image (use imageBitmap if available, otherwise img)
        if (imageBitmap) {
          ctx.drawImage(imageBitmap, 0, 0, targetW, targetH)
          imageBitmap.close() // Free memory immediately
        } else if (img) {
          ctx.drawImage(img, 0, 0, targetW, targetH)
        }
  
        // Dynamically adjust watermark height based on canvas height
        const watermarkHeight = Math.max(50, Math.round(canvas.height * 0.1))
        
        // Optimize watermark rendering - batch operations
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(0, canvas.height - watermarkHeight, canvas.width, watermarkHeight)
  
        // Font size scales with watermark height
        const fontSize = Math.max(12, Math.round(watermarkHeight * 0.3))
        ctx.font = `bold ${fontSize}px Arial`
        ctx.fillStyle = '#FFFFFF'
  
        const date = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        const time = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
  
        const locationText = formData.barangay
          ? `${formData.barangay}, Talisay City`
          : location
          ? `Lat: ${location[0].toFixed(6)}, Lng: ${location[1].toFixed(6)}`
          : 'Talisay City'
  
        // Optimize shadow - use simpler shadow for mobile
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
  
        // Convert to blob - use requestIdleCallback on mobile for better responsiveness
        const convertToBlob = () => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const watermarkedFile = new File([blob], `incident_photo_${Date.now()}.jpg`, {
                  type: 'image/jpeg',
                })
                const previewUrl = URL.createObjectURL(watermarkedFile)
                resolve({ processed: watermarkedFile, previewUrl })
              } else {
                resolve(null)
              }
              URL.revokeObjectURL(objectUrl)
            },
            'image/jpeg',
            JPEG_QUALITY,
          )
        }
  
        // On mobile, use requestIdleCallback to avoid blocking UI
        if (isMobile && typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(convertToBlob, { timeout: 100 })
        } else {
          // Use setTimeout to yield to UI thread briefly
          setTimeout(convertToBlob, 0)
        }
      }).catch(() => {
        URL.revokeObjectURL(objectUrl)
        resolve(null)
      })
    })
  }
  
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const availableSlots = MAX_PHOTOS - photoFiles.length
    if (availableSlots <= 0) {
      setError(`You can upload up to ${MAX_PHOTOS} photos.`)
      e.target.value = ''
      return
    }

    const selectedFiles = Array.from(e.target.files).slice(0, availableSlots)
    
    // Process all photos in parallel for faster performance (especially on mobile)
    const processingPromises = selectedFiles.map(file => processPhotoFile(file))
    const processedResults = await Promise.all(processingPromises)
    
    const newFiles: File[] = []
    const newPreviews: string[] = []
    
    for (const processed of processedResults) {
      if (processed) {
        newFiles.push(processed.processed)
        newPreviews.push(processed.previewUrl)
      }
    }

    if (newFiles.length) {
      setPhotoFiles((prev) => [...prev, ...newFiles])
      setPhotoPreviews((prev) => [...prev, ...newPreviews])
      setError(null)
    }

    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, idx) => idx !== index))
    setPhotoPreviews((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed) {
        URL.revokeObjectURL(removed)
      }
      return next
    })
  }

  const clearPhotos = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current = []
    setPhotoFiles([])
    setPhotoPreviews([])
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
      setError("Please capture your location first by clicking 'Use My Location' or waiting for automatic detection");
      return false;
    }

    // Step 2: Photo is now optional, so we don't require it anymore

    // Step 3: Description required
    if (!formData.description || formData.description.trim().length < 10) {
      setError("Please provide a detailed description (at least 10 characters)");
      return false;
    }

    // Step 4: Barangay required
    if (!formData.barangay) {
      setError("Please select a barangay");
      return false;
    }

    // Step 5: Address required
    if (!formData.address || formData.address.trim().length < 5) {
      setError("Please provide a valid address (at least 5 characters)");
      return false;
    }

    // Clear any previous errors
    setError(null);
    setSubmitStage(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      const errorMsg = "You must be logged in to report an incident";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: errorMsg
      });
      return;
    }

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      });
      return;
    }

    // Additional location validation
    if (!location || !locationCaptured) {
      const errorMsg = "Location must be captured before submitting the report";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Location Required",
        description: errorMsg
      });
      return;
    }

    // Check online status right before submission
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    setLoading(true);
    setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…");

    // If offline, store the report locally
    if (!navigator.onLine || isOffline) {
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
          originRole: "resident",
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
        clearPhotos()

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
        photoCount: photoFiles.length,
        hasVoiceBlob: !!voiceBlob,
        voiceBlobSize: voiceBlob?.size || 0,
        voiceBlobType: voiceBlob?.type || 'none'
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

      const submissionTimestamp = new Date().toISOString()
      const result = await createIncident(
        user.id,
        formData.incidentType,
        formData.description,
        reportLocation[0],
        reportLocation[1],
        formData.address,
        formData.barangay,
        photoFiles,
        Number.parseInt(formData.priority),
        false,
        submissionTimestamp,
        voiceBlob || undefined,
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
      setVoiceBlob(null)
      clearPhotos()

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
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isEmergency
              ? "Life-threatening situation – focus on the essentials and submit as soon as you can."
              : "Please provide as much detail as possible to help emergency responders."}
          </p>
        </div>

        {isOffline && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 dark:border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  You are currently offline. Your report will be saved locally and submitted when you're back online.
                </p>
              </div>
            </div>
          </div>
        )}

        {pendingReports.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Step 1: Location Capture {locationCaptured && "✅"}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your location will be automatically captured via GPS (target accuracy: 5-10 meters). 
              If it doesn't capture automatically, click "Use My Location" below.
            </p>
            
            <div className="mb-6">
              <LocationTracker
                onLocationUpdate={(location) => {
                  console.log("LocationTracker onLocationUpdate called:", location);
                  setLocation([location.latitude, location.longitude]);
                  setLocationCaptured(true);
                  setError(null);
                }}
                showSettings={true}
                className="mb-4"
              />
              {!locationCaptured && (
                <div className="mt-2 text-sm text-blue-600 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Detecting your location automatically...
                </div>
              )}
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
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
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
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
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

          {/* STEP 2: Optional Photo Upload */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Step 2: Photo Evidence (Optional) {photoFiles.length > 0 && "✅"}
                </h2>
                <p className="text-sm text-gray-600">
                  Add up to {MAX_PHOTOS} photos to help responders understand the situation faster.
                </p>
              </div>
              <span className="text-sm text-gray-500">
                {photoFiles.length}/{MAX_PHOTOS} added
              </span>
            </div>

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {photoPreviews.map((preview, index) => (
                  <div key={preview} className="relative rounded-lg overflow-hidden border bg-gray-50">
                    <img
                      src={preview}
                      alt={`Incident photo ${index + 1}`}
                      className="h-40 w-full object-cover cursor-pointer"
                      onClick={() => setSelectedPhotoIndex(index)}
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photoFiles.length < MAX_PHOTOS && (
              <div className="flex items-center justify-center">
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer bg-background py-6 px-4 border-2 border-dashed border-gray-300 rounded-lg text-center hover:bg-accent w-full transition-colors"
                >
                  <div className="space-y-2">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                      <Camera className="h-12 w-12 mx-auto" />
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-red-600 hover:text-red-500">
                        {photoFiles.length === 0 ? "Add a photo" : "Add another photo"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      JPG only · up to 3MB per photo · best to capture clear evidence
                    </p>
                  </div>
                  <input
                    id="photo-upload"
                    name="photo"
                    type="file"
                    accept="image/jpeg"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={handlePhotoChange}
                    disabled={loading}
                  />
                </label>
              </div>
            )}
          </div>

          {/* STEP 3: Incident Classification */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Step 3: Incident Classification</h2>
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">Current incident type</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{formData.incidentType}</p>
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Step 4: Your Information (Auto-filled)</h2>
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Step 5: What Happened?</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description * (Short, clear description)
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  required
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  placeholder="Please describe what happened..."
                  value={formData.description}
                  onChange={handleChange}
                  disabled={loading}
                ></textarea>
              </div>
              
              {/* Optional Voice Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Message (Optional)
                </label>
                <VoiceRecorder
                  onRecordingComplete={(blob) => {
                    setVoiceBlob(blob)
                  }}
                  onRecordingDelete={() => {
                    setVoiceBlob(null)
                  }}
                  disabled={loading}
                />
              </div>
            </div>
          </div>


          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push("/resident/dashboard")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:bg-accent dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
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

        {/* Photo Viewer Modal */}
        {selectedPhotoIndex !== null && photoPreviews[selectedPhotoIndex] && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
            onClick={() => setSelectedPhotoIndex(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] p-4">
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex(null)}
                className="absolute top-4 right-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white dark:focus-visible:ring-gray-800 z-10"
                aria-label="Close photo viewer"
              >
                <X className="h-6 w-6" />
              </button>
              <img
                src={photoPreviews[selectedPhotoIndex]}
                alt={`Incident photo ${selectedPhotoIndex + 1}`}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              {photoPreviews.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex(
                        selectedPhotoIndex > 0
                          ? selectedPhotoIndex - 1
                          : photoPreviews.length - 1
                      );
                    }}
                    className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white dark:focus-visible:ring-gray-800"
                  >
                    Previous
                  </button>
                  <span className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md">
                    {selectedPhotoIndex + 1} / {photoPreviews.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex(
                        selectedPhotoIndex < photoPreviews.length - 1
                          ? selectedPhotoIndex + 1
                          : 0
                      );
                    }}
                    className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white dark:focus-visible:ring-gray-800"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ResidentLayout>
  )
}
