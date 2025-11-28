import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { IncidentCreateSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { isWithinTalisayCity } from '@/lib/geo-utils'
import { mapPriorityToSeverity } from '@/lib/incident-utils'
import { normalizeBarangay } from '@/lib/barangay-mapping'
import { getServerSupabase } from '@/lib/supabase-server'
import { analyticsCache } from '@/app/api/volunteers/analytics/cache'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

// Helper function to get required skills for incident type
function getRequiredSkillsForIncidentType(incidentType: string): string[] {
  const skillMapping: Record<string, string[]> = {
    'FIRE': ['FIREFIGHTING', 'EMERGENCY RESPONSE'],
    'FLOOD': ['WATER RESCUE', 'EMERGENCY RESPONSE'],
    'EARTHQUAKE': ['SEARCH AND RESCUE', 'EMERGENCY RESPONSE'],
    'MEDICAL EMERGENCY': ['FIRST AID', 'MEDICAL PROFESSIONAL'],
    'CRIME': ['EMERGENCY RESPONSE', 'LEADERSHIP'],
    'TRAFFIC ACCIDENT': ['FIRST AID', 'EMERGENCY RESPONSE'],
    'FALLEN TREE': ['EMERGENCY RESPONSE'],
    'POWER OUTAGE': ['EMERGENCY RESPONSE'],
    'WATER OUTAGE': ['EMERGENCY RESPONSE'],
    'LANDSLIDE': ['SEARCH AND RESCUE', 'EMERGENCY RESPONSE'],
    'OTHER': ['EMERGENCY RESPONSE']
  }
  
  return skillMapping[incidentType] || ['EMERGENCY RESPONSE']
}

// Helper function to generate short reference ID from UUID
function generateReferenceId(uuid: string): string {
  // Extract first 2 characters from each part of the UUID
  const parts = uuid.split('-')
  const prefix = parts[0].substring(0, 2).toUpperCase()
  const suffix = parts[1].substring(0, 3).toUpperCase()
  
  return `${prefix}${suffix}`
}

export const runtime = 'nodejs'

const BARANGAY_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
let barangayCache: { data: string[]; expiresAt: number } = { data: [], expiresAt: 0 }

// Cache Supabase service role client globally to avoid recreating on every request
let cachedServiceRoleClient: SupabaseClient | null = null

function getServiceRoleClient(): SupabaseClient {
  if (!cachedServiceRoleClient) {
    cachedServiceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }
  return cachedServiceRoleClient
}

async function getKnownBarangaysCached(client: SupabaseClient): Promise<string[]> {
  const now = Date.now()
  if (barangayCache.data.length && barangayCache.expiresAt > now) {
    return barangayCache.data
  }

  try {
    const { data, error } = await client.from('barangays').select('name')
    if (!error && Array.isArray(data)) {
      const names = data.map((b: any) => b.name).filter(Boolean)
      barangayCache = {
        data: names,
        expiresAt: now + BARANGAY_CACHE_TTL,
      }
      return names
    }
    if (error) {
      console.warn('Failed to refresh barangay cache:', error)
    }
  } catch (err) {
    console.warn('Barangay cache refresh threw:', err)
  }

  return barangayCache.data
}

const sanitizeLocalTimestamp = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  const now = Date.now()
  const ms = parsed.getTime()
  const maxPast = 1000 * 60 * 60 * 24 * 7 // 7 days
  const maxFuture = 1000 * 60 * 5 // 5 minutes

  if (ms < now - maxPast) return null
  if (ms > now + maxFuture) return null

  return parsed.toISOString()
}


