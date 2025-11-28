import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const BUCKET = 'volunteer-docs'
const ALLOWLIST = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    const userId = userRes.user.id

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const wantSigned = searchParams.get('signed') === '1'

    // If requesting a signed URL for a specific doc
    if (wantSigned && id) {
      const { data: row, error: readOneErr } = await supabase
        .from('volunteer_documents')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (readOneErr) throw readOneErr
      if (!row) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
      const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(row.path, 300)
      if (signErr) return NextResponse.json({ success: false, message: signErr.message }, { status: 400 })
      return NextResponse.json({ success: true, url: signed?.signedUrl })
    }

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
    
    // Handle multiple files - check both 'file' and 'files' keys
    const files: File[] = []
    const fileInput = form.get('file') as File | null
    const filesInput = form.getAll('files') as File[]
    
    if (fileInput) files.push(fileInput)
    if (filesInput.length > 0) files.push(...filesInput)
    
    if (files.length === 0) return NextResponse.json({ success: false, message: 'No files provided' }, { status: 400 })

    const uploaded: any[] = []
    const errors: { fileName: string; reason: string }[] = []

    for (const file of files) {
      try {
        // Validate file type
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const allowedExts = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg']
        if (!allowedExts.includes(ext) && !ALLOWLIST.includes(file.type)) {
          errors.push({ fileName: file.name, reason: 'File type not allowed' })
          continue
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          errors.push({ fileName: file.name, reason: `File too large (max ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB)` })
          continue
        }

        const fileName = `${Date.now()}-${file.name}`
        const objectPath = `${userId}/${fileName}`

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, await file.arrayBuffer(), {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        } as any)
        if (upErr) {
          errors.push({ fileName: file.name, reason: upErr.message })
          continue
        }

        const { data, error } = await supabase
          .from('volunteer_documents')
          .insert({
            user_id: userId,
            path: objectPath,
            file_name: file.name,
            display_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          })
          .select()
          .single()

        if (error) {
          errors.push({ fileName: file.name, reason: error.message })
          continue
        }

        uploaded.push(data)
      } catch (fileErr: any) {
        errors.push({ fileName: file.name, reason: fileErr?.message || 'Upload failed' })
      }
    }

    if (uploaded.length === 0 && errors.length > 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'All files failed to upload',
        errors 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      data: uploaded,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to upload document' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    const userId = userRes.user.id

    const body = await request.json()
    const { id, display_name } = body
    if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 })
    
    if (display_name && display_name.trim() !== '') {
      const { data, error } = await supabase
        .from('volunteer_documents')
        .update({ display_name: display_name.trim() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      if (!data) return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 })
      return NextResponse.json({ success: true, data })
    } else {
      return NextResponse.json({ success: false, message: 'Display name is required' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to update document' }, { status: 500 })
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
