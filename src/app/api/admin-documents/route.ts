import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const BUCKET = 'admin-docs'
const ALLOWLIST = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg']

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })
    const uid = userRes.user.id
    // Admin-only access
    const { data: me } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!me || me.role !== 'admin') return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const folder_id = searchParams.get('folder_id')
    const id = searchParams.get('id')
    const wantSigned = searchParams.get('signed') === '1'

    // If requesting a signed URL for a specific doc
    if (wantSigned && id) {
      const { data: row, error: readOneErr } = await supabase
        .from('admin_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (readOneErr) throw readOneErr
      if (!row) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
      const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(row.path, 300)
      if (signErr) return NextResponse.json({ success: false, message: signErr.message }, { status: 400 })
      return NextResponse.json({ success: true, url: signed?.signedUrl })
    }

    let query = supabase.from('admin_documents').select('*').order('created_at', { ascending: false })
    if (folder_id) query = query.eq('folder_id', folder_id)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to list documents' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })
    const userId = userRes.user.id
    // Admin-only
    const { data: me } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
    if (!me || me.role !== 'admin') return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })

    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder_id = form.get('folder_id') as string | null
    if (!file) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'No file provided' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE_BYTES) return NextResponse.json({ success: false, code: 'FILE_TOO_LARGE', message: 'Max size is 10MB' }, { status: 413 })
    if (ALLOWLIST.length && !ALLOWLIST.includes(file.type)) return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'File type not allowed' }, { status: 415 })

    const objectName = `${userId}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectName, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    } as any)
    if (upErr) throw upErr

    const { data, error } = await supabase
      .from('admin_documents')
      .insert({ user_id: userId, path: objectName, file_name: file.name, mime_type: file.type, size_bytes: file.size, folder_id: folder_id || null })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to upload document' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED', message: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Missing id' }, { status: 400 })

    const { data: row, error: readErr } = await supabase
      .from('admin_documents')
      .select('*')
      .eq('id', id)
      .single()
    if (readErr) throw readErr

    const { error: delObjErr } = await supabase.storage.from(BUCKET).remove([row.path])
    if (delObjErr) throw delObjErr

    const { error: delRowErr } = await supabase
      .from('admin_documents')
      .delete()
      .eq('id', id)
    if (delRowErr) throw delRowErr

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to delete document' }, { status: 500 })
  }
}
