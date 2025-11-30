import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LguContactCreateSchema } from '@/lib/validation'

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
    const body = await request.json()
    const { adminId, ...contactData } = body

    // Validate input
    const parsed = LguContactCreateSchema.safeParse(contactData)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: 'Invalid input', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

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
      .insert(parsed.data)
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
    const body = await request.json()
    const { adminId, id, ...contactData } = body

    // Validate input
    const parsed = LguContactCreateSchema.safeParse(contactData)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: 'Invalid input', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

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
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
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
