/**
 * Image Optimization API
 * Optimizes images before upload to reduce storage and bandwidth
 */

import { NextResponse } from 'next/server'
import { optimizeImageFile } from '@/lib/image-optimization'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, message: 'Invalid file type' }, { status: 400 })
    }

    // Optimize image
    const optimizedBuffer = await optimizeImageFile(file, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 85,
      format: 'jpeg',
      maxSizeBytes: 2 * 1024 * 1024 // 2MB
    })

    // Upload optimized image to temporary location
    const fileName = `optimized/${userRes.user.id}-${Date.now()}.jpg`
    const { data, error: uploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(fileName, optimizedBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('temp-uploads')
      .getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      path: fileName,
      url: publicUrl,
      originalSize: file.size,
      optimizedSize: optimizedBuffer.length,
      compressionRatio: ((1 - optimizedBuffer.length / file.size) * 100).toFixed(1)
    })
  } catch (error: any) {
    console.error('Image optimization error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to optimize image'
    }, { status: 500 })
  }
}