export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'incidents:get'), 120)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const id = searchParams.get('id')
    const role = (searchParams.get('role') || '').toUpperCase()
    const barangay = searchParams.get('barangay') || undefined
    const coverage = (searchParams.get('coverage') || '').toLowerCase() // 'barangay' | 'citywide'
    const projection = (searchParams.get('projection') || '').toLowerCase() // 'map' for light fields
    const limitParam = parseInt(searchParams.get('limit') || '', 10)
    const offsetParam = parseInt(searchParams.get('offset') || '', 10)
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, limitParam)) : 100
    const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0

    // Base query
    let selectExpr = '*'
    if (projection === 'map') {
      // Minimal fields for map markers
      selectExpr = 'id, incident_type, status, description, location_lat, location_lng, created_at, is_overdue'
    } else {
      // Include related reporter and assignee for UI tables
      selectExpr = `
        *,
        reporter:users!incidents_reporter_id_fkey (
          first_name,
          last_name,
          role
        ),
        assigned_to:users!incidents_assigned_to_fkey (
          first_name,
          last_name
        )
      `
    }
    let query = supabase.from('incidents').select(selectExpr).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (id) {
      query = supabase.from('incidents').select(selectExpr).eq('id', id)
    }
    if (status) query = query.eq('status', status)

    // Server-side filtering by role, safely additive (defaults to previous behavior when role not provided)
    if (role === 'admin') {
      // No additional filter: admin sees all
    } else if (role === 'barangay') {
      // Require barangay filter for barangay users using string field 'barangay'
      if (barangay) {
        query = query.ilike('barangay', barangay.toUpperCase())
      } else {
        // If barangay not provided, return 403 forbidden
        return NextResponse.json({ success: false, code: 'FORBIDDEN_MISSING_SCOPE', message: 'Forbidden: missing barangay scope' }, { status: 403 })
      }
    } else if (role === 'volunteer') {
      // Volunteers may have barangay or citywide coverage
      if (coverage === 'barangay') {
        if (barangay) {
          query = query.ilike('barangay', barangay.toUpperCase())
        } else {
          return NextResponse.json({ success: false, code: 'FORBIDDEN_MISSING_SCOPE', message: 'Forbidden: missing barangay scope' }, { status: 403 })
        }
      } else {
        // citywide or unspecified -> all incidents (no extra filter)
      }
    } else if (role === 'resident') {
      // Residents do not need markers
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 })
    } else {
      // No role provided -> preserve existing behavior (no role-based filtering)
    }

    const { data, error } = id ? await query.single() : await query
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch incidents' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'incidents:put'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const body = await request.json()
    const {
      id,
      incident_type,
      description,
      location_lat,
      location_lng,
      address,
      barangay,
      status,
      priority,
      photo_url,
      assigned_to,
      resolved_at,
      resolution_notes,
      updated_by,
      notes,
    } = body || {}

    if (!id) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'id required' }, { status: 400 })

    // If coordinates provided, enforce geofence
    if (typeof location_lat === 'number' && typeof location_lng === 'number') {
      if (!isWithinTalisayCity(location_lat, location_lng)) {
        return NextResponse.json({ success: false, code: 'OUT_OF_BOUNDS', message: 'Location must be within Talisay City' }, { status: 400 })
      }
    }

    // Read existing to compare status
    const { data: existing, error: readErr } = await supabase
      .from('incidents')
      .select('id,status')
      .eq('id', id)
      .single()
    if (readErr) throw readErr

    const update: any = {}
    if (incident_type) update.incident_type = String(incident_type).toUpperCase()
    if (typeof description === 'string') update.description = description.trim()
    if (typeof location_lat === 'number') update.location_lat = location_lat
    if (typeof location_lng === 'number') update.location_lng = location_lng
    if (typeof address === 'string' || address === null) update.address = address ?? null
    if (barangay) update.barangay = String(barangay).toUpperCase()
    if (status) update.status = status
    if (typeof priority === 'number' || typeof priority === 'string') {
      const priorityNum = Number(priority)
      update.priority = priorityNum
      update.severity = mapPriorityToSeverity(String(priorityNum))
    }
    if (typeof photo_url === 'string' || photo_url === null) update.photo_url = photo_url ?? null
    if (assigned_to !== undefined) update.assigned_to = assigned_to
    if (resolved_at !== undefined) update.resolved_at = resolved_at
    if (resolution_notes !== undefined) update.resolution_notes = resolution_notes

    // @ts-ignore - Type issue with supabase update
    const { data, error } = await supabase
      .from('incidents')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    
    // Get user ID for timeline logging
    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id || null
    
    // Log photo addition if photos were added
    if (photo_url && (!existing || !(existing as any)?.photo_url)) {
      try {
        const { logPhotoAdded } = await import('@/lib/incident-timeline')
        const photoCount = Array.isArray((data as any)?.photo_urls) 
          ? (data as any).photo_urls.length 
          : (photo_url ? 1 : 0)
        await logPhotoAdded(id, userId, photoCount)
        console.log('✅ Photo addition logged in timeline')
      } catch (logError) {
        console.error('❌ Failed to log photo addition:', logError)
      }
    }
    
    // Log location update if location changed
    if ((location_lat !== undefined || location_lng !== undefined || address !== undefined) && existing) {
      const locationChanged = 
        (location_lat !== undefined && location_lat !== (existing as any)?.location_lat) ||
        (location_lng !== undefined && location_lng !== (existing as any)?.location_lng) ||
        (address !== undefined && address !== (existing as any)?.address)
      
      if (locationChanged) {
        try {
          const { logLocationUpdate } = await import('@/lib/incident-timeline')
          await logLocationUpdate(id, userId, {
            lat: location_lat ?? (existing as any)?.location_lat ?? 0,
            lng: location_lng ?? (existing as any)?.location_lng ?? 0,
            address: address ?? (existing as any)?.address ?? undefined
          })
          console.log('✅ Location update logged in timeline')
        } catch (logError) {
          console.error('❌ Failed to log location update:', logError)
        }
      }
    }
    
    // Log resolution notes if added
    if (resolution_notes && (!existing || !(existing as any)?.resolution_notes)) {
      try {
        const { logResolutionNotes } = await import('@/lib/incident-timeline')
        await logResolutionNotes(id, userId, resolution_notes)
        console.log('✅ Resolution notes logged in timeline')
      } catch (logError) {
        console.error('❌ Failed to log resolution notes:', logError)
      }
    }
    
    // If status changed, record incident_updates
    if (status && (existing as any)?.status && (existing as any).status !== status) {
      try {
        const { logStatusChange } = await import('@/lib/incident-timeline')
        await logStatusChange(id, (existing as any).status, status, userId)
        console.log('✅ Status change logged in timeline')
      } catch (logError) {
        console.error('❌ Failed to log status change:', logError)
        // Fallback to old method if new one fails
        try {
          await supabase
            .from('incident_updates')
            .insert({
              incident_id: id,
              updated_by: updated_by ?? null,
              previous_status: (existing as any).status,
              new_status: status,
              notes: typeof notes === 'string' ? notes : null
            } as any)
        } catch (err) {
          console.error('Failed to record incident_updates:', err)
        }
      }
    }

    // Invalidate cache for assigned volunteer when incident is updated
    if ((data as any)?.assigned_to) {
      analyticsCache.invalidateForVolunteer((data as any).assigned_to)
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to update incident' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Use cached service role client to bypass RLS for incident creation
    const supabase = getServiceRoleClient()
    const rate = rateLimitAllowed(rateKeyFromRequest(request, 'incidents:post'), 30)
    if (!rate.allowed) return NextResponse.json({ success: false, code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } as any })

    const parsed = IncidentCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 })

    const {
      reporter_id,
      incident_type,
      description,
      location_lat,
      location_lng,
      address,
      barangay,
      priority,
      photo_url,
      photo_urls,
      voice_url,
      is_offline,
      created_at_local
    } = parsed.data
    const normalizedIncidentType = incident_type.trim().toUpperCase()
    const normalizedPriority = Number(priority)
    const normalizedLocalTimestamp = is_offline ? sanitizeLocalTimestamp(created_at_local) : null

    if (normalizedIncidentType === "EMERGENCY INCIDENT" && normalizedPriority !== 1) {
      return NextResponse.json(
        {
          success: false,
          code: "CLASSIFICATION_MISMATCH",
          message: "Emergency incidents must be submitted with critical priority.",
        },
        { status: 400 },
      )
    }

    if (normalizedIncidentType === "COMMUNITY INCIDENT" && normalizedPriority !== 3) {
      return NextResponse.json(
        {
          success: false,
          code: "CLASSIFICATION_MISMATCH",
          message: "Community / non-emergency incidents must use the standard priority level.",
        },
        { status: 400 },
      )
    }

    // Debug: log coordinates being checked
    console.log('Checking coordinates:', { location_lat, location_lng })
    const withinCity = isWithinTalisayCity(location_lat, location_lng)
    console.log('Within Talisay City:', withinCity)
    
    if (!withinCity) {
      return NextResponse.json({ success: false, code: 'OUT_OF_BOUNDS', message: 'Location must be within Talisay City' }, { status: 400 })
    }

    // Use provided address/barangay initially, geocode in background (non-blocking)
    // This allows us to save the incident immediately and enrich data later
    let resolvedAddress = address ?? null
    let resolvedBarangay = barangay?.toUpperCase() ?? ''
    
    // Start reverse geocoding in background (fire-and-forget) for data enrichment
    // Don't block incident creation on geocoding API response
    const geocodePromise = (async () => {
      try {
        const origin = new URL(request.url).origin
        const reverseUrl = `${origin}/api/geocode/reverse?lat=${encodeURIComponent(String(location_lat))}&lon=${encodeURIComponent(String(location_lng))}&zoom=16&addressdetails=1`

        const [geoData, knownBarangays] = await Promise.all([
          (async () => {
            try {
              const geoRes = await fetch(reverseUrl, { cache: 'no-store' })
              if (!geoRes.ok) return null
              return geoRes.json()
            } catch {
              return null
            }
          })(),
          getKnownBarangaysCached(supabase),
        ])

        if (geoData) {
          const addr = geoData?.address || {}
          const candidate = addr?.suburb || addr?.village || addr?.neighbourhood || addr?.city_district || addr?.quarter || addr?.town || addr?.county
          const normalized = normalizeBarangay(candidate, knownBarangays)
          
          // Return update data if geocoding succeeded
          if (normalized || geoData?.display_name) {
            const updateData: any = {}
            if (normalized) updateData.barangay = normalized
            if (geoData?.display_name) {
              updateData.address = geoData.display_name
            } else if (addr) {
              const line = [addr.road, addr.suburb || addr.village || addr.neighbourhood, addr.city || addr.town || 'Talisay City'].filter(Boolean).join(', ')
              if (line) updateData.address = line
            }
            return updateData
          }
        }
      } catch (geoError) {
        console.warn('Background geocoding failed (non-critical):', geoError)
      }
      return null
    })()
    
    // Don't await - let it run in background
    // We'll use the result to update the incident after creation

    // If photos were uploaded, ensure they exist and move them under processed/ for consistency
    const incomingPhotoPaths: string[] = Array.isArray(photo_urls) && photo_urls.length > 0
      ? photo_urls
      : (photo_url ? [photo_url] : [])

    const processedPhotoPaths: string[] = []

    const ensurePhotoPath = async (storedPath: string): Promise<string> => {
      const cleanedPath = storedPath.trim()
      if (!cleanedPath) return ''

      // If already in processed/, skip verification and return immediately
      if (cleanedPath.startsWith('processed/')) {
        return cleanedPath
      }

      // Quick verification with timeout - don't block on slow storage operations
      try {
        const verifyPromise = supabase.storage.from('incident-photos').createSignedUrl(cleanedPath, 60)
        const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) => 
          setTimeout(() => resolve({ error: { message: 'Verification timeout' } }), 2000)
        )
        
        const result = await Promise.race([verifyPromise, timeoutPromise])
        
        if ('error' in result && result.error) {
          // Only throw if it's a real error, not a timeout
          if (result.error.message !== 'Verification timeout') {
            throw new Error('Uploaded photo not found or inaccessible')
          }
          // Timeout is OK - proceed anyway
        }
      } catch (err: any) {
        // If verification fails, still try to proceed with copy
        if (err?.message !== 'Uploaded photo not found or inaccessible') {
          console.warn('Photo verification issue, proceeding anyway:', err?.message)
        } else {
          throw err
        }
      }

      // Move to processed/ folder (non-blocking - don't fail if this doesn't work)
      const baseName = cleanedPath.split('/').pop() || `${reporter_id}-${Date.now()}.jpg`
      const processedPath = `processed/${baseName}`
      
      try {
        const { error: copyErr } = await supabase
          .storage
          .from('incident-photos')
          .copy(cleanedPath, processedPath)

        if (copyErr) {
          console.warn('Photo copy failed, keeping original path:', copyErr?.message)
          return cleanedPath
        }

        return processedPath
      } catch (err) {
        // If copy fails, just use original path - don't block incident creation
        console.warn('Photo copy error, using original path:', err)
        return cleanedPath
      }
    }

    // Process all photos in parallel for faster submission
    if (incomingPhotoPaths.length > 0) {
      const photoProcessingPromises = incomingPhotoPaths.slice(0, 3).map(async (path) => {
        try {
          return await ensurePhotoPath(path)
        } catch (photoError: any) {
          console.warn('Failed to process uploaded photo:', photoError?.message || photoError)
          return null
        }
      })
      
      const photoResults = await Promise.all(photoProcessingPromises)
      processedPhotoPaths.push(...photoResults.filter((path): path is string => path !== null))
    }

    const primaryPhotoPath = processedPhotoPaths[0] ?? null

    const payload = {
      reporter_id,
      incident_type: normalizedIncidentType,
      description: description.trim(),
      location_lat,
      location_lng,
      address: resolvedAddress,
      barangay: resolvedBarangay || barangay.toUpperCase(),
      city: 'TALISAY CITY',
      province: 'NEGROS OCCIDENTAL',
      status: 'PENDING',
      priority: normalizedPriority,
      severity: mapPriorityToSeverity(String(normalizedPriority)),
      photo_url: primaryPhotoPath,
      photo_urls: processedPhotoPaths.length ? processedPhotoPaths : null,
      voice_url: voice_url || null,
    }

    if (normalizedLocalTimestamp) {
      (payload as any).created_at = normalizedLocalTimestamp
    }

    const { data, error } = await supabase.from('incidents').insert(payload).select().single()
    if (error) throw error
    
    // CRITICAL: Log incident creation in timeline (was missing!)
    try {
      const { logIncidentCreation } = await import('@/lib/incident-timeline')
      await logIncidentCreation(data.id, reporter_id, {
        type: normalizedIncidentType,
        barangay: resolvedBarangay || barangay.toUpperCase(),
        isOffline: is_offline,
        offlineTimestamp: normalizedLocalTimestamp || undefined
      })
      console.log('✅ Incident creation logged in timeline')
    } catch (timelineErr) {
      console.error('❌ Failed to log incident creation in timeline:', timelineErr)
      // Don't fail incident creation if timeline logging fails, but log error
    }
    
    // Update incident with enriched geocoding data if available (non-blocking)
    geocodePromise.then((updateData) => {
      if (updateData && data?.id) {
        supabase
          .from('incidents')
          .update(updateData)
          .eq('id', data.id)
          .then(() => {
            console.log('✅ Incident address/barangay enriched from geocoding')
          })
          .catch((err) => {
            console.warn('⚠️ Failed to update incident with geocoding data (non-critical):', err)
          })
      }
    }).catch(() => {
      // Silently fail - geocoding is non-critical
    })
    
    // Note: Offline status is now handled in logIncidentCreation above
    // NOTE: Notifications are automatically created by database triggers
    // (notify_admins_on_new_incident, notify_barangay_on_new_incident)
    // However, push notifications need to be sent manually since triggers can't send push
    
    // Send push notifications to admins (database records already created by trigger)
    try {
      // First get all admin user IDs
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')

      if (!admins || admins.length === 0) {
        console.log('⚠️ No admin users found')
      } else {
        // Get all admin push subscriptions
        const adminIds = admins.map(admin => admin.id)
        console.log(`[push] Looking for subscriptions for ${adminIds.length} admin(s):`, adminIds)
        
        const { data: adminSubscriptions, error: subError } = await supabase
          .from('push_subscriptions')
          .select('subscription, user_id, endpoint')
          .in('user_id', adminIds)

        if (subError) {
          console.error('[push] Error fetching admin subscriptions:', subError)
          console.log('⚠️ Skipping push notifications due to subscription fetch error')
        } else {
          console.log(`[push] Found ${adminSubscriptions?.length || 0} total subscription(s) for admins`)
          
          // Filter valid subscriptions (must have subscription object with endpoint)
          const validSubscriptions = (adminSubscriptions || []).filter((sub: any) => {
            // Check if subscription exists and has the right structure
            if (!sub.subscription) {
              console.warn(`[push] Subscription missing for admin ${sub.user_id}`)
              return false
            }
            
            // Handle both JSONB object and string formats
            let subscriptionObj = sub.subscription
            if (typeof subscriptionObj === 'string') {
              try {
                subscriptionObj = JSON.parse(subscriptionObj)
              } catch (e) {
                console.warn(`[push] Invalid subscription JSON for admin ${sub.user_id}:`, e)
                return false
              }
            }
            
            // Check if subscription has required fields
            const hasEndpoint = subscriptionObj?.endpoint || sub.endpoint
            const hasKeys = subscriptionObj?.keys?.p256dh && subscriptionObj?.keys?.auth
            
            if (!hasEndpoint || !hasKeys) {
              console.warn(`[push] Invalid subscription structure for admin ${sub.user_id}:`, {
                hasEndpoint: !!hasEndpoint,
                hasKeys: !!hasKeys
              })
              return false
            }
            
            return true
          })
          
          console.log(`[push] Found ${validSubscriptions.length} valid subscription(s) for admins`)
          
          if (validSubscriptions.length > 0) {
            // Log subscription details for debugging
            validSubscriptions.forEach((sub: any) => {
              let subscriptionObj = sub.subscription
              if (typeof subscriptionObj === 'string') {
                try {
                  subscriptionObj = JSON.parse(subscriptionObj)
                } catch (e) {
                  subscriptionObj = null
                }
              }
              
              console.log(`[push] ✅ Valid subscription for admin ${sub.user_id}:`, {
                endpoint: subscriptionObj?.endpoint?.substring(0, 50) + '...' || sub.endpoint?.substring(0, 50) + '...',
                hasKeys: !!(subscriptionObj?.keys?.p256dh && subscriptionObj?.keys?.auth)
              })
            })
          } else {
            console.log('⚠️ No valid push subscriptions found for admins after filtering')
          }
        }

        // Re-filter to ensure we have valid subscriptions (in case of error above)
        const validSubscriptions = (adminSubscriptions || []).filter((sub: any) => {
          if (!sub.subscription) return false
          
          let subscriptionObj = sub.subscription
          if (typeof subscriptionObj === 'string') {
            try {
              subscriptionObj = JSON.parse(subscriptionObj)
            } catch {
              return false
            }
          }
          
          return subscriptionObj?.endpoint && subscriptionObj?.keys?.p256dh && subscriptionObj?.keys?.auth
        })

        if (validSubscriptions && validSubscriptions.length > 0) {
          // Check if VAPID keys are configured before attempting to send
          if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.error('[push] ❌ Cannot send push notifications: VAPID keys not configured')
            console.log('⚠️ Skipping push notifications - incident will still be created')
          } else {
            // Prepare push payload (using relative URLs for production compatibility)
            const payload = {
              title: '🚨 New Incident Reported',
              body: `${data.incident_type} in ${data.barangay}`,
              icon: '/favicon/android-chrome-192x192.png',
              badge: '/favicon/android-chrome-192x192.png',
              tag: 'incident_alert',
              data: {
                incident_id: data.id,
                url: `/admin/incidents/${data.id}`, // Relative URL works in production
                severity: data.severity,
                type: 'incident_alert',
                timestamp: Date.now()
              },
              requireInteraction: true,
              vibrate: [200, 100, 200],
              actions: [
                { action: 'open', title: 'View Incident' },
                { action: 'close', title: 'Dismiss' }
              ],
              renotify: false,
              silent: false
            }

            // Configure webpush if not already configured (only set once per process)
            const vapidEmail = process.env.VAPID_EMAIL || process.env.WEB_PUSH_CONTACT || 'mailto:jlcbelonio.chmsu@gmail.com'
            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            const privateKey = process.env.VAPID_PRIVATE_KEY
            
            if (!publicKey || !privateKey) {
              console.error('[push] ❌ Missing VAPID keys! Push notifications will not work.')
              console.error('[push] Required environment variables:')
              console.error('[push]   - NEXT_PUBLIC_VAPID_PUBLIC_KEY')
              console.error('[push]   - VAPID_PRIVATE_KEY')
              console.error('[push] Generate keys with: npx web-push generate-vapid-keys')
              // Don't throw - allow incident creation to succeed even if push fails
            } else {
              try {
                webpush.setVapidDetails(vapidEmail, publicKey, privateKey)
                console.log('[push] ✅ VAPID keys configured successfully')
              } catch (configError: any) {
                console.error('[push] ❌ Failed to configure VAPID keys:', configError.message)
              }
            }
            
            // Send push notifications directly using webpush (more reliable than HTTP calls)
            const results = await Promise.allSettled(
              validSubscriptions.map(async (sub: any) => {
            try {
              // Ensure subscription is in the correct format
              let subscriptionObj = sub.subscription
              if (typeof subscriptionObj === 'string') {
                subscriptionObj = JSON.parse(subscriptionObj)
              }
              
              // Validate subscription structure
              if (!subscriptionObj?.endpoint || !subscriptionObj?.keys?.p256dh || !subscriptionObj?.keys?.auth) {
                throw new Error('Invalid subscription structure')
              }
              
              console.log(`[push] Sending to admin ${sub.user_id} at ${subscriptionObj.endpoint.substring(0, 50)}...`)
              
              // Send push notification directly using webpush
              const payloadString = JSON.stringify(payload)
              await webpush.sendNotification(
                subscriptionObj as webpush.PushSubscription,
                payloadString
              )
              
              console.log(`[push] ✅ Successfully sent push to admin ${sub.user_id}`)
              return { success: true }
            } catch (error: any) {
              console.error(`[push] ❌ Failed to send push to admin ${sub.user_id}:`, {
                message: error.message,
                statusCode: error.statusCode,
                endpoint: sub.subscription?.endpoint?.substring(0, 50) || 'unknown'
              })
              
              // If subscription expired (410), remove it from database
              if (error.statusCode === 410 && sub.subscription?.endpoint) {
                console.log(`[push] Removing expired subscription for admin ${sub.user_id}`)
                try {
                  await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', sub.subscription.endpoint)
                } catch (deleteError) {
                  console.error('[push] Failed to delete expired subscription:', deleteError)
                }
              }
              
              return { success: false, error: error.message }
            }
              })
            )

            const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
            const failureCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length
            
            if (successCount > 0) {
              console.log(`✅ Push notifications sent to ${successCount}/${validSubscriptions.length} admin device(s)`)
            }
            if (failureCount > 0) {
              console.warn(`⚠️ Failed to send ${failureCount} push notification(s)`)
            }
          }
        } else {
          console.log('⚠️ No active push subscriptions found for admins')
        }
      }
    } catch (pushError) {
      console.error('❌ Push notification error (non-fatal):', pushError)
      // Don't fail the incident creation if push notifications fail
    }

    // Auto-assignment: Try to automatically assign incident to available volunteer
    try {
      const { autoAssignmentService } = await import('@/lib/auto-assignment')
      
      const shouldAutoAssign = await autoAssignmentService.shouldAutoAssign(data.id)
      if (shouldAutoAssign) {
        const assignmentCriteria = {
          incidentId: data.id,
          incidentType: data.incident_type,
          location: {
            lat: data.location_lat,
            lng: data.location_lng
          },
          barangay: data.barangay,
          severity: data.severity || 3,
          requiredSkills: getRequiredSkillsForIncidentType(data.incident_type)
        }

        const assignmentResult = await autoAssignmentService.assignIncident(assignmentCriteria)
        
        if (assignmentResult.success && assignmentResult.assignedVolunteer?.volunteerId) {
          console.log('Auto-assignment successful:', assignmentResult.message)
          // Update the response data to include assignment info
          data.assigned_to = assignmentResult.assignedVolunteer.volunteerId
          data.assigned_at = new Date().toISOString()
          data.status = 'ASSIGNED'
          
          // Send push notification to auto-assigned volunteer
          try {
            const { sendPushToUser } = await import('@/lib/push-notification-helper')
            
            await sendPushToUser(assignmentResult.assignedVolunteer.volunteerId, {
              title: '📋 New Incident Assignment',
              body: `You have been auto-assigned to a ${data.incident_type || 'incident'} in ${data.barangay || 'your area'}`,
              icon: '/favicon/android-chrome-192x192.png',
              badge: '/favicon/android-chrome-192x192.png',
              tag: 'assignment_alert',
              data: {
                incident_id: data.id,
                url: `/volunteer/incident/${data.id}`,
                type: 'assignment_alert',
                timestamp: Date.now()
              },
              requireInteraction: true,
              vibrate: [200, 100, 200],
              actions: [
                { action: 'open', title: 'View Incident' },
                { action: 'close', title: 'Dismiss' }
              ],
              renotify: false,
              silent: false
            })
            console.log('✅ Push notification sent to auto-assigned volunteer')
          } catch (pushErr) {
            console.error('❌ Failed to send push notification to auto-assigned volunteer:', pushErr)
            // Don't fail assignment if push fails
          }
        } else {
          console.log('Auto-assignment failed:', assignmentResult.message)
        }
      }
    } catch (err) {
      console.error('Auto-assignment error:', err)
      // Don't fail the incident creation if auto-assignment fails
    }

    // SMS Fallback: Send confirmation SMS to resident and critical alerts
    try {
      console.log('📱 [SMS] Starting SMS notification process for incident:', data.id)
      
      const { smsService } = await import('@/lib/sms-service')
      const { referenceIdService } = await import('@/lib/reference-id-service')
      
      // Get or create proper reference ID
      const referenceResult = await referenceIdService.getReferenceId(data.id)
      const referenceId = referenceResult.success && referenceResult.referenceId 
        ? referenceResult.referenceId 
        : generateReferenceId(data.id) // Fallback to simple ID
      
      console.log('📱 [SMS] Reference ID:', referenceId)
      
      // Send SMS notifications in background (non-blocking)
      // This allows incident to be saved and displayed immediately
      // SMS will be sent asynchronously without blocking the response
      (async () => {
        try {
          console.log('📱 [SMS] Background SMS task started')
          
          // Get resident phone number - ALWAYS send confirmation to reporter
          const { data: resident, error: residentError } = await supabase
            .from('users')
            .select('phone_number, first_name, last_name, email')
            .eq('id', data.reporter_id)
            .single()

          if (residentError) {
            console.error('❌ [SMS] Error fetching resident:', residentError.message)
          } else {
            console.log('📱 [SMS] Resident data retrieved:', {
              hasResident: !!resident,
              hasPhone: !!resident?.phone_number,
              phonePreview: resident?.phone_number ? resident.phone_number.substring(0, 4) + '****' : 'NONE',
              email: resident?.email || 'N/A',
              name: `${resident?.first_name || ''} ${resident?.last_name || ''}`.trim() || 'N/A'
            })
          }
          
          if (resident?.phone_number) {
            console.log('📱 [SMS] Attempting to send SMS confirmation to resident:', {
              phoneNumber: resident.phone_number,
              residentId: data.reporter_id,
              residentName: `${resident.first_name || ''} ${resident.last_name || ''}`.trim() || resident.email,
              incidentId: data.id,
              referenceId: referenceId
            })
            
            const smsResult = await smsService.sendIncidentConfirmation(
              data.id,
              referenceId,
              resident.phone_number,
              data.reporter_id,
              {
                type: data.incident_type,
                barangay: data.barangay,
                time: new Date(data.created_at).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })
              }
            )

            console.log('📱 [SMS] SMS Result:', smsResult)
            
            if (smsResult.success) {
              console.log('✅ [SMS] SMS confirmation sent to resident:', {
                phone: resident.phone_number.substring(0, 4) + '****',
                referenceId
              })
            } else {
              console.error('❌ [SMS] SMS confirmation FAILED:', {
                error: smsResult.error,
                retryable: smsResult.retryable,
                phoneNumber: resident.phone_number.substring(0, 4) + '****',
                residentId: data.reporter_id,
                incidentType: data.incident_type,
                barangay: data.barangay,
                possibleCauses: [
                  'SMS_ENABLED != true',
                  'SMS_API_KEY not configured',
                  'Phone number not in format 09XXXXXXXXX',
                  'Rate limit exceeded',
                  'Template not found'
                ]
              })
            }
          } else {
            console.log('⚠️ [SMS] No phone number found for resident:', {
              residentId: data.reporter_id,
              hasPhone: !!resident?.phone_number,
              email: resident?.email || 'N/A',
              hint: 'Resident must have a phone number in format 09XXXXXXXXX to receive SMS'
            })
          }

          // ALWAYS send critical alert SMS to admins for ALL incidents (not just high priority)
          const { data: admins } = await supabase
            .from('users')
            .select('id, phone_number')
            .eq('role', 'admin')
            .not('phone_number', 'is', null)

          if (admins && admins.length > 0) {
            const adminPhones = admins.map(admin => admin.phone_number).filter(Boolean)
            const adminUserIds = admins.map(admin => admin.id)

            if (adminPhones.length > 0) {
              const adminSMSResult = await smsService.sendAdminCriticalAlert(
                data.id,
                referenceId,
                adminPhones,
                adminUserIds,
                {
                  type: data.incident_type,
                  barangay: data.barangay,
                  time: new Date(data.created_at).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })
                }
              )

              if (adminSMSResult.success) {
                console.log('✅ Critical alert SMS sent to', adminPhones.length, 'admins')
              } else {
                console.log('❌ Critical alert SMS failed:', adminSMSResult.results)
              }
            }
          } else {
            console.log('⚠️ No admin phone numbers found for SMS alerts')
          }

          // Send barangay alert if incident is in a specific barangay
          if (data.barangay && data.barangay !== 'UNKNOWN') {
            const { data: barangaySecretary } = await supabase
              .from('users')
              .select('id, phone_number')
              .eq('role', 'barangay')
              .ilike('barangay', data.barangay)
              .not('phone_number', 'is', null)
              .single()

            if (barangaySecretary?.phone_number) {
              const barangaySMSResult = await smsService.sendBarangayAlert(
                data.id,
                referenceId,
                barangaySecretary.phone_number,
                barangaySecretary.id,
                {
                  type: data.incident_type,
                  barangay: data.barangay,
                  time: new Date(data.created_at).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })
                }
              )

              if (barangaySMSResult.success) {
                console.log('✅ Barangay alert SMS sent to secretary')
              } else {
                console.log('❌ Barangay alert SMS failed:', barangaySMSResult.error)
              }
            }
          }
        } catch (err) {
          console.error('❌ SMS background error:', err)
          // Don't fail the incident creation if SMS fails
        }
      })() // Fire and forget - don't await
    } catch (smsErr) {
      console.error('❌ SMS setup error (non-fatal):', smsErr)
      // Don't fail the incident creation if SMS setup fails
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('❌ Incident creation failed:', e)
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to create incident' }, { status: 500 })
  }
}





