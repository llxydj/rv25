// src/app/api/volunteers/analytics/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';
import { analyticsCache } from './cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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
    await supabase.from('system_logs').insert({
      action: 'admin_api_request',
      user_id: userId,
      details: { endpoint, method, params: params || {} },
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log admin request:', error);
  }
}

/**
 * Get volunteer analytics - SERVER-SIDE implementation
 */
async function getVolunteerAnalytics(
  volunteerId: string,
  startDate?: string,
  endDate?: string,
  limit: number = 50000
) {
  try {
    // Build query
    let query = supabaseAdmin
      .from('incidents')
      .select(`
        id,
        incident_type,
        created_at,
        assigned_at,
        resolved_at,
        status,
        severity,
        barangay
      `)
      .eq('assigned_to', volunteerId);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    
    query = query.limit(limit);

    const { data: incidents, error } = await query;
    if (error) throw error;

    // Get volunteer info
    const { data: volunteer, error: volError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name')
      .eq('id', volunteerId)
      .single();

    if (volError) throw volError;

    const volunteerIncidents = incidents || [];
    const totalResolved = volunteerIncidents.filter(i => i.status === 'RESOLVED').length;

    // Calculate response times
    const responseTimes = volunteerIncidents
      .map(i => {
        if (i.assigned_at && i.resolved_at) {
          return Math.round((new Date(i.resolved_at).getTime() - new Date(i.assigned_at).getTime()) / (1000 * 60));
        }
        return null;
      })
      .filter((t): t is number => t !== null);

    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

    // Group by type
    const incidentsByType: Record<string, number> = {};
    volunteerIncidents.forEach(i => {
      const type = i.incident_type || 'Unknown';
      incidentsByType[type] = (incidentsByType[type] || 0) + 1;
    });

    // Group by severity
    const incidentsBySeverity: Record<string, number> = {};
    volunteerIncidents.forEach(i => {
      const severity = i.severity || 'UNKNOWN';
      incidentsBySeverity[severity] = (incidentsBySeverity[severity] || 0) + 1;
    });

    // Group by status
    const incidentsByStatus: Record<string, number> = {};
    volunteerIncidents.forEach(i => {
      const status = i.status || 'UNKNOWN';
      incidentsByStatus[status] = (incidentsByStatus[status] || 0) + 1;
    });

    // Group by barangay
    const incidentsByBarangay: Record<string, number> = {};
    volunteerIncidents.forEach(i => {
      const barangay = i.barangay || 'Unknown';
      incidentsByBarangay[barangay] = (incidentsByBarangay[barangay] || 0) + 1;
    });

    return {
      success: true,
      data: {
        volunteer_id: volunteerId,
        volunteer_user_id: volunteerId,
        volunteer_name: `${volunteer.first_name} ${volunteer.last_name}`,
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
        total_incidents: volunteerIncidents.length,
        total_resolved: totalResolved,
        average_response_time_minutes: avgResponseTime,
        incidents_by_type: incidentsByType,
        incidents_by_severity: incidentsBySeverity,
        incidents_by_status: incidentsByStatus,
        incidents_by_barangay: incidentsByBarangay
      }
    };
  } catch (error: any) {
    console.error('Error in getVolunteerAnalytics:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Get all volunteers analytics - SERVER-SIDE implementation
 */
async function getAllVolunteersAnalytics(startDate?: string, endDate?: string) {
  try {
    // Get all active volunteers
    const { data: volunteers, error: volError } = await supabaseAdmin
      .from('volunteer_profiles')
      .select('volunteer_user_id')
      .eq('status', 'ACTIVE');

    if (volError) throw volError;

    const volunteerIds = (volunteers || []).map(v => v.volunteer_user_id).filter(Boolean);

    if (volunteerIds.length === 0) {
      return { success: true, data: [] };
    }

    // Get analytics for each volunteer
    const results = await Promise.all(
      volunteerIds.map(id => getVolunteerAnalytics(id, startDate, endDate))
    );

    const successfulResults = results
      .filter(r => r.success && r.data)
      .map(r => r.data);

    return { success: true, data: successfulResults };
  } catch (error: any) {
    console.error('Error in getAllVolunteersAnalytics:', error);
    return { success: false, message: error.message };
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase();
    const { data: userRes } = await supabase.auth.getUser();

    if (!userRes?.user?.id) {
      return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 });
    }

    // Check if admin
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .maybeSingle();

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 });
    }

    // Log request
    const { searchParams } = new URL(request.url);
    const requestParams = Object.fromEntries(searchParams.entries());
    await logAdminRequest(supabase, userRes.user.id, '/api/volunteers/analytics', 'GET', requestParams);

    const volunteerId = requestParams.volunteer_id || null;
    const startDate = requestParams.start_date || undefined;
    const endDate = requestParams.end_date || undefined;
    const exportFormat = requestParams.export || null;
    const limit = requestParams.limit ? parseInt(requestParams.limit) : undefined;

    if (volunteerId) {
      // Try cache
      if (exportFormat !== 'csv') {
        const cached = analyticsCache.get(volunteerId, startDate, endDate);
        if (cached) {
          return NextResponse.json({ success: true, data: cached, cached: true });
        }
      }

      // Get analytics
      const result = await getVolunteerAnalytics(volunteerId, startDate, endDate, limit || 50000);

      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 500 });
      }

      // Normalize fields to match frontend expectations
      const normalized = {
        volunteer_id: result.data.volunteer_user_id || result.data.volunteer_id,
        volunteer_name:
          result.data.volunteer_name ||
          `${result.data.first_name || ''} ${result.data.last_name || ''}`.trim(),
        total_incidents: result.data.total_incidents ?? 0,
        total_resolved: result.data.total_resolved ?? 0,
        average_response_time_minutes: result.data.average_response_time_minutes ?? null,
        incidents_by_type: result.data.incidents_by_type ?? {},
        incidents_by_severity: result.data.incidents_by_severity ?? {},
        incidents_by_status: result.data.incidents_by_status ?? {},
        incidents_by_barangay: result.data.incidents_by_barangay ?? {}
      };

      // Cache 5 min
      if (exportFormat !== 'csv') {
        analyticsCache.set(volunteerId, normalized, 5 * 60 * 1000, startDate, endDate);
      }

      if (exportFormat === 'csv') {
        const csv = exportVolunteerAnalyticsToCSV(normalized);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="volunteer-analytics-${volunteerId}.csv"`
          }
        });
      }

      return NextResponse.json({ success: true, data: normalized });
    }

    // All volunteers analytics
    const result = await getAllVolunteersAnalytics(startDate, endDate);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Volunteer analytics API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (/[,"\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function exportVolunteerAnalyticsToCSV(analytics: any): string {
  const headers = [
    'Volunteer ID',
    'Volunteer Name',
    'Total Incidents',
    'Total Resolved',
    'Average Response Time (minutes)',
    'Incidents by Type',
    'Incidents by Severity',
    'Incidents by Status',
    'Incidents by Barangay'
  ];

  const row = [
    escapeCSVField(analytics.volunteer_id),
    escapeCSVField(analytics.volunteer_name),
    escapeCSVField(analytics.total_incidents),
    escapeCSVField(analytics.total_resolved),
    escapeCSVField(analytics.average_response_time_minutes),
    escapeCSVField(JSON.stringify(analytics.incidents_by_type)),
    escapeCSVField(JSON.stringify(analytics.incidents_by_severity)),
    escapeCSVField(JSON.stringify(analytics.incidents_by_status)),
    escapeCSVField(JSON.stringify(analytics.incidents_by_barangay))
  ];

  return [headers.join(','), row.join(',')].join('\n');
}