import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { smsService } from '@/lib/sms-service'

export const dynamic = 'force-dynamic'

/**
 * SMS Health Check Endpoint
 * GET /api/sms/health
 * 
 * Checks SMS service configuration and API connectivity
 */
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    
    if (!uid) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }
    
    // Check if user is admin
    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }
    
    // Get SMS stats to check service health
    const stats = await smsService.getSMSStats()
    
    // Check if SMS is enabled
    const isEnabled = process.env.SMS_ENABLED !== 'false'
    const hasApiKey = !!process.env.SMS_API_KEY
    const hasApiUrl = !!process.env.SMS_API_URL
    
    // Determine health status
    let healthStatus = 'healthy'
    const issues: string[] = []
    
    if (!isEnabled) {
      healthStatus = 'disabled'
      issues.push('SMS service is disabled')
    }
    
    if (!hasApiKey) {
      healthStatus = 'unhealthy'
      issues.push('SMS API key is not configured')
    }
    
    if (!hasApiUrl) {
      healthStatus = 'unhealthy'
      issues.push('SMS API URL is not configured')
    }
    
    // Check recent success rate
    if (stats.totalSent > 0 && stats.successRate < 50) {
      healthStatus = 'degraded'
      issues.push(`Low success rate: ${stats.successRate.toFixed(1)}%`)
    }
    
    return NextResponse.json({
      success: true,
      health: {
        status: healthStatus,
        isEnabled,
        hasApiKey,
        hasApiUrl,
        issues: issues.length > 0 ? issues : undefined,
        stats: {
          totalSent: stats.totalSent,
          successRate: stats.successRate.toFixed(1) + '%',
          failureRate: stats.failureRate.toFixed(1) + '%'
        }
      }
    })
  } catch (error: any) {
    console.error('SMS health check error:', error)
    return NextResponse.json({
      success: false,
      health: {
        status: 'error',
        error: error.message
      }
    }, { status: 500 })
  }
}

