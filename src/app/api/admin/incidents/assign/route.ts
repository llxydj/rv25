import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'
import { Database } from '@/types/supabase'

export const runtime = 'nodejs'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function sanitizeId(id: any) {
  const s = String(id ?? '').split('?')[0].trim()
  if (!s || !/^[0-9a-f-]{36}$/i.test(s)) return null
  return s
}

type IncidentRow = Database['public']['Tables']['incidents']['Row']

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: meAuth } = await supabase.auth.getUser()
    const uid = meAuth?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    // Require admin
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', uid)
      .maybeSingle()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await request.json()
    const cleanIncidentId = sanitizeId(body?.incidentId)
    const cleanVolunteerId = sanitizeId(body?.volunteerId)

    if (!cleanIncidentId || !cleanVolunteerId) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid IDs' }, { status: 400 })
    }

    // Verify incident exists and is assignable
    const { data: incident, error: incErr } = await supabaseAdmin
      .from('incidents')
      .select('id,status,assigned_to')
      .eq('id', cleanIncidentId)
      .maybeSingle()
    if (incErr) return NextResponse.json({ success: false, message: incErr.message }, { status: 400 })
    if (!incident) return NextResponse.json({ success: false, message: 'Incident not found' }, { status: 404 })
    if (incident.status !== 'PENDING') return NextResponse.json({ success: false, message: `Cannot assign incident with status: ${incident.status}` }, { status: 400 })
    if (incident.assigned_to) return NextResponse.json({ success: false, message: 'Incident already assigned' }, { status: 400 })

    // Verify volunteer exists and has volunteer role
    const { data: volunteer, error: volErr } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, role, phone_number')
      .eq('id', cleanVolunteerId)
      .maybeSingle()
    if (volErr) return NextResponse.json({ success: false, message: volErr.message }, { status: 400 })
    if (!volunteer || volunteer.role !== 'volunteer') {
      return NextResponse.json({ success: false, message: 'Volunteer not found or not a volunteer' }, { status: 404 })
    }

    // Perform assignment
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('incidents')
      .update({
        assigned_to: cleanVolunteerId,
        assigned_at: new Date().toISOString(),
        status: 'ASSIGNED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cleanIncidentId)
      .select(`
        *,
        reporter:users!incidents_reporter_id_fkey (
          id, first_name, last_name, email, phone_number
        ),
        assignee:users!incidents_assigned_to_fkey (
          id, first_name, last_name, email, phone_number
        )
      `)
      .maybeSingle()
    if (updErr) return NextResponse.json({ success: false, message: updErr.message }, { status: 400 })

    // Log incident update (best-effort)
    try {
      await supabaseAdmin.from('incident_updates').insert({
        incident_id: cleanIncidentId,
        updated_by: uid,
        previous_status: 'PENDING',
        new_status: 'ASSIGNED',
        notes: `Assigned to volunteer ${volunteer.first_name ?? ''} ${volunteer.last_name ?? ''}`.trim(),
        created_at: new Date().toISOString(),
      })
    } catch { }

    // Notification is automatically created by database trigger:
    // - notify_volunteer_on_assignment() - fires when assigned_to changes
    // No need to manually call notification service to avoid duplicates

    // Send immediate SMS to volunteer (best-effort)
    try {
      if (volunteer.phone_number && updated) {
        const incidentData = updated as unknown as IncidentRow
        const { smsService } = await import('@/lib/sms-service')
        const { referenceIdService } = await import('@/lib/reference-id-service')
        
        // Get reference ID
        const referenceResult = await referenceIdService.getReferenceId(cleanIncidentId)
        const referenceId = referenceResult.success && referenceResult.referenceId 
          ? referenceResult.referenceId 
          : cleanIncidentId.slice(0, 8)
        
        // Send immediate SMS assignment notification
        const smsResult = await smsService.sendVolunteerAssignment(
          cleanIncidentId,
          referenceId,
          volunteer.phone_number,
          cleanVolunteerId,
          {
            type: incidentData.incident_type || 'INCIDENT',
            barangay: incidentData.barangay || 'UNKNOWN',
            time: new Date(incidentData.assigned_at || new Date()).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })
          }
        )
        
        if (smsResult.success) {
          console.log('✅ Immediate SMS assignment sent to volunteer:', cleanVolunteerId)
        } else {
          console.log('⚠️ Failed to send immediate SMS to volunteer:', smsResult.error)
        }
      }
    } catch (smsErr) {
      console.error('Failed to send immediate SMS to volunteer on assignment:', smsErr)
      // Don't fail assignment if SMS fails
    }

    // Start volunteer fallback monitoring to enable SMS backup (best-effort)
    try {
      const { volunteerFallbackService } = await import('@/lib/volunteer-fallback-service')
      await volunteerFallbackService.startFallbackMonitoring(cleanIncidentId, cleanVolunteerId)
    } catch (fallbackErr) {
      console.error('Failed to start volunteer fallback monitoring on manual assignment:', fallbackErr)
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to assign incident' }, { status: 500 })
  }
}
