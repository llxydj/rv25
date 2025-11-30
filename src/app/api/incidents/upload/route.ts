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

    // Get token from Authorization header (mobile sends this reliably, cookies are unreliable)
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error(`❌ [${requestId}] No Authorization header - mobile auth will fail without this`)
      return NextResponse.json({ 
        success: false, 
        code: 'UNAUTHORIZED', 
        message: 'Authorization header required' 
      }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log(`🔑 [${requestId}] Using Authorization header for auth (cookie-independent)`)

    // Verify token using admin client (bypasses cookie issues)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

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

    // Allow common image types - Sharp will convert to JPEG
    if (!ALLOWED.has(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, code: 'UNSUPPORTED_TYPE', message: 'Only image files are allowed (JPEG, PNG, WebP)' }, { status: 415 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Image exceeds 3MB limit' }, { status: 413 })
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    
    // BEST PRACTICE: Compress on server using Sharp (fast server CPU)
    // This is much faster than client-side compression on mobile
    let compressedBuffer: Buffer
    let finalPath: string
    
    try {
      const sharp = (await import('sharp')).default
      const arrayBuf = await file.arrayBuffer()
      const originalSize = arrayBuf.byteLength
      
      console.log(`🖼️ [SERVER] [${requestId}] Compressing image: ${(originalSize / 1024).toFixed(1)}KB`)
      
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
      // Fallback: If Sharp fails, upload original (shouldn't happen)
      console.warn(`⚠️ [SERVER] [${requestId}] Sharp compression failed, uploading original:`, sharpError.message)
      const arrayBuf = await file.arrayBuffer()
      compressedBuffer = Buffer.from(arrayBuf)
      finalPath = `raw/${reporterId}-${Date.now()}.${ext}`
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
      console.error(`❌ [SERVER] [${requestId}] Upload failed after ${uploadTime}ms:`, upErr)
      return NextResponse.json({ success: false, code: 'UPLOAD_FAILED', message: upErr.message }, { status: 500 })
    }

    console.log(`✅ [SERVER] [${requestId}] POST /api/incidents/upload - SUCCESS - Total time: ${uploadTime}ms`)
    console.log(`   - Original: ${file.name} (${file.size} bytes)`)
    console.log(`   - Compressed: ${compressedBuffer.length} bytes`)
    console.log(`   - Path: ${finalPath}\n`)
    
    return NextResponse.json({ success: true, path: finalPath })
  } catch (e: any) {
    const totalTime = Date.now() - startTime
    console.error(`❌ [SERVER] [${requestId}] POST /api/incidents/upload - ERROR after ${totalTime}ms:`, {
      error: e.message,
      stack: e.stack
    })
    console.log(`\n`)
    return NextResponse.json({ success: false, code: 'INTERNAL_ERROR', message: e?.message || 'Failed to upload image' }, { status: 500 })
  }
}
