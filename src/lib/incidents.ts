//src/lib/incidents.ts

import { supabase } from "./supabase"
import { Database } from "@/types/supabase"
import { fetchWithTimeout } from "./fetch-with-timeout"
import { getUserWithTimeout, getSessionWithTimeout } from "./supabase-auth-timeout"

// Use hyphen instead of underscore for the bucket name
const BUCKET_NAME = "incident-photos"

// Cache bucket existence to avoid costly create calls every submission
let __bucketEnsured = false
const ensureBucketExists = async () => {
  if (__bucketEnsured) return
  try {
    const { data: list, error: listError } = await supabase.storage.listBuckets()
    if (!listError) {
      const exists = (list || []).some(b => b.name === BUCKET_NAME)
      if (exists) {
        __bucketEnsured = true
        return
      }
    }
    const { error: createBucketError } = await supabase
      .storage
      .createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 3145728, // 3MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg']
      })
    if (!createBucketError) {
      __bucketEnsured = true
    } else {
      // Ignore if already exists or other non-fatal errors
      __bucketEnsured = true
      console.debug('ensureBucketExists non-fatal:', createBucketError)
    }
  } catch (e) {
    // Non-fatal; continue and let upload fail loudly if truly missing
    __bucketEnsured = true
    console.debug('ensureBucketExists caught:', e)
  }
}

type IncidentRow = Database['public']['Tables']['incidents']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

export interface Incident extends IncidentRow {
  reporter?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone_number: string | null
    barangay: string | null
    role: string
  } | null
  assignee?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone_number: string | null
    barangay: string | null
  } | null
  _offline?: boolean
  photo_urls?: string[] | null // Add this property to match the expected usage
}

// Get all incidents with offline markers
export const getAllIncidents = async () => {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          role
        ),
        assignee:users!incidents_assigned_to_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Annotate with offline markers using centralized query
    const base = (data as unknown as Incident[]) || []
    try {
      const ids = base.map((i) => i.id).filter(Boolean)
      let offlineSet = new Set<string>()
      if (ids.length > 0) {
        const { data: updates } = await supabase
          .from('incident_updates')
          .select('incident_id, notes')
          .in('incident_id', ids)
          .ilike('notes', 'Submitted while offline%')
        if (Array.isArray(updates)) {
          updates.forEach((u: any) => offlineSet.add(u.incident_id))
        }
      }
      const annotated = base.map((i) => ({ ...i, _offline: offlineSet.has(i.id) }))
      return { success: true, data: annotated }
    } catch {
      // Fallback: return without offline markers if query fails
      return { success: true, data: base }
    }
  } catch (error: any) {
    console.error('Error fetching incidents:', error)
    return { success: false, message: error.message }
  }
}

