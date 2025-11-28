import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const BUCKET = 'volunteer-profile-photos'
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }
    const userId = userRes.user.id

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        success: false, 
        code: 'INVALID_FILE_TYPE', 
        message: 'Only JPEG, PNG, and WebP images are allowed' 
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ 
        success: false, 
        code: 'FILE_TOO_LARGE', 
        message: `Max size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB` 
      }, { status: 413 })
    }

    // Delete old profile photo if exists
    const { data: userData } = await supabase
      .from('users')
      .select('profile_photo_url')
      .eq('id', userId)
      .single()

    if (userData?.profile_photo_url) {
      // Extract path from URL
      const oldPath = userData.profile_photo_url.split('/').slice(-2).join('/')
      await supabase.storage.from(BUCKET).remove([oldPath])
    }

    // Upload new photo
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const objectPath = `${userId}/${fileName}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: true,
      } as any)

    if (upErr) throw upErr

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(objectPath)

    // Update user profile with photo URL
    const { error: updateErr } = await supabase
      .from('users')
      .update({ profile_photo_url: urlData.publicUrl })
      .eq('id', userId)

    if (updateErr) throw updateErr

    return NextResponse.json({ 
      success: true, 
      data: { 
        url: urlData.publicUrl,
        path: objectPath 
      } 
    })
  } catch (e: any) {
    console.error('Profile photo upload error:', e)
    return NextResponse.json({ 
      success: false, 
      message: e?.message || 'Failed to upload profile photo' 
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }
    const userId = userRes.user.id

    // Get current photo URL
    const { data: userData } = await supabase
      .from('users')
      .select('profile_photo_url')
      .eq('id', userId)
      .single()

    if (!userData?.profile_photo_url) {
      return NextResponse.json({ success: false, message: 'No profile photo to delete' }, { status: 404 })
    }

    // Extract path from URL
    const photoPath = userData.profile_photo_url.split('/').slice(-2).join('/')

    // Delete from storage
    const { error: delErr } = await supabase.storage
      .from(BUCKET)
      .remove([photoPath])

    if (delErr) throw delErr

    // Update user profile to remove photo URL
    const { error: updateErr } = await supabase
      .from('users')
      .update({ profile_photo_url: null })
      .eq('id', userId)

    if (updateErr) throw updateErr

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Profile photo delete error:', e)
    return NextResponse.json({ 
      success: false, 
      message: e?.message || 'Failed to delete profile photo' 
    }, { status: 500 })
  }
}
