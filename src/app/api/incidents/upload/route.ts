//src/app/api/incidents/upload/route.ts

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

const BUCKET = 'incident-photos'
const MAX_BYTES = 3 * 1024 * 1024
// Allow common image types - Sharp will convert to JPEG
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

export async function POST(request: Request) {
  const startTime = Date.now()
  const requestId = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`
  
  try {
    console.log(`\n📤 [SERVER] [${requestId}] POST /api/incidents/upload - Request received at ${new Date().toISOString()}`)
    
    const form = await request.formData()
    const file = form.get('file') as File | null
    const reporterId = String(form.get('reporter_id') || '')
    
    console.log(`📋 [SERVER] [${requestId}] Upload data:`, {
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

    if (userError || !user) {
      console.error(`❌ [${requestId}] Token verification failed:`, userError?.message)
      return NextResponse.json({ 
        success: false, 
        code: 'UNAUTHORIZED', 
        message: 'Invalid or expired token' 
      }, { status: 401 })
    }

    const sessionUserId = user.id
    if (sessionUserId !== reporterId) {
      console.error(`❌ [${requestId}] Reporter ID mismatch:`, { sessionUserId, reporterId })
      return NextResponse.json({ 
        success: false, 
        code: 'FORBIDDEN', 
        message: 'Reporter id does not match authenticated user' 
      }, { status: 403 })
    }

    console.log(`✅ [${requestId}] Authenticated user: ${sessionUserId.substring(0, 8)}...`)

    if (!file) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'file is required' }, { status: 400 })
    }
    if (!reporterId) {
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'reporter_id is required' }, { status: 400 })
    }

    // SECURITY FIX: Validate reporterId is a valid UUID format to prevent path traversal
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(reporterId)) {
      console.error(`❌ [${requestId}] Invalid reporter ID format (potential path traversal attempt):`, reporterId)
      return NextResponse.json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid reporter ID format' }, { status: 400 })
    }

    // Allow common image types - Sharp will convert to JPEG
    if (!ALLOWED.has(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'Only image files are allowed (JPEG, PNG, WebP)' }, { status: 415 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Image exceeds 3MB limit' }, { status: 413 })
    }

    // SECURITY FIX: Sanitize file extension to prevent path traversal
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    
    // BEST PRACTICE: Compress on server using Sharp (fast server CPU)
    // This is much faster than client-side compression on mobile
    let compressedBuffer: Buffer
    let finalPath: string
    
    try {
      const sharp = (await import('sharp')).default
      const arrayBuf = await file.arrayBuffer()
      const originalSize = arrayBuf.byteLength
      
      console.log(`🖼️ [SERVER] [${requestId}] Compressing image: ${(originalSize / 1024).toFixed(1)}KB`)
      
      // SECURITY FIX: Validate file is actually an image using Sharp (magic byte validation)
      // This prevents MIME type spoofing attacks
      let imageMetadata
      try {
        imageMetadata = await sharp(Buffer.from(arrayBuf)).metadata()
        if (!imageMetadata.format || !['jpeg', 'png', 'webp', 'gif'].includes(imageMetadata.format)) {
          console.error(`❌ [${requestId}] Invalid image format detected:`, imageMetadata.format)
          return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'Invalid image file format' }, { status: 415 })
        }
      } catch (metadataError: any) {
        console.error(`❌ [${requestId}] File is not a valid image (magic byte validation failed):`, metadataError.message)
        return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'File is not a valid image' }, { status: 415 })
      }
      
      // Optimized compression for mobile: 800px max, 70% quality = ~40-60KB (good quality, fast upload)
      // Desktop gets better quality: 1280px max, 85% quality
      // Detect from file size (mobile photos are usually smaller)
      const isLikelyMobile = originalSize < 2 * 1024 * 1024 // < 2MB suggests mobile
      const maxDimension = isLikelyMobile ? 800 : 1280  // 800px sufficient for incident photos
      const quality = isLikelyMobile ? 70 : 85  // 70% = ~40-60KB = faster mobile upload
      
      compressedBuffer = await sharp(Buffer.from(arrayBuf))
        .resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: quality,
          mozjpeg: true // Better compression
        })
        .toBuffer()
      
      const compressedSize = compressedBuffer.length
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(0)
      console.log(`✅ [SERVER] [${requestId}] Compressed: ${(compressedSize / 1024).toFixed(1)}KB (${compressionRatio}% smaller)`)
      
      finalPath = `raw/${reporterId}-${Date.now()}.${ext}`
    } catch (sharpError: any) {
      // SECURITY FIX: If Sharp fails, reject the upload (don't allow potentially malicious files)
      console.error(`❌ [SERVER] [${requestId}] Image processing failed:`, sharpError.message)
      return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'Failed to process image file' }, { status: 415 })
    }

    // Upload compressed image to Supabase Storage (Smart CDN)
    const { error: upErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(finalPath, compressedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600', // Cache via Smart CDN
      })

    const uploadTime = Date.now() - startTime
    if (upErr) {
      // SECURITY FIX: Sanitize error messages in production
      const isProduction = process.env.NODE_ENV === 'production'
      console.error(`❌ [SERVER] [${requestId}] Upload failed after ${uploadTime}ms:`, upErr)
      return NextResponse.json({ 
        success: false, 
        code: 'UPLOAD_FAILED', 
        message: isProduction ? 'Failed to upload image' : upErr.message 
      }, { status: 500 })
    }

    console.log(`✅ [SERVER] [${requestId}] POST /api/incidents/upload - SUCCESS - Total time: ${uploadTime}ms`)
    console.log(`   - Original: ${file.name} (${file.size} bytes)`)
    console.log(`   - Compressed: ${compressedBuffer.length} bytes`)
    console.log(`   - Path: ${finalPath}\n`)
    
    return NextResponse.json({ success: true, path: finalPath })
  } catch (e: any) {
    const totalTime = Date.now() - startTime
    // SECURITY FIX: Sanitize error messages in production
    const isProduction = process.env.NODE_ENV === 'production'
    console.error(`❌ [SERVER] [${requestId}] POST /api/incidents/upload - ERROR after ${totalTime}ms:`, {
      error: e.message,
      stack: isProduction ? undefined : e.stack // Don't log stack in production
    })
    console.log(`\n`)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: isProduction ? 'Failed to upload image' : (e?.message || 'Failed to upload image')
    }, { status: 500 })
  }
}