// Get incident by ID
export const getIncidentById = async (incidentId: string) => {
  try {
    // Validate input
    if (!incidentId) {
      console.error("getIncidentById called with empty ID");
      return { success: false, message: "Incident ID is required" }
    }

    // Debug: Log the request
    console.log("Fetching incident details for ID:", incidentId, typeof incidentId);

    // Handle potential non-string IDs (should never happen but just in case)
    const idToUse = String(incidentId).trim();

    // Verify we have a valid format UUID
    if (!idToUse.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.error("Invalid incident ID format:", idToUse);
      return { success: false, message: "Invalid incident ID format" };
    }

    // First, get the incident with reporter details
    const { data: incidentData, error: reporterError } = await supabase
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          barangay,
          role
        ),
        assignee:users!incidents_assigned_to_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          barangay
        )
      `)
      .eq('id', idToUse)
      .single()

    if (reporterError) {
      console.error("Error fetching incident with reporter:", reporterError);

      if (reporterError.code === 'PGRST116') {
        return {
          success: false,
          message: "Incident not found"
        };
      }

      return {
        success: false,
        message: `Database error: ${reporterError.message || "Unknown error"}`,
        error: reporterError
      };
    }

    if (!incidentData) {
      console.error("No incident data returned for ID:", idToUse);
      return {
        success: false,
        message: "Incident not found"
      }
    }

    // Cast to any to avoid typing issues temporarily
    const incidentWithReporter: any = incidentData;

    // Debug log
    console.log("Fetched incident data:", {
      id: incidentWithReporter.id,
      type: incidentWithReporter.incident_type,
      status: incidentWithReporter.status,
      hasReporter: !!incidentWithReporter.reporter,
      reporterData: incidentWithReporter.reporter,
      reporterName: incidentWithReporter.reporter ? `${incidentWithReporter.reporter.first_name} ${incidentWithReporter.reporter.last_name}` : null,
      hasAssignee: !!incidentWithReporter.assignee,
      hasPhotoUrl: !!incidentWithReporter.photo_url
    });

    const signPhotoPath = async (path: string) => {
      const cleanPath = path?.trim?.()
      if (!cleanPath) return null
      try {
        console.log("Generating signed URL for photo:", cleanPath);
        const { data: signedUrlData, error: signedUrlError } = await supabase
          .storage
          .from(BUCKET_NAME)
          .createSignedUrl(cleanPath, 3600)

        if (!signedUrlError && signedUrlData) {
          console.log("Successfully generated signed URL");
          return signedUrlData.signedUrl
        }
        console.error("Error generating signed URL:", signedUrlError);
        return null
      } catch (urlError) {
        console.error("Error processing photo URL:", urlError);
        return null
      }
    }

    if (incidentWithReporter.photo_url) {
      const signedPrimary = await signPhotoPath(incidentWithReporter.photo_url)
      if (signedPrimary) {
        incidentWithReporter.photo_url = signedPrimary
      }
    }

    // Fix the photo_urls access by checking if it exists first
    if ('photo_urls' in incidentWithReporter && Array.isArray(incidentWithReporter.photo_urls) && incidentWithReporter.photo_urls.length > 0) {
      const signedGallery = await Promise.all(
        (incidentWithReporter.photo_urls as string[]).map((rawPath: string) => signPhotoPath(rawPath))
      )
      incidentWithReporter.photo_urls = signedGallery.filter((url: any): url is string => url !== null)
    }

    // Return the incident data
    console.log("Successfully returning incident data");
    return {
      success: true,
      data: incidentWithReporter
    }
  } catch (error: any) {
    console.error('Error in getIncidentById:', {
      error,
      message: error.message,
      incidentId
    })
    return {
      success: false,
      message: error.message || "Failed to fetch incident details",
      error: error
    }
  }
}

type CreateIncidentStage = "verify-session" | "upload-photo" | "create-record" | "done"

type CreateIncidentOptions = {
  sessionUserId?: string
  accessToken?: string
  onStageChange?: (stage: CreateIncidentStage) => void
}

export type { CreateIncidentStage }

// Create new incident
export const createIncident = async (
  reporterId: string,
  incidentType: string,
  description: string,
  locationLat: number,
  locationLng: number,
  address: string,
  barangay: string,
  photoFiles: File[] = [],
  priority = 3,
  isOffline = false,
  createdAtLocal?: string,
  voiceBlob?: Blob | null,
  options?: CreateIncidentOptions,
) => {
  try {
    console.time('createIncident.total')

    const notifyStage = (stage: CreateIncidentStage) => {
      if (options?.onStageChange) {
        options.onStageChange(stage)
      }
    }

    notifyStage("verify-session")
    let authUserId = options?.sessionUserId
    
    // Skip session check if we already have sessionUserId (faster, no network call)
    if (!authUserId) {
      console.log("[createIncident] No sessionUserId provided, fetching user session...")
      // CRITICAL FIX: Add timeout to prevent infinite hang on mobile (increased for slow networks)
      try {
        // Increased to 15 seconds for slow mobile networks
        const { data: { user } } = await getUserWithTimeout(15000)
        console.log("[createIncident] User verified:", user?.id)
        authUserId = user?.id || undefined
      } catch (error: any) {
        console.error("[createIncident] Auth getUser timeout or error:", {
          message: error.message,
          name: error.name,
          cause: error.cause
        })
        // Provide more helpful error messages
        if (error.message?.includes('timeout') || error.message?.includes('Connection timeout')) {
          throw new Error('Network is slow. Please wait a moment and try again, or check your connection.')
        }
        throw new Error(error.message || 'Failed to verify authentication. Please try again.')
      }
    } else {
      console.log("[createIncident] Using provided sessionUserId (skipping session check):", authUserId.substring(0, 8) + '...')
    }

    if (!authUserId || authUserId !== reporterId) {
      console.error("[createIncident] Auth mismatch:", { authUserId: authUserId?.substring(0, 8), reporterId: reporterId.substring(0, 8) })
      throw new Error("Authentication mismatch. Please try logging in again.")
    }
    
    console.log("[createIncident] ✅ Authentication verified, proceeding to create incident...")

    // Validate required fields (description is optional)
    console.log("[createIncident] Validating fields:", {
      hasReporterId: !!reporterId,
      hasIncidentType: !!incidentType,
      hasBarangay: !!barangay,
      photoCount: photoFiles?.length || 0,
      hasVoice: !!voiceBlob
    })
    
    if (!reporterId || !incidentType || !barangay) {
      console.error("[createIncident] ❌ Validation failed - missing required fields")
      return {
        success: false,
        message: "Missing required fields",
      }
    }

    const submissionTimestamp = createdAtLocal ?? new Date().toISOString()
    console.log("[createIncident] ✅ Validation passed, creating incident payload...")

    const filesToUpload = Array.isArray(photoFiles) ? photoFiles.slice(0, 3) : []

    const uploadSinglePhoto = async (file: File, photoIndex: number, providedAccessToken?: string, retries = 2): Promise<string | null> => {
      const fileSizeKB = (file.size / 1024).toFixed(1)
      console.log(`📤 [PHOTO ${photoIndex + 1}] Starting upload (${fileSizeKB}KB, ${retries} retries available)`)
      
      for (let attempt = 0; attempt <= retries; attempt++) {
        const uploadStartTime = Date.now()
        
        try {
          const form = new FormData()
          form.append('file', file)
          form.append('reporter_id', reporterId)

          // Use provided token first, then fallback to options, then try to get fresh one
          let accessToken = providedAccessToken || options?.accessToken
          if (!accessToken) {
            try {
              // Shorter timeout for background uploads (3 seconds)
              const { data: { session } } = await getSessionWithTimeout(3000)
              accessToken = session?.access_token || undefined
            } catch (error: any) {
              console.warn(`⚠️ [PHOTO ${photoIndex + 1}] Auth timeout (attempt ${attempt + 1}/${retries + 1}), will retry...`)
              if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
                continue
              }
              console.error(`❌ [PHOTO ${photoIndex + 1}] All auth attempts failed`)
              return null
            }
          }
          
          const headers: Record<string, string> = {}
          if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`
          }

          const uploadRes = await fetchWithTimeout('/api/incidents/upload', {
            method: 'POST',
            body: form,
            headers,
            timeout: 90000 // 90 seconds - matches mobile network reality
          })
          
          const uploadElapsed = Date.now() - uploadStartTime
          const uploadJson = await uploadRes.json()
          
          if (!uploadRes.ok || !uploadJson?.success || !uploadJson?.path) {
            if (attempt < retries) {
              const waitTime = 1000 * (attempt + 1) // Exponential backoff: 1s, 2s
              console.warn(`⚠️ [PHOTO ${photoIndex + 1}] Upload failed (${uploadElapsed}ms), retrying in ${waitTime}ms... (attempt ${attempt + 1}/${retries + 1})`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            }
            console.error(`❌ [PHOTO ${photoIndex + 1}] Upload failed after ${retries + 1} attempts (${uploadElapsed}ms):`, uploadJson)
            return null
          }
          
          console.log(`✅ [PHOTO ${photoIndex + 1}] Uploaded successfully in ${uploadElapsed}ms:`, uploadJson.path)
          return uploadJson.path as string
          
        } catch (error: any) {
          const uploadElapsed = Date.now() - uploadStartTime
          
          if (attempt < retries) {
            const waitTime = 1000 * (attempt + 1)
            console.warn(`⚠️ [PHOTO ${photoIndex + 1}] Error (${uploadElapsed}ms): ${error.message}. Retrying in ${waitTime}ms... (attempt ${attempt + 1}/${retries + 1})`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
          
          console.error(`❌ [PHOTO ${photoIndex + 1}] Failed after ${retries + 1} attempts (${uploadElapsed}ms):`, {
            error: error.message,
            name: error.name,
            fileSize: `${fileSizeKB}KB`
          })
          return null
        }
      }
      
      return null
    }

    // Upload voice function (non-blocking, can fail silently)
    const uploadVoice = async (blob: Blob, providedAccessToken?: string): Promise<string | null> => {
      try {
        const form = new FormData()
        form.append('file', blob, 'voice.webm')
        form.append('reporter_id', reporterId)

        // Use provided token first, then fallback to options, then try to get fresh one
        let accessToken = providedAccessToken || options?.accessToken
        if (!accessToken) {
          // CRITICAL FIX: Add timeout to prevent infinite hang on mobile
          try {
            // Shorter timeout for background (3 seconds)
            const { data: { session } } = await getSessionWithTimeout(3000)
            accessToken = session?.access_token || undefined
          } catch (error: any) {
            console.warn("Auth getSession timeout in voice upload, trying direct call:", error)
            // Last resort: try direct Supabase call
            try {
              const { data: { session: directSession } } = await supabase.auth.getSession()
              if (directSession?.access_token) {
                accessToken = directSession.access_token
              } else {
                throw new Error('Session verification timeout during voice upload. Please try again.')
              }
            } catch (directErr) {
              throw new Error('Session verification timeout during voice upload. Please try again.')
            }
          }
        }
        const headers: Record<string, string> = {}
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        // MOBILE FIX: Reduced timeout for mobile
        const uploadRes = await fetchWithTimeout('/api/incidents/upload-voice', {
          method: 'POST',
          body: form,
          headers,
          timeout: 30000 // 30 seconds for voice upload (reduced from 60s for mobile)
        }).catch((error: any) => {
          console.error('❌ Voice upload failed:', error)
          // Voice upload failure is non-critical, return null
          return null
        })
        
        if (!uploadRes) {
          console.error('Voice upload failed: No response')
          return null
        }
        
        const uploadJson = await uploadRes.json()
        if (!uploadRes.ok || !uploadJson?.success || !uploadJson?.path) {
          console.error('Voice upload failed:', uploadJson)
          return null // Don't fail incident creation if voice upload fails
        }
        console.log('Voice uploaded successfully, path:', uploadJson.path)
        return uploadJson.path as string
      } catch (error) {
        console.error('Failed to upload voice:', error)
        return null // Don't fail incident creation if voice upload fails
      }
    }

    // ============================================================
    // MOBILE OPTIMIZATION: Create incident FIRST (instant), upload photos in background
    // This ensures users see success immediately on mobile (fast networks)
    // ============================================================

    // Step 1: Create incident record IMMEDIATELY (fast ~1-2 seconds, no waiting for photos)
    notifyStage("create-record")
    console.log('🚀 [MOBILE] Creating incident immediately (photos will upload in background)')
    console.log('🚀 [MOBILE] Photo files count:', photoFiles?.length || 0, '- will upload in background')

    const payload: any = {
      reporter_id: reporterId,
      incident_type: incidentType,
      description: description || null, // Optional - can be null/empty
      location_lat: locationLat || 10.2465,
      location_lng: locationLng || 122.9735,
      address: address && address.trim() ? address.trim() : null,
      barangay,
      priority,
      photo_url: null, // Will be added in background
      photo_urls: [], // REQUIRED - must be array (empty initially, will be updated in background)
      voice_url: null, // Will be added in background
      is_offline: !!isOffline,
      created_at_local: submissionTimestamp,
    }

    const apiUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/incidents`
      : '/api/incidents'

    console.time('createIncident.api')
    console.log('🚀 [INCIDENT] ========== ABOUT TO MAKE API REQUEST ==========')
    console.log('🚀 [INCIDENT] URL:', apiUrl)
    console.log('🚀 [INCIDENT] Payload:', {
      reporter_id: payload.reporter_id.substring(0, 8) + '...',
      incident_type: payload.incident_type,
      barangay: payload.barangay,
      has_description: !!payload.description,
      location: [payload.location_lat, payload.location_lng],
      payload_size: JSON.stringify(payload).length + ' bytes'
    })
    console.log('🚀 [INCIDENT] About to call fetch()...')
    
    let apiJson: any
    const fetchStartTime = Date.now()

    try {
      console.log('🚀 [INCIDENT] Starting fetch request...')
      console.log('🚀 [INCIDENT] Window location:', typeof window !== 'undefined' ? window.location.origin : 'server-side')
      console.log('🚀 [INCIDENT] API URL:', apiUrl)
      
      // Retry logic for network errors (up to 2 retries)
      let lastError: any = null
      let apiRes: Response | null = null
      
      for (let attempt = 0; attempt < 3; attempt++) {
        // Create new controller for each attempt (resets timeout)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          console.error(`❌ [INCIDENT] API request timeout after 30 seconds (attempt ${attempt + 1})`)
          controller.abort()
        }, 30000) // 30 seconds per attempt
        
        try {
          if (attempt > 0) {
            console.log(`🔄 [INCIDENT] Retry attempt ${attempt}/2...`)
            // Wait before retry (exponential backoff: 1s, 2s)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          }
          
          console.log(`🚀 [INCIDENT] Attempt ${attempt + 1}: Calling fetch() NOW...`)
          console.log(`🚀 [INCIDENT] Request details:`, {
            method: 'POST',
            url: apiUrl,
            hasBody: !!payload,
            bodySize: JSON.stringify(payload).length
          })
          
          apiRes = await fetch(apiUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Connection': 'keep-alive' // Mobile network stability
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: 'no-store',
            keepalive: true // CRITICAL for mobile - keeps connection alive
          })
          
          console.log(`✅ [INCIDENT] Fetch call completed (attempt ${attempt + 1})`)
          
          clearTimeout(timeoutId)
          const fetchTime = Date.now() - fetchStartTime
          console.log(`✅ [INCIDENT] Fetch completed in ${fetchTime}ms, status: ${apiRes.status} (attempt ${attempt + 1})`)
          
          if (!apiRes.ok) {
            const errorText = await apiRes.text()
            console.error(`❌ [INCIDENT] API error (attempt ${attempt + 1}):`, errorText)
            // Don't retry on 4xx errors (client errors)
            if (apiRes.status >= 400 && apiRes.status < 500) {
              throw new Error('Failed to create incident: ' + errorText)
            }
            // Retry on 5xx errors (server errors)
            lastError = new Error('Server error: ' + errorText)
            if (attempt < 2) continue
            throw lastError
          }
          
          // Success - break out of retry loop
          break
        } catch (fetchErr: any) {
          clearTimeout(timeoutId)
          lastError = fetchErr
          if (fetchErr.name === 'AbortError') {
            // Timeout - retry if we have attempts left
            if (attempt < 2) {
              console.warn(`⚠️ [INCIDENT] Timeout (attempt ${attempt + 1}), will retry...`)
              continue
            }
            throw new Error('Network is slow. Please wait a moment and try again, or check your connection.')
          }
          // Network errors - retry
          if (attempt < 2) {
            console.warn(`⚠️ [INCIDENT] Network error (attempt ${attempt + 1}), will retry...`, fetchErr.message)
            continue
          }
          // Last attempt failed
          throw fetchErr
        }
      }
      
      if (!apiRes) {
        throw lastError || new Error('Failed to create incident after retries')
      }

      console.log('🚀 [INCIDENT] Parsing JSON response...')
      apiJson = await apiRes.json()
      const totalTime = Date.now() - fetchStartTime
      console.timeEnd('createIncident.api')
      console.log(`✅ [INCIDENT] Total API time: ${totalTime}ms`)

      if (!apiJson?.success || !apiJson?.data?.id) {
        console.error('❌ [INCIDENT] Invalid API response:', apiJson)
        throw new Error('Failed to create incident: Invalid response')
      }

      const incidentId = apiJson.data.id
      console.log('✅ [INCIDENT] Incident created successfully:', incidentId)
      
      // Step 2: Upload photos in TRUE background (only after user sees success)
      // Use requestIdleCallback or setTimeout to ensure it doesn't block
      if ((filesToUpload.length > 0 || voiceBlob) && typeof window !== 'undefined') {
        // Capture everything needed before async context
        const backgroundIncidentId = incidentId
        const backgroundAccessToken = options?.accessToken
        const backgroundFiles = [...filesToUpload]
        const backgroundVoice = voiceBlob
        
        // Use requestIdleCallback if available (browser optimization), otherwise setTimeout
        const scheduleBackgroundUpload = (callback: () => void) => {
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(callback, { timeout: 2000 })
          } else {
            setTimeout(callback, 500) // Start after 500ms delay
          }
        }
        
        scheduleBackgroundUpload(async () => {
          try {
            console.log(`📤 [BACKGROUND] Starting background upload for ${backgroundFiles.length} photo(s)`)
            
            // Get fresh session token if not provided (for background context)
            let accessToken = backgroundAccessToken
            if (!accessToken) {
              try {
                // Shorter timeout for background (3 seconds)
                const { data: { session } } = await getSessionWithTimeout(3000)
                accessToken = session?.access_token || undefined
                if (accessToken) {
                  console.log('✅ [BACKGROUND] Got fresh session token')
                }
              } catch (err) {
                console.warn('⚠️ [BACKGROUND] Could not get session token via timeout, trying direct Supabase call:', err)
                // Last resort: try direct Supabase call (no timeout wrapper)
                try {
                  const { data: { session: directSession } } = await supabase.auth.getSession()
                  if (directSession?.access_token) {
                    accessToken = directSession.access_token
                    console.log('✅ [BACKGROUND] Got token via direct Supabase call')
                  }
                } catch (directErr) {
                  console.warn('⚠️ [BACKGROUND] Direct Supabase call also failed, continuing without token:', directErr)
                }
              }
            } else {
              console.log('✅ [BACKGROUND] Using provided access token')
            }
            
            const uploadedPhotoPaths: string[] = []
            
            // Upload photos in parallel for faster mobile uploads (mobile networks can handle parallel)
            if (backgroundFiles.length > 0) {
              const photoUploadPromises = backgroundFiles.map((file, index) => {
                // Pass the access token to uploadSinglePhoto
                return uploadSinglePhoto(file, index, accessToken).catch((err) => {
                  console.warn(`⚠️ [BACKGROUND] Photo ${index + 1} upload failed:`, err?.message || err)
                  return null
                })
              })
              
              const photoResults = await Promise.all(photoUploadPromises)
              uploadedPhotoPaths.push(...photoResults.filter((p): p is string => p !== null))
              
              console.log(`✅ [BACKGROUND] Uploaded ${uploadedPhotoPaths.length}/${backgroundFiles.length} photo(s)`)
            }
            
            // Upload voice in background (non-critical)
            let uploadedVoicePath: string | null = null
            if (backgroundVoice) {
              try {
                // Pass access token to uploadVoice
                uploadedVoicePath = await uploadVoice(backgroundVoice, accessToken).catch((err) => {
                  console.warn('⚠️ [BACKGROUND] Voice upload failed (non-critical):', err?.message || err)
                  return null
                })
              } catch (err: any) {
                console.warn('⚠️ [BACKGROUND] Voice upload error (non-critical):', err?.message || err)
              }
            }
            
            // Update incident with media paths
            if (uploadedPhotoPaths.length > 0 || uploadedVoicePath) {
              const updatePayload: any = {}
              if (uploadedPhotoPaths.length > 0) {
                updatePayload.photo_url = uploadedPhotoPaths[0]
                updatePayload.photo_urls = uploadedPhotoPaths
              }
              if (uploadedVoicePath) {
                updatePayload.voice_url = uploadedVoicePath
              }
              
              // Include auth token for update request
              const updateHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
              if (accessToken) {
                updateHeaders['Authorization'] = `Bearer ${accessToken}`
              }
              
              const updateRes = await fetch('/api/incidents', {
                method: 'PUT',
                headers: updateHeaders,
                body: JSON.stringify({ id: backgroundIncidentId, ...updatePayload })
              })
              
              if (updateRes.ok) {
                const updateJson = await updateRes.json()
                console.log('✅ [BACKGROUND] Incident updated with media paths:', {
                  photos: uploadedPhotoPaths.length,
                  hasVoice: !!uploadedVoicePath
                })
              } else {
                const errorText = await updateRes.text()
                console.warn('⚠️ [BACKGROUND] Failed to update incident with media:', {
                  status: updateRes.status,
                  error: errorText.substring(0, 200)
                })
              }
            } else {
              console.warn('⚠️ [BACKGROUND] No media to update (all uploads may have failed)')
            }
          } catch (err: any) {
            console.error('❌ [BACKGROUND] Background upload error (non-critical):', {
              message: err?.message || 'Unknown error',
              stack: err?.stack?.substring(0, 500)
            })
            // Don't throw - incident already created, user already sees success
          }
        })
      }
      
      // Step 3: Return success IMMEDIATELY (user sees success, photos upload in background)
      notifyStage("done")
      console.timeEnd('createIncident.total')
      console.log('✅ [MOBILE] Submission complete - user sees success immediately')
      return { success: true, data: apiJson.data }
      
    } catch (error: any) {
      // Timeout is already cleared in retry loop
      if (error.name === 'AbortError') {
        // More helpful error message
        throw new Error('Network is slow. Please wait a moment and try again, or check your connection.')
      }
      throw error
    }
  } catch (error: any) {
    console.error("Error creating incident:", error)
    return { success: false, message: error.message || "An unexpected error occurred" }
  }
}

// Assign incident to volunteer (admin only)
export const assignIncident = async (
  incidentId: string,
  volunteerId: string,
  adminId: string
) => {
  try {
    const cleanIncidentId = String(incidentId).split('?')[0].trim()
    const cleanVolunteerId = String(volunteerId).split('?')[0].trim()
    const cleanAdminId = String(adminId).split('?')[0].trim()

    console.log('Assign via admin API:', { cleanIncidentId, cleanVolunteerId, cleanAdminId })

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token

    const res = await fetch('/api/admin/incidents/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ incidentId: cleanIncidentId, volunteerId: cleanVolunteerId })
    })
    const json = await res.json()
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || 'Failed to assign incident')
    }

    return {
      success: true,
      data: json.data,
      message: 'Incident assigned successfully'
    }
  } catch (error: any) {
    console.error('Error assigning incident (API):', error)
    return {
      success: false,
      message: error.message || 'Failed to assign incident'
    }
  }
}

// Update incident status (volunteer)
export const updateIncidentStatus = async (
  volunteerId: string,
  incidentId: string,
  newStatus: 'RESPONDING' | 'RESOLVED' | 'ARRIVED',
  notes?: string
) => {
  try {
    // Validate inputs
    if (!volunteerId || !incidentId) {
      throw new Error('Volunteer ID and Incident ID are required');
    }

    console.log(`Updating incident ${incidentId} to ${newStatus}`, {
      volunteerId,
      hasNotes: !!notes
    });

    // First, get the current incident data for notifications
    const { data: currentIncident, error: fetchError } = await supabase
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id,
          first_name,
          last_name,
          phone_number
        )
      `)
      .eq('id', incidentId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch incident data:", fetchError);
      throw new Error('Failed to fetch incident data');
    }

    const previousStatus = (currentIncident as unknown as Incident).status;

    // ===== ATTEMPT 1: Try the most basic update approach =====
    try {
      console.log("Attempt 1: Basic filter-based update");

      // Use filter instead of eq to avoid column id reference issues
      const { error } = await (supabase as any)
          .from('incidents')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', incidentId);

      if (error) {
        console.error("Basic update failed:", error);
        throw error;
      }

      console.log("Basic update succeeded!");

      // Add additional fields for RESOLVED status in a separate update
      if (newStatus === 'RESOLVED') {
        try {
          const { error: resolveError } = await (supabase as any)
            .from('incidents')
            .update({
              resolved_at: new Date().toISOString(),
              resolution_notes: notes || null
            })
            .eq('id', incidentId);

          if (resolveError) {
            console.error("Additional resolve fields update failed (non-critical):", resolveError);
            // Continue execution anyway
          } else {
            console.log("Additional resolve fields updated successfully");
            
            // Log resolution notes in timeline if provided
            if (notes && notes.trim()) {
              try {
                const { logResolutionNotes } = await import('@/lib/incident-timeline')
                await logResolutionNotes(incidentId, volunteerId, notes)
                console.log('✅ Resolution notes logged in timeline')
              } catch (logError) {
                console.error('❌ Failed to log resolution notes:', logError)
              }
            }
          }
        } catch (resolveErr) {
          console.error("Error in additional fields update (non-critical):", resolveErr);
          // Continue execution
        }

        // Try to update volunteer profile count (manual update to avoid trigger issues)
        try {
          // First get current count
          const { data: profileData }: any = await (supabase as any)
            .from('volunteer_profiles')
            .select('total_incidents_resolved')
            .eq('volunteer_user_id', volunteerId)
            .single();

          const currentCount = profileData?.total_incidents_resolved || 0;
          const newCount = currentCount + 1;

          // Then update using volunteer_user_id consistently
          const { error: profileError } = await (supabase as any)
            .from('volunteer_profiles')
            .update({
              total_incidents_resolved: newCount,
              is_available: true
            })
            .eq('volunteer_user_id', volunteerId);

          if (profileError) {
            console.error("Profile update failed (non-critical):", profileError);
          } else {
            console.log(`Profile updated to ${newCount} resolved incidents`);
          }
        } catch (profileErr) {
          console.error("Error in profile update (non-critical):", profileErr);

          // Still consider this a success since the incident was updated
        }
      }

      // Add responding_at field for RESPONDING status
      if (newStatus === 'RESPONDING') {
        try {
          const { error: respondingError } = await (supabase as any)
            .from('incidents')
            .update({
              responding_at: new Date().toISOString()
            })
            .eq('id', incidentId);

          if (respondingError) {
            console.error("Responding field update failed (non-critical):", respondingError);
          } else {
            console.log("Responding field updated successfully");
          }
        } catch (respondingErr) {
          console.error("Error in responding field update (non-critical):", respondingErr);
        }
      }

      // Log status change using centralized helper
      try {
        const { logStatusChange } = await import('@/lib/incident-timeline')
        await logStatusChange(
          incidentId,
          previousStatus,
          newStatus,
          volunteerId,
          notes || undefined
        )
        console.log("✅ Status change logged successfully")
      } catch (logErr) {
        console.error("❌ Error logging status change:", logErr)
        // Don't fail status update if logging fails
      }

      // ===== CRITICAL: Send notifications to admins and residents =====
      try {
        await sendStatusUpdateNotifications(currentIncident, newStatus, volunteerId, notes);
      } catch (notificationError) {
        console.error("Notification error (non-critical):", notificationError);
        // Don't fail the entire operation if notifications fail
      }

      // Return success
      return {
        success: true,
        data: {
          id: incidentId,
          status: newStatus
        }
      };

    } catch (basicError) {
      console.error("Attempt 1 failed:", basicError);

      // ===== ATTEMPT 2: Try a match-based approach =====
      try {
        console.log("Attempt 2: Match-based update");

        const { error } = await (supabase as any)
          .from('incidents')
          .update({ status: newStatus })
          .match({ id: incidentId });

        if (error) {
          console.error("Match-based update failed:", error);
          throw error;
        }

        console.log("Match-based update succeeded!");

        // Send notifications even for fallback updates
        try {
          await sendStatusUpdateNotifications(currentIncident, newStatus, volunteerId, notes);
        } catch (notificationError) {
          console.error("Notification error (non-critical):", notificationError);
        }

        // Return success
        return {
          success: true,
          data: {
            id: incidentId,
            status: newStatus
          }
        };

      } catch (matchError) {
        console.error("Attempt 2 failed:", matchError);

        // ===== ATTEMPT 3: Use the most minimal update possible =====
        try {
          console.log("Attempt 3: Minimal update");

          const { error } = await (supabase as any)
            .from('incidents')
            .update({ status: newStatus })
            .eq('id', incidentId);

          if (error) {
            console.error("Minimal update failed:", error);
            throw error;
          }

          console.log("Minimal update succeeded!");

          // Send notifications even for minimal updates
          try {
            await sendStatusUpdateNotifications(currentIncident, newStatus, volunteerId, notes);
          } catch (notificationError) {
            console.error("Notification error (non-critical):", notificationError);
          }

          // Return success
          return {
            success: true,
            data: {
              id: incidentId,
              status: newStatus
            }
          };

        } catch (minError) {
          console.error("Attempt 3 failed:", minError);
          throw minError; // Let it propagate to the outer catch
        }
      }
    }

  } catch (error: any) {
    console.error("Error updating incident status:", error);
    return {
      success: false,
      message: error.message || "Failed to update incident status",
      error
    };
  }
};

