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
import { isWithinTalisayCity, TALISAY_CENTER } from "@/lib/geo-utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { VoiceRecorder } from "@/components/voice-recorder"

// Mobile: Limit to 1 photo for instant submission. Desktop: Allow 3 photos
const MAX_PHOTOS = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 1 : 3

export default function ReportIncidentPage() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  // PERFORMANCE FIX: Add timeout and make it non-blocking for mobile
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!location || isOffline) return;
      try {
        setGeoMessage('Detecting address from map pin…');
        const [lat, lng] = location;
        const url = `/api/geocode/reverse?lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
        
        // PERFORMANCE FIX: Add timeout to prevent hanging on slow mobile networks
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        let res: Response;
        try {
          res = await fetch(url, { 
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            // Timeout - don't fail, just show message
            if (!cancelled) {
              setGeoMessage('Address detection timed out; you can type it manually');
              setAutoGeoLock({ address: false, barangay: false });
            }
            return;
          }
          throw fetchError;
        }
        
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
      // Convert to uppercase
      sanitizedValue = sanitizedValue.toUpperCase()
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
  
    // Add watermark to photo (same as volunteer reporting)
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const isMobile = /Mobi|Android/i.test(navigator.userAgent)
      
      // Use createImageBitmap for better performance (if available)
      const loadImage = async () => {
        try {
          if (typeof createImageBitmap !== 'undefined') {
            const imageBitmap = await createImageBitmap(file)
            return { imageBitmap, width: imageBitmap.width, height: imageBitmap.height }
          }
        } catch {
          // Fallback to Image
        }
        
        return new Promise<{ imageBitmap?: ImageBitmap; img?: HTMLImageElement; width: number; height: number }>((imgResolve, imgReject) => {
          const img = new Image()
          img.onload = () => imgResolve({ img, width: img.width, height: img.height })
          img.onerror = imgReject
          img.src = objectUrl
        })
      }
      
      loadImage().then(({ imageBitmap, img, width, height }) => {
        // Downscale large images - more aggressive for mobile
        const MAX_DIM = isMobile ? 800 : 1280
        const JPEG_QUALITY = isMobile ? 0.5 : 0.7
        
        let targetW = width
        let targetH = height
        if (Math.max(width, height) > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height)
          targetW = Math.round(width * scale)
          targetH = Math.round(height * scale)
        }

        // Create canvas with optimized context
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d', { 
          willReadFrequently: false,
          alpha: true,
          desynchronized: true
        })
        
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Failed to create canvas context'))
          return
        }
        
        // Draw the (possibly downscaled) image
        if (imageBitmap) {
          ctx.drawImage(imageBitmap, 0, 0, targetW, targetH)
          imageBitmap.close()
        } else if (img) {
          ctx.drawImage(img, 0, 0, targetW, targetH)
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
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], 'incident_photo.jpg', { type: 'image/jpeg' })
              const previewUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
              console.log(`📸 [PHOTO] Watermarked: ${(blob.size / 1024).toFixed(1)}KB (server will further compress with Sharp)`)
              URL.revokeObjectURL(objectUrl)
              resolve({ processed: watermarkedFile, previewUrl })
            } else {
              URL.revokeObjectURL(objectUrl)
              reject(new Error('Failed to create blob from canvas'))
            }
          }, 'image/jpeg', JPEG_QUALITY)
        }
        
        // Use requestIdleCallback on mobile for better responsiveness
        if (isMobile && typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(convertToBlob, { timeout: 100 })
        } else {
          setTimeout(convertToBlob, 0)
        }
      }).catch((error) => {
        URL.revokeObjectURL(objectUrl)
        reject(error)
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
    console.log('[REPORT] Map clicked:', { lat, lng })
    // Only set location if within Talisay City
    if (isWithinTalisayCity(lat, lng)) {
      setLocation([lat, lng])
      setLocationCaptured(true) // CRITICAL: Mark location as captured when user clicks map
      setError(null)
      console.log('[REPORT] Location set from map click:', [lat, lng])
    } else {
      setError("Selected location is outside Talisay City. Please select a location within Talisay City.")
    }
  }

  const validateForm = () => {
    // Location must be captured (REQUIRED)
    if (!location || !locationCaptured) {
      setError("Please capture your location");
      return false;
    }

    // Barangay required
    if (!formData.barangay) {
      setError("Please select a barangay");
      return false;
    }

    // Address required
    if (!formData.address || formData.address.trim().length < 5) {
      setError("Please provide a valid address");
      return false;
    }

    // Photo and voice are OPTIONAL - no validation needed
    // Description is OPTIONAL - no validation needed

    // Clear any previous errors
    setError(null);
    setSubmitStage(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    console.log("🔴 [REPORT SUBMIT] ========== STARTING SUBMISSION ==========");
    console.log("🔴 [REPORT SUBMIT] Timestamp:", new Date().toISOString());

    // Wait for auth to load
    if (authLoading) {
      console.log("🔴 [REPORT SUBMIT] Auth still loading, waiting...");
      const errorMsg = "Please wait, verifying your session...";
      setError(errorMsg);
      toast({
        variant: "default",
        title: "Please wait",
        description: errorMsg
      });
      setIsSubmitting(false);
      return;
    }

    // Validate form first
    if (!validateForm()) {
      console.log("🔴 [REPORT SUBMIT] Form validation failed");
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: error
      });
      setIsSubmitting(false);
      return;
    }

    // Location validation
    if (!location || !locationCaptured) {
      console.log("🔴 [REPORT SUBMIT] Location not captured");
      const errorMsg = "Location must be captured before submitting the report";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Location Required",
        description: errorMsg
      });
      setIsSubmitting(false);
      return;
    }

    // Check user
    let currentUser = user;
    if (!currentUser) {
      console.log("🔴 [REPORT SUBMIT] User not found in hook, fetching session...");
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("🔴 [REPORT SUBMIT] Session fetch result:", { hasSession: !!session, error: sessionError?.message });
        
        if (sessionError || !session) {
          const errorMsg = "You must be logged in to report an incident. Please refresh the page and try again.";
          setError(errorMsg);
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: errorMsg
          });
          setIsSubmitting(false);
          return;
        }

        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, role, first_name, last_name, phone_number, address, barangay")
          .eq("id", session.user.id)
          .maybeSingle();

        console.log("🔴 [REPORT SUBMIT] User data fetch result:", { hasData: !!userData, error: userError?.message });

        if (userError || !userData) {
          const errorMsg = "Unable to verify your account. Please refresh the page and try again.";
          setError(errorMsg);
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: errorMsg
          });
          setIsSubmitting(false);
          return;
        }

        // Type assertion - we've already checked userData is not null
        const validUserData = userData as {
          id: string
          role: string
          first_name: string
          last_name: string
          phone_number: string | null
          address: string | null
          barangay: string | null
        }

        currentUser = {
          id: session.user.id,
          email: session.user.email || "",
          role: (validUserData.role as "admin" | "volunteer" | "resident" | "barangay") || null,
          firstName: validUserData.first_name,
          lastName: validUserData.last_name,
          phone_number: validUserData.phone_number || undefined,
          address: validUserData.address || undefined,
          barangay: validUserData.barangay || undefined,
        };
      } catch (authErr: any) {
        console.error("🔴 [REPORT SUBMIT] Auth check error:", authErr);
        const errorMsg = "Authentication error. Please refresh the page and try again.";
        setError(errorMsg);
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: errorMsg
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (!currentUser) {
      console.log("🔴 [REPORT SUBMIT] No user available");
      const errorMsg = "You must be logged in to report an incident";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: errorMsg
      });
      setIsSubmitting(false);
      return;
    }

    // Check online status
    if (!navigator.onLine) {
      console.log("🔴 [REPORT SUBMIT] Offline detected, saving locally");
      setIsOffline(true);
    }

    setLoading(true);
    setSubmitStage(isOffline ? "Saving report for offline delivery…" : "Preparing your report…");
    
    console.log("🔴 [REPORT SUBMIT] Submission details:", {
      userId: currentUser.id.substring(0, 8) + '...',
      incidentType: formData.incidentType,
      hasPhotos: photoFiles.length > 0,
      photoCount: photoFiles.length,
      hasVoice: !!voiceBlob,
      isOffline: isOffline || !navigator.onLine,
      networkType: (navigator as any).connection?.effectiveType || 'unknown',
      location: location,
      address: formData.address,
      barangay: formData.barangay
    });

    // Handle offline submission
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

        console.log("🔴 [REPORT SUBMIT] Report saved offline");

        toast({
          title: "Report Saved Offline",
          description: "Your report has been saved and will be submitted when you're back online.",
          duration: 5000
        })

        setFormData({
          incidentType: "",
          description: "",
          address: "",
          barangay: "",
          priority: "3",
        })
        setLocation(null)
        clearPhotos()

        router.push("/resident/dashboard?offline=true")
      } catch (err: any) {
        console.error("🔴 [REPORT SUBMIT] Offline save error:", err);
        setError("Failed to save report offline. Please try again.")
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save report offline. Please try again."
        })
      } finally {
        setLoading(false)
        setSubmitStage(null)
        setIsSubmitting(false)
      }
      return
    }

    // Online submission
    try {
      const reportLocation = location || TALISAY_CENTER

      console.log("🔴 [REPORT SUBMIT] Getting session for submission...");
      
      // OPTIMIZATION: Since we already have currentUser from useAuth hook, we can skip session check
      // and just use the user ID directly. The createIncident function will handle auth internally.
      let session: any = null
      let sessionAccessToken: string | undefined = undefined
      
      // Quick session check with short timeout (3 seconds) - just to get access token
      // If it fails, we proceed anyway since we have currentUser
      try {
        const { getSessionWithTimeout } = await import('@/lib/supabase-auth-timeout')
        const sessionResult = await getSessionWithTimeout(3000) // Short timeout - just for token
        if (sessionResult.data?.session && !sessionResult.error) {
          session = sessionResult.data.session
          sessionAccessToken = sessionResult.data.session.access_token
          console.log("🔴 [REPORT SUBMIT] ✅ Session obtained (with token):", { userId: session.user.id.substring(0, 8) + '...' });
        }
      } catch (sessionErr: any) {
        console.warn("🔴 [REPORT SUBMIT] Session check timeout (non-critical, proceeding with currentUser):", sessionErr.message);
        // Continue anyway - we have currentUser from hook
      }
      
      // If session check failed, create minimal session from currentUser (we already validated it exists)
      if (!session && currentUser && currentUser.id) {
        console.log("🔴 [REPORT SUBMIT] Using currentUser directly (session check skipped):", currentUser.id.substring(0, 8) + '...');
        session = { user: { id: currentUser.id, email: currentUser.email || '' } }
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
            // PERMANENT FIX: Cache token for background uploads
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('supabase.auth.token', JSON.stringify({ 
                  access_token: sessionAccessToken,
                  cached_at: Date.now()
                }))
              } catch (e) {
                // Ignore localStorage errors
              }
            }
            console.log("🔴 [REPORT SUBMIT] ✅ Got access token via direct Supabase call (cached)");
          } else {
            console.warn("🔴 [REPORT SUBMIT] Direct Supabase call returned no token:", result?.error?.message || 'No session');
          }
        } catch (directErr: any) {
          if (directErr?.message?.includes('timeout')) {
            console.warn("🔴 [REPORT SUBMIT] Token retrieval timed out (non-critical, continuing without token)");
          } else {
            console.warn("🔴 [REPORT SUBMIT] Direct Supabase call failed:", directErr?.message || 'Unknown error');
          }
          // Continue anyway - we have currentUser, background upload will try to get token
        }
      }
      
      if (!session || !session.user) {
        throw new Error("Unable to verify your session. Please refresh the page and try again.");
      }

      console.log("🔴 [REPORT SUBMIT] ✅ Ready for submission:", { 
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
      console.log("🔴 [REPORT SUBMIT] Calling createIncident:", {
        reporterId: currentUser.id.substring(0, 8) + '...',
        incidentType: formData.incidentType,
        location: reportLocation,
        timestamp: submissionTimestamp
      });
      
      const createIncidentPromise = createIncident(
        currentUser.id,
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
          accessToken: sessionAccessToken || session.access_token || undefined,
          onStageChange: (stage) => {
            setTimeout(() => {
              setSubmitStage(stageMessages[stage] || null)
            }, 50)
          },
        },
      )
      
      // Log token availability for debugging
      console.log("🔴 [REPORT SUBMIT] Access token available:", !!(sessionAccessToken || session.access_token))

      // 60-second overall timeout (increased for slow mobile networks)
      const timeoutPromise = new Promise<{ success: false; message: string }>((resolve) => 
        setTimeout(() => resolve({ 
          success: false, 
          message: 'Submission is taking longer than expected. Your report may still be processing. Please wait a moment and check your dashboard.' 
        }), 60000) // 60 seconds
      )

      console.log("🔴 [REPORT SUBMIT] Waiting for createIncident (60s timeout)...");
      console.log("🔴 [REPORT SUBMIT] Photo files being passed:", photoFiles.length);
      
      let result: any
      try {
        result = await Promise.race([createIncidentPromise, timeoutPromise])
        console.log("🔴 [REPORT SUBMIT] Result received:", {
          success: result?.success,
          hasData: !!(result as any)?.data,
          message: (result as any)?.message
        });
      } catch (raceError: any) {
        console.error("🔴 [REPORT SUBMIT] Promise.race error:", {
          message: raceError?.message,
          name: raceError?.name,
          stack: raceError?.stack?.substring(0, 500)
        });
        throw raceError
      }

      if (!result || !result.success) {
        console.error("🔴 [REPORT SUBMIT] createIncident failed:", result);
        const errorMsg = (result as any)?.message || "Failed to create incident report"
        console.error("🔴 [REPORT SUBMIT] Error message:", errorMsg);
        throw new Error(errorMsg)
      }

      console.log("🔴 [REPORT SUBMIT] ✅ Submission successful:", (result as any).data)
      console.log("🔴 [REPORT SUBMIT] ========== SUBMISSION COMPLETE ==========");

      toast({
        title: "Success",
        description: "Your incident report has been submitted successfully. Emergency responders will be notified.",
        duration: 5000
      })

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

      router.push("/resident/dashboard?success=Incident reported successfully")
    } catch (err: any) {
      console.error("🔴 [REPORT SUBMIT] ❌ Error:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        networkType: (navigator as any).connection?.effectiveType || 'unknown',
        isOnline: navigator.onLine
      })
      
      let errorMessage = err.message || "Failed to submit incident report"
      if (errorMessage.includes("row-level security policy")) {
        errorMessage = "Authentication error. Please try logging out and back in."
      } else if (errorMessage.includes("storage")) {
        errorMessage = "Failed to upload photo. Please try again with a different photo."
      } else if (errorMessage.includes("timeout") || errorMessage.includes("Network is slow")) {
        // Don't change the message - it's already helpful
        // But add a note that the report might still be processing
        errorMessage = errorMessage + " If the problem persists, your report may still be processing. Please check your dashboard."
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
    <ResidentLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isEmergency ? "🚨 Emergency Report" : "📋 Report Incident"}
          </h1>
        </div>

        {isOffline && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 dark:border-yellow-400 rounded p-2">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Offline - Report will be saved and submitted when online
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-500 rounded p-2">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Compact Form Layout */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
            {/* Location Section - Most Important */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Location * {locationCaptured && "✅"}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 uppercase"
                    placeholder="Street address"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={loading || (autoGeoLock.address && !isOffline)}
                    readOnly={autoGeoLock.address && !isOffline}
                  />
                </div>
                <div>
                  <select
                    id="barangay"
                    name="barangay"
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
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
                </div>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Map Location</span>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? (
                      <LoadingSpinner size="sm" color="text-red-600" />
                    ) : (
                      <>
                        <MapPin className="mr-1 h-3 w-3" />
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
                  height="200px"
                  onMapClick={handleMapClick}
                  userLocation={true}
                  showBoundary={true}
                  showGeofence={false}
                  showVolunteerLocations={false}
                  offlineMode={isOffline}
                />
              </div>
            </div>

            {/* Photo Section - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Photo (Optional) {photoFiles.length > 0 && `(${photoFiles.length}/${MAX_PHOTOS})`}
              </label>

              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {photoPreviews.map((preview, index) => (
                    <div key={preview} className="relative rounded overflow-hidden border bg-gray-50">
                      <img
                        src={preview}
                        alt={`Photo ${index + 1}`}
                        className="h-20 w-full object-cover cursor-pointer"
                        onClick={() => setSelectedPhotoIndex(index)}
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-0.5 rounded-full hover:bg-red-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photoFiles.length < MAX_PHOTOS && (
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer flex items-center justify-center py-2 px-3 border border-dashed border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Camera className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {photoFiles.length === 0 ? "Add Photo" : "Add Another"}
                  </span>
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
              )}
            </div>

            {/* Voice Section - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Voice Message (Optional) {voiceBlob && "✅"}
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

            {/* Description - Optional */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 uppercase"
                placeholder="Additional details..."
                value={formData.description}
                onChange={handleChange}
                disabled={loading}
              ></textarea>
            </div>
          </div>


          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push("/resident/dashboard")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || authLoading}
              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || authLoading ? (
                <LoadingSpinner size="sm" color="text-white" />
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </button>
          </div>
          {loading && submitStage && (
            <p className="text-right text-xs text-gray-500 mt-1">{submitStage}</p>
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
