import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const BUCKET = 'volunteer-docs'

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    const userId = userRes.user.id

    const { data, error } = await supabase
      .from('volunteer_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to list documents' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    const userId = userRes.user.id

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ success: false, code: 'FILE_TOO_LARGE', message: `Max size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB` }, { status: 413 })
    }

    const fileName = `${Date.now()}-${file.name}`
    const objectPath = `${userId}/${fileName}`

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    } as any)
    if (upErr) throw upErr

    const { data, error } = await supabase
      .from('volunteer_documents')
      .insert({
        user_id: userId,
        path: objectPath,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to upload document' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    const userId = userRes.user.id

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 })

    const { data: doc, error: readErr } = await supabase
      .from('volunteer_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (readErr) throw readErr

    const { error: delObjErr } = await supabase.storage.from(BUCKET).remove([doc.path])
    if (delObjErr) throw delObjErr

    const { error: delRowErr } = await supabase
      .from('volunteer_documents')
      .delete()
      .eq('id', id)

    if (delRowErr) throw delRowErr

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to delete document' }, { status: 500 })
  }
}
