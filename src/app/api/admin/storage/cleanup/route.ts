/**
 * Storage Cleanup API Endpoint
 * Admin-only endpoint to manually trigger storage cleanup
 */

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { cleanupOldFiles, cleanupOrphanedFiles } from '@/lib/storage-cleanup'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { bucket, maxAgeDays, dryRun = false } = body

    if (!bucket) {
      return NextResponse.json({ 
        success: false, 
        message: 'Bucket name required' 
      }, { status: 400 })
    }

    // Clean up old files
    const result = await cleanupOldFiles({
      bucket,
      maxAgeDays: maxAgeDays || 90,
      dryRun
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: dryRun 
        ? `Would delete ${result.deleted} files (dry run)` 
        : `Deleted ${result.deleted} files, ${result.failed} failed`
    })
  } catch (error: any) {
    console.error('Storage cleanup error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to cleanup storage'
    }, { status: 500 })
  }
}