// Helper function to send status update notifications
async function sendStatusUpdateNotifications(
  incident: any,
  newStatus: string,
  volunteerId: string,
  notes?: string
) {
  try {
    console.log(`Sending status update notifications for incident ${incident.id} to ${newStatus}`);

    // Get volunteer information for notifications
    const { data: volunteer }: any = await (supabase as any)
      .from('users')
      .select('first_name, last_name')
      .eq('id', volunteerId)
      .single();

    const volunteerName = volunteer ? `${volunteer.first_name} ${volunteer.last_name}` : 'Volunteer';

    // Prepare status messages
    const statusMessages = {
      'RESPONDING': {
        title: '🚀 Volunteer Responding',
        body: `${volunteerName} is now responding to the incident`,
        adminTitle: '📋 Incident Status Update',
        adminBody: `${volunteerName} is responding to incident #${incident.id.slice(0, 8)}`
      },
      'ARRIVED': {
        title: '📍 Volunteer Arrived',
        body: `${volunteerName} has arrived at the incident location`,
        adminTitle: '📋 Incident Status Update',
        adminBody: `${volunteerName} has arrived at incident #${incident.id.slice(0, 8)}`
      },
      'RESOLVED': {
        title: '✅ Incident Resolved',
        body: `Your incident has been resolved by ${volunteerName}`,
        adminTitle: '✅ Incident Resolved',
        adminBody: `Incident #${incident.id.slice(0, 8)} has been resolved by ${volunteerName}`
      }
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages];
    if (!message) return;

    // 1. Notify the resident (reporter)
    if (incident.reporter_id) {
      try {
        const { notificationSubscriptionService } = await import('@/lib/notification-subscription-service');
        const notificationService = notificationSubscriptionService;

        await notificationService.sendNotificationToUser(incident.reporter_id, {
          title: message.title,
          body: message.body,
          data: {
            type: 'status_update',
            incident_id: incident.id,
            status: newStatus,
            volunteer_name: volunteerName,
            url: `/resident/incident/${incident.id}`
          }
        });

        console.log(`Status update notification sent to resident ${incident.reporter_id}`);

        // ALSO send SMS notification to resident
        try {
          const { smsService } = await import('@/lib/sms-service');

          // Get resident phone number
          const { data: resident }: any = await (supabase as any)
            .from('users')
            .select('phone_number')
            .eq('id', incident.reporter_id)
            .single();

          if (resident && resident.phone_number) {
            // Get reference ID
            const { referenceIdService } = await import('@/lib/reference-id-service');
            const referenceResult = await referenceIdService.getReferenceId(incident.id);
            const referenceId = referenceResult.success && referenceResult.referenceId
              ? referenceResult.referenceId
              : incident.id.slice(0, 8);

            const smsResult = await smsService.sendResidentStatusUpdate(
              incident.id,
              referenceId,
              resident.phone_number,
              incident.reporter_id,
              {
                status: newStatus,
                volunteerName: volunteerName,
                type: incident.incident_type,
                barangay: incident.barangay,
                time: new Date().toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })
              }
            );

            if (smsResult.success) {
              console.log(`SMS status update sent to resident ${incident.reporter_id}`);
            } else {
              console.log(`Failed to send SMS status update to resident:`, smsResult.error);
            }
          }
        } catch (smsError) {
          console.error('Failed to send SMS to resident:', smsError);
        }
      } catch (residentError) {
        console.error('Failed to notify resident:', residentError);
      }
    }

    // 2. Notify all admins
    try {
      const { data: admins }: any = await (supabase as any)
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const { notificationSubscriptionService } = await import('@/lib/notification-subscription-service');
        const notificationService = notificationSubscriptionService;

        const adminIds = admins.map((admin: any) => admin.id);

        await notificationService.sendNotificationToUsers(adminIds, {
          title: message.adminTitle,
          body: message.adminBody,
          data: {
            type: 'incident_status_update',
            incident_id: incident.id,
            status: newStatus,
            volunteer_name: volunteerName,
            url: `/admin/incidents/${incident.id}`
          }
        });

        console.log(`Status update notifications sent to ${adminIds.length} admins`);

        // ALSO send SMS notifications to all admins
        try {
          const { smsService } = await import('@/lib/sms-service');

          // Get all admin phone numbers
          const { data: adminsWithPhones }: any = await (supabase as any)
            .from('users')
            .select('id, phone_number')
            .eq('role', 'admin')
            .not('phone_number', 'is', null);

          if (adminsWithPhones && adminsWithPhones.length > 0) {
            const adminPhones = adminsWithPhones.map((admin: any) => admin.phone_number).filter(Boolean) as string[];
            const adminUserIds = adminsWithPhones.map((admin: any) => admin.id);

            if (adminPhones.length > 0) {
              // Get reference ID
              const { referenceIdService } = await import('@/lib/reference-id-service');
              const referenceResult = await referenceIdService.getReferenceId(incident.id);
              const referenceId = referenceResult.success && referenceResult.referenceId
                ? referenceResult.referenceId
                : incident.id.slice(0, 8);

              const smsResult = await smsService.sendAdminStatusUpdate(
                incident.id,
                referenceId,
                adminPhones,
                adminUserIds,
                {
                  status: newStatus,
                  volunteerName: volunteerName,
                  incidentId: incident.id,
                  type: incident.incident_type,
                  barangay: incident.barangay,
                  time: new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })
                }
              );

              if (smsResult.success) {
                console.log(`SMS status update sent to ${adminPhones.length} admins`);
              } else {
                console.log(`Failed to send SMS status update to admins:`, smsResult.results);
              }
            }
          }
        } catch (adminSmsError) {
          console.error('Failed to send SMS to admins:', adminSmsError);
        }
      }
    } catch (adminError) {
      console.error('Failed to notify admins:', adminError);
    }
  } catch (error) {
    console.error('Error in sendStatusUpdateNotifications:', error);
  }
}

