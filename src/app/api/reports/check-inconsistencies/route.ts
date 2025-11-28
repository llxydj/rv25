import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * Log admin API request for audit trail
 */
async function logAdminRequest(
  supabase: any,
  userId: string,
  endpoint: string,
  method: string,
  params?: Record<string, any>
) {
  try {
    await supabase
      .from('system_logs')
      .insert({
        action: 'admin_api_request',
        user_id: userId,
        details: {
          endpoint,
          method,
          params: params || {}
        },
        created_at: new Date().toISOString()
      } as any)
  } catch (error) {
    console.error('Failed to log admin request:', error)
    // Don't fail the request if audit logging fails
  }
}

/**
 * Check all reports for inconsistencies
 * - Reports with missing created_by users
 * - Reports with missing incident_id references
 * - Reports with invalid status values
 * - Reports with missing review information when status is REVIEWED/REJECTED
 */
export async function GET() {
  try {
    const supabase = await getServerSupabase()
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    // Check if user is admin
    const { data: me } = await supabase.from('users').select('role').eq('id', userRes.user.id).maybeSingle()
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    // Log admin API request for audit trail
    await logAdminRequest(supabase, userRes.user.id, '/api/reports/check-inconsistencies', 'GET')

    const inconsistencies: any[] = []

    // Get all reports
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (reportsError) throw reportsError

    // Check for reports with missing created_by users
    const { data: allUserIds } = await supabase.from('users').select('id')
    const validUserIds = new Set((allUserIds || []).map(u => u.id))

    for (const report of reports || []) {
      // Check created_by
      if (report.created_by && !validUserIds.has(report.created_by)) {
        inconsistencies.push({
          report_id: report.id,
          issue: 'MISSING_CREATED_BY_USER',
          message: `Report has invalid created_by user: ${report.created_by}`,
          report_title: report.title
        })
      }

      // Check reviewed_by
      if (report.reviewed_by && !validUserIds.has(report.reviewed_by)) {
        inconsistencies.push({
          report_id: report.id,
          issue: 'MISSING_REVIEWED_BY_USER',
          message: `Report has invalid reviewed_by user: ${report.reviewed_by}`,
          report_title: report.title
        })
      }

      // Check incident_id if present
      if (report.incident_id) {
        const { data: incident } = await supabase
          .from('incidents')
          .select('id')
          .eq('id', report.incident_id)
          .maybeSingle()

        if (!incident) {
          inconsistencies.push({
            report_id: report.id,
            issue: 'MISSING_INCIDENT_REFERENCE',
            message: `Report references non-existent incident: ${report.incident_id}`,
            report_title: report.title
          })
        }
      }

      // Check status consistency
      if (report.status === 'REVIEWED' || report.status === 'REJECTED') {
        if (!report.reviewed_by) {
          inconsistencies.push({
            report_id: report.id,
            issue: 'MISSING_REVIEWER',
            message: `Report status is ${report.status} but reviewed_by is missing`,
            report_title: report.title
          })
        }
        if (!report.reviewed_at) {
          inconsistencies.push({
            report_id: report.id,
            issue: 'MISSING_REVIEW_DATE',
            message: `Report status is ${report.status} but reviewed_at is missing`,
            report_title: report.title
          })
        }
      }

      // Check for reports with invalid report_type
      const validTypes = ['INCIDENT_REPORT', 'ACTIVITY_REPORT', 'SITUATION_REPORT']
      if (!validTypes.includes(report.report_type)) {
        inconsistencies.push({
          report_id: report.id,
          issue: 'INVALID_REPORT_TYPE',
          message: `Report has invalid report_type: ${report.report_type}`,
          report_title: report.title
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total_reports: reports?.length || 0,
        inconsistencies_count: inconsistencies.length,
        inconsistencies
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to check reports'
    }, { status: 500 })
  }
}

