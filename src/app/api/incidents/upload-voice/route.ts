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
  const requestId = `voice-${Date.now()}-${Math.random().toString(36).substring(7)}`
  
  try {
    console.log(`\n🎤 [SERVER] [${requestId}] POST /api/incidents/upload-voice - Request received at ${new Date().toISOString()}`)
    
    const form = await request.formData()
    const file = form.get('file') as File | null
    const reporterId = String(form.get('reporter_id') || '')

    console.log(`📋 [SERVER] [${requestId}] Voice upload data:`, {
      hasFile: !!file,
      fileName: file?.name || 'N/A',
      fileSize: file?.size || 0,
      fileType: file?.type || 'N/A',
      reporterId: reporterId.substring(0, 8) + '...'
    })

    // Get token from Authorization header (preferred) or fallback to cookies/session
    const authHeader = request.headers.get('authorization')
    let token: string | null = null
    let user: any = null
    let userError: any = null
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '')
      console.log(`🔑 [${requestId}] Using Authorization header for auth`)
      // Verify token using admin client
      const result = await supabaseAdmin.auth.getUser(token)
      user = result.data?.user
      userError = result.error
    } else {
      // FALLBACK: Try to get session from cookies (for background uploads when token retrieval times out)
      console.log(`⚠️ [${requestId}] No Authorization header, trying cookie-based session...`)
      try {
        const supabase = await getServerSupabase()
        const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser()
        if (sessionUser && !sessionError) {
          user = sessionUser
          console.log(`✅ [${requestId}] Got user from cookie-based session`)
        } else {
          userError = sessionError || new Error('No session found in cookies')
        }
      } catch (cookieErr: any) {
        console.error(`❌ [${requestId}] Cookie-based session also failed:`, cookieErr?.message)
        userError = cookieErr
      }
    }

    if (!token && !user) {
      console.error(`❌ [${requestId}] No Authorization header and no cookie session - auth failed`)
      return NextResponse.json({ 
        success: false, 
        code: 'UNAUTHORIZED', 
        message: 'Authentication required (token or session)' 
      }, { status: 401 })
    }

    const sessionUserId = user?.id
    if (!sessionUserId) {
      console.error(`❌ [${requestId}] No user ID found`)
      return NextResponse.json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
    }
    
    if (sessionUserId !== reporterId) {
      console.error(`❌ [${requestId}] Reporter ID mismatch:`, { sessionUserId, reporterId })
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Reporter id does not match authenticated user' }, { status: 403 })
    }

    console.log(`✅ [${requestId}] Authenticated user: ${sessionUserId.substring(0, 8)}...`)

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
    const uploadStart = Date.now()
    console.log(`📤 [${requestId}] Uploading voice to storage bucket: ${BUCKET}, path: ${path}`)
    
    const arrayBuf = await file.arrayBuffer()
    const { error: upErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(path, Buffer.from(arrayBuf), {
        contentType: contentType,
        upsert: false,
        cacheControl: '3600',
      })

    const uploadTime = Date.now() - uploadStart
    console.log(`⏱️  [${requestId}] Storage upload: ${uploadTime}ms`)

    if (upErr) {
      console.error(`❌ [${requestId}] Voice upload error:`, upErr)
      return NextResponse.json({ success: false, code: 'UPLOAD_FAILED', message: upErr.message }, { status: 500 })
    }

    console.log(`✅ [${requestId}] Voice uploaded successfully: ${path}`)
    return NextResponse.json({ success: true, path })
  } catch (e: any) {
    console.error(`❌ [${requestId}] Voice upload exception:`, e)
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Upload failed' }, { status: 500 })
  }
}

