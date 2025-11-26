import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { IncidentCreateSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { isWithinTalisayCity } from '@/lib/geo-utils'
import { mapPriorityToSeverity } from '@/lib/incident-utils'
import { normalizeBarangay } from '@/lib/barangay-mapping'
import { getServerSupabase } from '@/lib/supabase-server'
import { analyticsCache } from '@/app/api/volunteers/analytics/cache'

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
    if (role === 'ADMIN') {
      // No additional filter: admin sees all
    } else if (role === 'BARANGAY') {
      // Require barangay filter for barangay users using string field 'barangay'
      if (barangay) {
        query = query.ilike('barangay', barangay.toUpperCase())
      } else {
        // If barangay not provided, return 403 forbidden
        return NextResponse.json({ success: false, code: 'FORBIDDEN_MISSING_SCOPE', message: 'Forbidden: missing barangay scope' }, { status: 403 })
      }
    } else if (role === 'VOLUNTEER') {
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
    } else if (role === 'RESIDENT') {
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
    
    // If status changed, record incident_updates
    if (status && (existing as any)?.status && (existing as any).status !== status) {
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
    // Use service role client to bypass RLS for incident creation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
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

    // Reverse-geocode via internal proxy and normalize barangay
    let resolvedAddress = address ?? null
    let resolvedBarangay = barangay?.toUpperCase() ?? ''
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
        if (normalized) resolvedBarangay = normalized
        const display = geoData?.display_name
        if (display) {
          resolvedAddress = display
        } else if (addr) {
          const line = [addr.road, addr.suburb || addr.village || addr.neighbourhood, addr.city || addr.town || 'Talisay City'].filter(Boolean).join(', ')
          if (line) resolvedAddress = line
        }
      }
    } catch (geoError) {
      console.warn('Geocoding failed, using provided data:', geoError)
    }

    // If photos were uploaded, ensure they exist and move them under processed/ for consistency
    const incomingPhotoPaths: string[] = Array.isArray(photo_urls) && photo_urls.length > 0
      ? photo_urls
      : (photo_url ? [photo_url] : [])

    const processedPhotoPaths: string[] = []

    const ensurePhotoPath = async (storedPath: string): Promise<string> => {
      const cleanedPath = storedPath.trim()
      if (!cleanedPath) return ''

      const { error: signErr } = await supabase
        .storage
        .from('incident-photos')
        .createSignedUrl(cleanedPath, 60)

      if (signErr) {
        throw new Error('Uploaded photo not found or inaccessible')
      }

      if (cleanedPath.startsWith('processed/')) {
        return cleanedPath
      }

      const baseName = cleanedPath.split('/').pop() || `${reporter_id}-${Date.now()}.jpg`
      const processedPath = `processed/${baseName}`
      const { error: copyErr } = await supabase
        .storage
        .from('incident-photos')
        .copy(cleanedPath, processedPath)

      if (copyErr) {
        console.warn('Photo copy failed, keeping original path:', copyErr?.message)
        return cleanedPath
      }

      return processedPath
    }

    for (const path of incomingPhotoPaths.slice(0, 3)) {
      try {
        const ensured = await ensurePhotoPath(path)
        if (ensured) {
          processedPhotoPaths.push(ensured)
        }
      } catch (photoError: any) {
        console.warn('Failed to process uploaded photo:', photoError?.message || photoError)
      }
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
    }

    if (normalizedLocalTimestamp) {
      (payload as any).created_at = normalizedLocalTimestamp
    }

    const { data, error } = await supabase.from('incidents').insert(payload).select().single()
    if (error) throw error
    // If submitted offline, record an incident update for auditing
    if (is_offline && data?.id) {
      try {
        const offlineNote = normalizedLocalTimestamp
          ? `Submitted while offline at ${new Date(normalizedLocalTimestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} and synced when back online.`
          : 'Submitted while offline; synced when back online.'

        await supabase.from('incident_updates').insert({
          incident_id: data.id,
          updated_by: reporter_id,
          previous_status: 'PENDING',
          new_status: 'PENDING',
          notes: offlineNote
        } as any)
      } catch {}
    }
    // Auto-generate notifications via centralized service
    try {
      const { notificationService } = await import('@/lib/notification-service')
      await notificationService.onIncidentCreated({
        id: data.id,
        incident_type: data.incident_type,
        barangay: data.barangay,
        reporter_id: data.reporter_id
      })
    } catch (err) {
      console.error('Failed to create notifications:', err)
      // Don't fail incident creation if notifications fail
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
        
        if (assignmentResult.success) {
          console.log('Auto-assignment successful:', assignmentResult.message)
          // Update the response data to include assignment info
          data.assigned_to = assignmentResult.assignedVolunteer?.volunteerId
          data.assigned_at = new Date().toISOString()
          data.status = 'ASSIGNED'
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
      const { smsService } = await import('@/lib/sms-service')
      const { referenceIdService } = await import('@/lib/reference-id-service')
      
      // Get or create proper reference ID
      const referenceResult = await referenceIdService.getReferenceId(data.id)
      const referenceId = referenceResult.success && referenceResult.referenceId 
        ? referenceResult.referenceId 
        : generateReferenceId(data.id) // Fallback to simple ID
      
      // Get resident phone number - ALWAYS send confirmation to reporter
      const { data: resident, error: residentError } = await supabase
        .from('users')
        .select('phone_number, first_name, last_name, email')
        .eq('id', data.reporter_id)
        .single()

      if (residentError) {
        console.error('❌ Error fetching resident for SMS:', residentError.message)
      } else if (resident?.phone_number) {
        console.log('📱 Attempting to send SMS confirmation to resident:', {
          phoneNumber: resident.phone_number,
          residentId: data.reporter_id,
          residentName: `${resident.first_name || ''} ${resident.last_name || ''}`.trim() || resident.email,
          incidentId: data.id,
          referenceId: referenceId
        })
        
        try {
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

          if (smsResult.success) {
            console.log('✅ SMS confirmation sent to resident:', {
              phone: resident.phone_number.substring(0, 4) + '****',
              referenceId
            })
          } else {
            console.error('❌ SMS confirmation failed:', {
              error: smsResult.error,
              retryable: smsResult.retryable,
              phoneNumber: resident.phone_number.substring(0, 4) + '****',
              residentId: data.reporter_id,
              incidentType: data.incident_type,
              barangay: data.barangay
            })
          }
        } catch (smsError: any) {
          console.error('❌ SMS send exception:', {
            error: smsError.message,
            stack: smsError.stack,
            phoneNumber: resident.phone_number.substring(0, 4) + '****'
          })
        }
      } else {
        console.log('⚠️ No phone number found for resident:', {
          residentId: data.reporter_id,
          hasPhone: !!resident?.phone_number,
          email: resident?.email || 'N/A'
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
      console.error('❌ SMS fallback error:', err)
      // Don't fail the incident creation if SMS fails
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('❌ Incident creation failed:', e)
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to create incident' }, { status: 500 })
  }
}





