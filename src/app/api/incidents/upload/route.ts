import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const BUCKET = 'incident-photos'
const MAX_BYTES = 3 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/jpg'])

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const reporterId = String(form.get('reporter_id') || '')

    // Validate reporter matches session user
    try {
      // Debug: Check cookies and headers
      const { cookies, headers } = await import('next/headers')
      const cookieStore = cookies()
      const headersList = headers()
      const allCookies = cookieStore.getAll()
      const authHeader = headersList.get('authorization')
      
      console.log('📝 Cookies received:', allCookies.length, allCookies.map(c => c.name))
      console.log('🔑 Authorization header:', authHeader ? 'Present' : 'Missing')
      
      const supabase = await getServerSupabase()
      
      // Use getUser() instead of getSession() - it validates the JWT from Authorization header
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      console.log('🔍 User error:', userError)
      console.log('🔍 User ID:', user?.id)
      
      if (userError) {
        console.error('Error getting user:', userError)
        return NextResponse.json({ success: false, code: 'AUTH_ERROR', message: 'Failed to validate authentication' }, { status: 500 })
      }
      
      const sessionUserId = user?.id
      if (!sessionUserId) {
        console.warn('❌ No user found - cookies:', allCookies.length)
        return NextResponse.json({ success: false, code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
      }
      
      if (sessionUserId !== reporterId) {
        console.warn('Reporter ID mismatch:', { sessionUserId, reporterId })
        return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Reporter id does not match authenticated user' }, { status: 403 })
      }
      
      console.log('✅ Upload authenticated for user:', sessionUserId)
    } catch (authErr) {
      console.error('Error validating session:', authErr)
      return NextResponse.json({ success: false, code: 'AUTH_ERROR', message: 'Failed to validate authentication' }, { status: 500 })
    }

    if (!file) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'file is required' }, { status: 400 })
    }
    if (!reporterId) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'reporter_id is required' }, { status: 400 })
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'Only JPEG images are allowed' }, { status: 415 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Image exceeds 3MB limit' }, { status: 413 })
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `raw/${reporterId}-${Date.now()}.${ext}`

    const arrayBuf = await file.arrayBuffer()
    const { error: upErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(path, Buffer.from(arrayBuf), {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      })

    if (upErr) {
      return NextResponse.json({ success: false, code: 'UPLOAD_FAILED', message: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, path })
  } catch (e: any) {
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to upload image' }, { status: 500 })
  }
}
