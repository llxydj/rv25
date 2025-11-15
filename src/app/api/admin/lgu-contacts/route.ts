import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('lgu_contacts')
      .select('*')
      .order('agency_name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to fetch contacts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { adminId, agency_name, contact_person, contact_number, notes } = await request.json()

    // Verify admin
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single()
    if (adminErr || !admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only admins can create contacts' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('lgu_contacts')
      .insert({ agency_name, contact_person, contact_number, notes })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to create contact' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { adminId, id, agency_name, contact_person, contact_number, notes } = await request.json()

    // Verify admin
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single()
    if (adminErr || !admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only admins can update contacts' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('lgu_contacts')
      .update({ agency_name, contact_person, contact_number, notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to update contact' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { adminId, id } = await request.json()

    // Verify admin
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single()
    if (adminErr || !admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only admins can delete contacts' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('lgu_contacts')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to delete contact' }, { status: 500 })
  }
}
