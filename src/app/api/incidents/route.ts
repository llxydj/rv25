import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { IncidentCreateSchema } from '@/lib/validation'
import { rateKeyFromRequest, rateLimitAllowed } from '@/lib/rate-limit'
import { isWithinTalisayCity } from '@/lib/geo-utils'
import { mapPriorityToSeverity } from '@/lib/incident-utils'
import { normalizeBarangay } from '@/lib/barangay-mapping'
import { getServerSupabase } from '@/lib/supabase-server'

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

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)


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
    if (typeof priority === 'number') {
      update.priority = priority
      update.severity = mapPriorityToSeverity(Number(priority))
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

    const { reporter_id, incident_type, description, location_lat, location_lng, address, barangay, priority, photo_url, is_offline, created_at_local } = parsed.data

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
    let nominatimDisplayName: string | null = null
    try {
      const origin = new URL(request.url).origin
      const geoRes = await fetch(`${origin}/api/geocode/reverse?lat=${encodeURIComponent(String(location_lat))}&lon=${encodeURIComponent(String(location_lng))}&zoom=16&addressdetails=1`, { cache: 'no-store' })
      if (geoRes.ok) {
        const geo = await geoRes.json()
        const addr = geo?.address || {}
        const candidate = addr?.suburb || addr?.village || addr?.neighbourhood || addr?.city_district || addr?.quarter || addr?.town || addr?.county
        // Load known barangays from DB
        let knownList: string[] = []
        try {
          const { data: brgys } = await supabase.from('barangays').select('name')
          knownList = Array.isArray(brgys) ? brgys.map((b: any) => b.name) : []
        } catch {}
        const normalized = normalizeBarangay(candidate, knownList)
        if (normalized) resolvedBarangay = normalized
        const display = geo?.display_name
        if (display) { resolvedAddress = display; nominatimDisplayName = display }
        else if (addr) {
          const line = [addr.road, addr.suburb || addr.village || addr.neighbourhood, addr.city || addr.town || 'Talisay City'].filter(Boolean).join(', ')
          if (line) resolvedAddress = line
        }
      }
    } catch (geoError) {
      console.warn('Geocoding failed, using provided data:', geoError)
    }

    // If a photo was uploaded, watermark it with verified fields and store processed version
    let finalPhotoPath: string | null = photo_url ?? null
    if (photo_url) {
      // Verify the referenced object exists and is accessible. If not, reject the request.
      const { data: signed, error: signErr } = await supabase
        .storage
        .from('incident-photos')
        .createSignedUrl(photo_url, 60)

      if (signErr || !signed?.signedUrl) {
        return NextResponse.json({ success: false, code: 'INVALID_PHOTO', message: 'Uploaded photo not found or inaccessible' }, { status: 400 })
      }

      try {
        console.log('Starting photo watermarking with Sharp...')
        const sharp = (await import('sharp')).default
        
        const imgRes = await fetch(signed.signedUrl)
        const arrayBuf = await imgRes.arrayBuffer()
        const imageBuffer = Buffer.from(arrayBuf)
        
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata()
        const width = metadata.width || 800
        const height = metadata.height || 600

        // Compose watermark text
        const timestamp = created_at_local ? new Date(created_at_local).toLocaleString() : new Date().toLocaleString()
        const watermarkText = [
          `Barangay: ${resolvedBarangay || 'N/A'}`,
          `Address: ${nominatimDisplayName || resolvedAddress || 'N/A'}`,
          `Lat: ${location_lat} | Lng: ${location_lng}`,
          `Date & Time: ${timestamp}`,
        ].join('\n')

        console.log('Creating watermark overlay...')
        
        // Create SVG watermark overlay
        const padding = 20
        const fontSize = 16
        const lineHeight = 22
        const lines = watermarkText.split('\n')
        const svgHeight = lines.length * lineHeight + padding * 2
        const svgWidth = Math.min(width - 40, 700)
        
        const svgWatermark = `
          <svg width="${svgWidth}" height="${svgHeight}">
            <rect width="${svgWidth}" height="${svgHeight}" fill="black" opacity="0.7"/>
            ${lines.map((line, i) => `
              <text x="${padding}" y="${padding + (i + 1) * lineHeight}" 
                    font-family="Arial, sans-serif" font-size="${fontSize}" 
                    fill="white" font-weight="bold">
                ${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </text>
            `).join('')}
          </svg>
        `

        console.log('Compositing watermark onto image...')
        
        // Composite watermark onto image
        const processedBuffer = await sharp(imageBuffer)
          .composite([{
            input: Buffer.from(svgWatermark),
            top: height - svgHeight - 20,
            left: 20
          }])
          .jpeg({ quality: 85 })
          .toBuffer()
        
        console.log('Watermark applied successfully!')

        // Build processed path under processed/ with similar filename
        const baseName = photo_url.split('/').pop() || `${reporter_id}-${Date.now()}.jpg`
        const processedPath = `processed/${baseName.replace(/\.[^.]+$/, '')}.jpg`

        // Upload processed image
        const { error: upErr } = await supabase
          .storage
          .from('incident-photos')
          .upload(processedPath, processedBuffer, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          finalPhotoPath = processedPath
        }
      } catch (procErr) {
        console.error('Failed to process uploaded photo:', procErr)
        // Don't fail the incident creation if photo processing fails
        console.warn('Photo processing failed, using original photo')
      }
    }

    const payload = {
      reporter_id,
      incident_type: incident_type.toUpperCase(),
      description: description.trim(),
      location_lat,
      location_lng,
      address: resolvedAddress,
      barangay: resolvedBarangay || barangay.toUpperCase(),
      city: 'TALISAY CITY',
      province: 'NEGROS OCCIDENTAL',
      status: 'PENDING',
      priority,
      severity: mapPriorityToSeverity(Number(priority)),
      photo_url: finalPhotoPath,
    }

    const { data, error } = await supabase.from('incidents').insert(payload).select().single()
    if (error) throw error
    // If submitted offline, record an incident update for auditing
    if (is_offline && data?.id) {
      try {
        await supabase.from('incident_updates').insert({
          incident_id: data.id,
          updated_by: reporter_id,
          previous_status: 'PENDING',
          new_status: 'PENDING',
          notes: 'Submitted while offline; synced when back online.'
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
      const { data: resident } = await supabase
        .from('users')
        .select('phone_number')
        .eq('id', data.reporter_id)
        .single()

      if (resident?.phone_number) {
        console.log('📱 Attempting to send SMS confirmation to resident:', {
          phoneNumber: resident.phone_number,
          residentId: data.reporter_id,
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

        if (smsResult.success) {
          console.log('✅ SMS confirmation sent to resident:', resident.phone_number)
        } else {
          console.log('❌ SMS confirmation failed:', smsResult.error)
          console.log('🔧 SMS Debug Info:', {
            phoneNumber: resident.phone_number,
            residentId: data.reporter_id,
            incidentType: data.incident_type,
            barangay: data.barangay
          })
        }
      } else {
        console.log('⚠️ No phone number found for resident:', data.reporter_id)
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





