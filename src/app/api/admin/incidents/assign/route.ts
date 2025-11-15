import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function sanitizeId(id: any) {
  const s = String(id ?? '').split('?')[0].trim()
  if (!s || !/^[0-9a-f-]{36}$/i.test(s)) return null
  return s
}

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
      } as any)
    } catch {}

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to assign incident' }, { status: 500 })
  }
}
