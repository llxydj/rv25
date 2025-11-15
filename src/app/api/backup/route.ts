import { NextResponse } from 'next/server'
import { backupService } from '@/lib/backup-service'
import { supabase } from '@/lib/supabase'

// POST /api/backup - Trigger a manual backup
export async function POST(request: Request) {
  try {
    // In a real implementation, you would authenticate the request
    // For now, we'll allow anyone to trigger a backup for testing
    
    const { success, message } = await backupService.performBackup()
    
    if (success) {
      return NextResponse.json({ success: true, message })
    } else {
      return NextResponse.json({ success: false, message }, { status: 500 })
    }
  } catch (error) {
    console.error('Backup API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/backup/status - Get backup status
export async function GET(request: Request) {
  try {
    // Get recent backup logs
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .or('action.eq.BACKUP_SUCCESS,action.eq.BACKUP_FAILURE,action.eq.BACKUP_ALERT')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch backup status' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, logs: data })
  } catch (error) {
    console.error('Backup status API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}