// Get incidents assigned to volunteer
export const getVolunteerIncidents = async (volunteerId: string) => {
  try {
    const actualVolunteerId = volunteerId.split('?')[0]; // Remove any cache-busting parameters

    if (!actualVolunteerId) {
      console.error("No volunteer ID provided to getVolunteerIncidents");
      return { success: false, message: "Volunteer ID is required", data: [] };
    }

    console.log("Fetching incidents for volunteer:", actualVolunteerId);

    // Try server API first to bypass RLS and include reporter reliably
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      const res = await fetch('/api/volunteer/incidents', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      const json = await res.json()
      if (res.ok && json?.success) {
        console.log(`Retrieved ${json.data?.length || 0} incidents via API for volunteer ${actualVolunteerId}`)
        return { success: true, data: json.data || [] }
      }
      console.warn('Volunteer incidents API failed; falling back to client query:', json?.message || res.statusText)
    } catch (e) {
      console.warn('Volunteer incidents API not reachable; falling back to client query')
    }

    const { data, error } = await supabase
      .from('incidents')
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq('assigned_to', actualVolunteerId)
      .order('created_at', { ascending: false })
      .limit(100); // Ensure we get all data

    if (error) {
      console.error("Database error in getVolunteerIncidents:", error);
      throw error;
    }

    console.log(`Retrieved ${data?.length || 0} incidents for volunteer ${actualVolunteerId}`);

    // Always refresh the data from database to ensure we have the latest status
    try {
      const { data: freshStatus }: any = await (supabase as any)
        .from('incidents')
        .select('id, status')
        .eq('assigned_to', actualVolunteerId);

      if (freshStatus && data) {
        // Update our data with fresh statuses
        for (const incident of data) {
          const updated = freshStatus.find((item: any) => item.id === (incident as any).id);
          if (updated && updated.status !== (incident as any).status) {
            console.log(`Updating status for ${(incident as any).id} from ${(incident as any).status} to ${updated.status}`);
            (incident as any).status = updated.status;
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing statuses (non-critical):", err);
    }

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error('Error fetching volunteer incidents:', error)
    return { success: false, message: error.message || "Failed to retrieve volunteer incidents", data: [] }
  }
}

export const getVolunteerIncidentsForAdmin = async (volunteerId: string) => {
  try {
    const actualVolunteerId = volunteerId.split('?')[0].trim()

    if (!actualVolunteerId) {
      console.error("[Admin] No volunteer ID provided to getVolunteerIncidentsForAdmin")
      return { success: false, message: "Volunteer ID is required", data: [] }
    }

    console.log("[Admin] Fetching incidents for volunteer:", actualVolunteerId)

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token

    const res = await fetch(`/api/admin/volunteer-incidents?volunteerId=${encodeURIComponent(actualVolunteerId)}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })

    const json = await res.json()

    if (res.ok && json?.success) {
      console.log(`[Admin] Retrieved ${json.data?.length || 0} incidents for volunteer ${actualVolunteerId}`)
      return { success: true, data: json.data || [] }
    }

    console.warn('[Admin] Admin volunteer incidents API failed:', json?.message || res.statusText)
    return { success: false, message: json?.message || 'Failed to load volunteer incidents', data: [] }
  } catch (error: any) {
    console.error('[Admin] Error fetching volunteer incidents:', error)
    return {
      success: false,
      message: error.message || 'Failed to retrieve volunteer incidents',
      data: [],
    }
  }
}

export const getResidentIncidents = async (residentId: string) => {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(
        `
        *,
        assigned_to:users!incidents_assigned_to_fkey(
          first_name,
          last_name,
          phone_number
        )
      `,
      )
      .eq("reporter_id", residentId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching resident incidents:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}

// Get incident updates
export const getIncidentUpdates = async (incidentId: string) => {
  try {
    const { data, error } = await supabase
      .from('incident_updates')
      .select(`
        *,
        updated_by:users!incident_updates_updated_by_fkey(
          first_name,
          last_name,
          role
        )
      `)
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error("Error fetching incident updates:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}

// Subscribe to real-time incident updates (for admins)
export const subscribeToIncidents = (callback: (payload: any) => void) => {
  return supabase
    .channel("incidents-channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, callback)
    .subscribe()
}

// Subscribe to real-time incident updates for a specific volunteer
export const subscribeToVolunteerIncidents = (volunteerId: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`volunteer-incidents-${volunteerId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "incidents",
        filter: `assigned_to=eq.${volunteerId}`,
      },
      callback,
    )
    .subscribe()
}

// Subscribe to real-time incident updates for a specific resident
export const subscribeToResidentIncidents = (residentId: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`resident-incidents-${residentId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "incidents",
        filter: `reporter_id=eq.${residentId}`,
      },
      callback,
    )
    .subscribe()
}

// Get incidents within a specific area (for map view)
export const getIncidentsInArea = async (
  northLat: number,
  southLat: number,
  eastLng: number,
  westLng: number,
  statuses?: string[],
) => {
  try {
    let query = supabase
      .from("incidents")
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey(
          first_name,
          last_name
        ),
        assigned_to:users!incidents_assigned_to_fkey(
          first_name,
          last_name
        )
      `)
      .gte("location_lat", southLat)
      .lte("location_lat", northLat)
      .gte("location_lng", westLng)
      .lte("location_lng", eastLng)

    // Filter by status if provided
    if (statuses && statuses.length > 0) {
      query = query.in("status", statuses)
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching incidents in area:", error.message)
    return { success: false, message: error.message, data: [] }
  }
}
