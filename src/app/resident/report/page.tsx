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
        // AGGRESSIVE MOBILE COMPRESSION: 640px max, 0.4 quality
        // This reduces 3MB photos to ~300KB (10x smaller!)
        const MAX_DIM = isMobile ? 640 : 1280  // Reduced from 800px to 640px
        const JPEG_QUALITY = isMobile ? 0.4 : 0.7  // Reduced from 0.5 to 0.4

        const originalSizeKB = (file.size / 1024).toFixed(1)
        console.log(`📸 [PHOTO] Original: ${width}x${height}px, ${originalSizeKB}KB`)

        let targetW = width
        let targetH = height
        if (Math.max(width, height) > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height)
          targetW = Math.round(width * scale)
          targetH = Math.round(height * scale)
          console.log(`📸 [PHOTO] Resizing to: ${targetW}x${targetH}px (scale: ${(scale * 100).toFixed(0)}%)`)
        }

        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        // Optimize canvas context for performance
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

        // OPTIMIZED WATERMARK: Readable but efficient
        const watermarkHeight = isMobile ? 50 : 60  // Adequate height for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'  // Slightly darker for better contrast
        ctx.fillRect(0, canvas.height - watermarkHeight, canvas.width, watermarkHeight)

        // Readable font size with good contrast
        const fontSize = isMobile ? 13 : 15
        ctx.font = `bold ${fontSize}px Arial`  // Bold for better readability
        ctx.fillStyle = '#FFFFFF'
        ctx.textBaseline = 'middle'

        const date = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const time = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })

        const locationText = formData.barangay || 'Talisay City'

        // Two-line watermark for better readability
        const padding = 10
        const lineHeight = fontSize + 4
        const firstLineY = canvas.height - watermarkHeight + (watermarkHeight / 2) - (lineHeight / 2)
        const secondLineY = firstLineY + lineHeight

        // Location on first line
        ctx.fillText(`📍 ${locationText}`, padding, firstLineY)
        
        // Date and time on second line
        ctx.fillText(`📅 ${date} ${time}`, padding, secondLineY)

        // Convert to blob with aggressive compression
        const convertToBlob = () => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedSizeKB = (blob.size / 1024).toFixed(1)
                const compressionRatio = ((1 - blob.size / file.size) * 100).toFixed(0)
                console.log(`📸 [PHOTO] Compressed: ${compressedSizeKB}KB (${compressionRatio}% smaller)`)
                
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
    // Step 1: Photo is REQUIRED (at least 1 photo)
    if (photoFiles.length === 0) {
      setError("Please capture at least one photo of the incident");
      return false;
    }

    // Step 2: Voice message is REQUIRED
    if (!voiceBlob) {
      setError("Please record a voice message describing the incident");
      return false;
    }

    // Step 3: Location must be captured
    if (!location || !locationCaptured) {
      setError("Please capture your location by clicking 'Use My Location' or clicking on the map");
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

        currentUser = {
          id: session.user.id,
          email: session.user.email || "",
          role: userData.role,
          firstName: userData.first_name,
          lastName: userData.last_name,
          phone_number: userData.phone_number || undefined,
          address: userData.address || undefined,
          barangay: userData.barangay || undefined,
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error("🔴 [REPORT SUBMIT] Session error:", sessionError);
        throw new Error("Your session has expired. Please log in again.");
      }

      console.log("🔴 [REPORT SUBMIT] Session obtained:", { userId: session.user.id.substring(0, 8) + '...' });

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
          accessToken: session.access_token || undefined,
          onStageChange: (stage) => {
            setTimeout(() => {
              setSubmitStage(stageMessages[stage] || null)
            }, 50)
          },
        },
      )

      // 45-second overall timeout
      const timeoutPromise = new Promise<{ success: false; message: string }>((resolve) => 
        setTimeout(() => resolve({ 
          success: false, 
          message: 'Submission is taking too long. This may be due to slow network. Please try again or submit without photos.' 
        }), 45000)
      )

      console.log("🔴 [REPORT SUBMIT] Waiting for createIncident (45s timeout)...");
      const result = await Promise.race([createIncidentPromise, timeoutPromise])
      console.log("🔴 [REPORT SUBMIT] Result received:", {
        success: result?.success,
        hasData: !!(result as any)?.data,
        message: (result as any)?.message
      });

      if (!result.success) {
        console.error("🔴 [REPORT SUBMIT] createIncident failed:", result);
        throw new Error((result as any).message || "Failed to create incident report")
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

          {/* STEP 1: Photo Upload (REQUIRED) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Step 1: Photo Evidence * {photoFiles.length > 0 && "✅"}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Capture at least one photo of the incident. This is required to help responders understand the situation.
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
                        {photoFiles.length === 0 ? "Capture a photo (Required)" : "Add another photo"}
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

          {/* STEP 2: Voice Message (REQUIRED) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Step 2: Voice Message * {voiceBlob && "✅"}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Record a voice message describing the incident. This is required to provide context to responders.
            </p>
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

          {/* STEP 3: Location Capture (REQUIRED) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Step 3: Location Capture * {locationCaptured && "✅"}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your location will be automatically captured via GPS (target accuracy: 5-10 meters). 
              If GPS accuracy is poor or it doesn't capture automatically, you can:
              <br />• Click "Use My Location" button below, or
              <br />• Click directly on the map to manually select your location
            </p>
            
            <div className="mb-6">
              <LocationTracker
                onLocationUpdate={(location) => {
                  console.log("LocationTracker onLocationUpdate called:", location);
                  
                  // CRITICAL: Reject very poor accuracy locations (IP-based geolocation)
                  // Accuracy > 1000m (1km) is likely IP-based, not GPS
                  if (location.accuracy > 1000) {
                    const accuracyKm = (location.accuracy / 1000).toFixed(1);
                    console.warn(`[REPORT] Rejecting poor accuracy location: ${accuracyKm}km (likely IP-based)`);
                    setError(`GPS accuracy is very poor (${accuracyKm}km). Please click on the map to manually select your location, or move to an open area for better GPS signal.`);
                    // Don't set location if accuracy is too poor
                    return;
                  }
                  
                  // Only update if we don't already have a manually selected location
                  // This prevents LocationTracker from overriding user's map click
                  if (!locationCaptured) {
                    // Warn if accuracy is moderate (20-1000m)
                    if (location.accuracy > 20) {
                      setError(`Location accuracy is ${Math.round(location.accuracy)}m. For better accuracy, click on the map to manually select your location.`);
                    } else {
                      setError(null);
                    }
                    
                    setLocation([location.latitude, location.longitude]);
                    setLocationCaptured(true);
                    console.log(`[REPORT] Location captured from GPS:`, { 
                      lat: location.latitude, 
                      lng: location.longitude, 
                      accuracy: `${Math.round(location.accuracy)}m` 
                    });
                  } else {
                    console.log(`[REPORT] Location already captured manually, ignoring GPS update`);
                  }
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
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 uppercase"
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
                showVolunteerLocations={!isSubmitting} // Disable during submission to prevent interference
                offlineMode={isOffline}
              />
              {location && (
                <p className="mt-1 text-sm text-gray-600">
                  Selected coordinates: {location[0].toFixed(6)}, {location[1].toFixed(6)}
                </p>
              )}
            </div>
          </div>

          {/* STEP 4: Incident Classification */}
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

          {/* STEP 5: Auto-populated fields (user info, timestamp) - shown as read-only */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Step 5: Your Information (Auto-filled)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Your Name</label>
                <input
                  type="text"
                  value={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : (authLoading ? 'Loading...' : 'Not available')}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm"
                  readOnly
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                <input
                  type="text"
                  value={user?.phone_number || (authLoading ? 'Loading...' : 'Not provided')}
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

          {/* STEP 6: Description (OPTIONAL) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Step 6: Additional Description (Optional)</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You can provide additional written details about the incident. This is optional since you've already provided a voice message.
            </p>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 uppercase"
                placeholder="Add any additional details about the incident (optional)..."
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:bg-accent dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              disabled={loading}
              aria-label="Cancel and return to dashboard"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || authLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || authLoading ? (
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
