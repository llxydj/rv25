import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const BUCKET = 'incident-voice'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set(['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'audio/webm;codecs=opus'])

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const reporterId = String(form.get('reporter_id') || '')

    // Validate reporter matches session user
    try {
      const supabase = await getServerSupabase()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('Error getting user:', userError)
        return NextResponse.json({ success: false, code: 'AUTH_ERROR', message: 'Failed to validate authentication' }, { status: 500 })
      }
      
      const sessionUserId = user?.id
      if (!sessionUserId) {
        return NextResponse.json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
      }
      
      if (sessionUserId !== reporterId) {
        return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Reporter id does not match authenticated user' }, { status: 403 })
      }
    } catch (authErr) {
      console.error('Error validating session:', authErr)
      return NextResponse.json({ success: false, code: 'AUTH_ERROR', message: 'Failed to validate authentication' }, { status: 500 })
    }

    if (!file) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'File is required' }, { status: 400 })
    }
    if (!reporterId) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'reporter_id is required' }, { status: 400 })
    }

    // Check file type (allow webm with codecs parameter)
    const fileType = file.type.toLowerCase()
    const isAllowed = ALLOWED_TYPES.has(fileType) || fileType.startsWith('audio/')
    
    if (!isAllowed) {
      return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'Only audio files are allowed' }, { status: 415 })
    }
    
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Audio exceeds 5MB limit' }, { status: 413 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'webm'
    const path = `${reporterId}/${Date.now()}.${ext}`

    // Normalize MIME type for Supabase Storage
    // Supabase doesn't accept MIME types with codecs parameter (e.g., audio/webm;codecs=opus)
    // Strip the codecs parameter and use base MIME type
    let contentType = file.type || 'audio/webm'
    if (contentType.includes(';')) {
      contentType = contentType.split(';')[0].trim()
    }
    // Map to supported types
    if (contentType === 'audio/webm' || contentType === 'audio/webm;codecs=opus') {
      contentType = 'audio/webm'
    }

    // Upload to Supabase Storage
    const arrayBuf = await file.arrayBuffer()
    const { error: upErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(path, Buffer.from(arrayBuf), {
        contentType: contentType,
        upsert: false,
        cacheControl: '3600',
      })

    if (upErr) {
      console.error('Voice upload error:', upErr)
      return NextResponse.json({ success: false, code: 'UPLOAD_FAILED', message: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, path })
  } catch (e: any) {
    console.error('Voice upload exception:', e)
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Upload failed' }, { status: 500 })
  }
}

