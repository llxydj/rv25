// Enhanced Volunteer Reports Endpoint
// This is a NEW endpoint - does NOT modify existing /api/admin/reports/route.ts
// Includes: Profile Completeness, Bio, Enhanced Performance Metrics in reports

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/supabase-server'
import { calculateProfileCompleteness } from '@/lib/profile-completeness'
import { UserWithVolunteerProfile } from '@/types/volunteer'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    
    // Authentication check
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes?.user?.id) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    // Authorization check - admin only
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json' // json, csv
    const includeCompleteness = searchParams.get('include_completeness') !== 'false' // default true
    const includeBio = searchParams.get('include_bio') !== 'false' // default true
    const includeMetrics = searchParams.get('include_metrics') !== 'false' // default true

    // Get all volunteers with enhanced data
    const { data: volunteers, error: volunteersError } = await serviceClient
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone_number,
        address,
        barangay,
        gender,
        emergency_contact_name,
        emergency_contact_phone,
        profile_photo_url,
        created_at,
        last_active,
        volunteer_profiles!volunteer_profiles_volunteer_user_id_fkey (
          status,
          skills,
          availability,
          assigned_barangays,
          total_incidents_resolved,
          bio,
          notes,
          is_available,
          created_at,
          updated_at
        )
      `)
      .eq('role', 'volunteer')
      .order('created_at', { ascending: false })

    if (volunteersError) {
      throw volunteersError
    }

    if (!volunteers || volunteers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total: 0,
          message: 'No volunteers found',
        },
      })
    }

    // Enhance each volunteer with completeness and metrics
    const enhancedVolunteers = await Promise.all(
      volunteers.map(async (volunteer: any) => {
        try {
          const enhanced: any = {
            id: volunteer.id,
            name: `${volunteer.first_name} ${volunteer.last_name}`,
            email: volunteer.email,
            phone: volunteer.phone_number || 'N/A',
            address: volunteer.address || 'N/A',
            barangay: volunteer.barangay || 'N/A',
            gender: volunteer.gender || 'N/A',
            status: volunteer.volunteer_profiles?.status || 'INACTIVE',
            skills: volunteer.volunteer_profiles?.skills || [],
            availability: volunteer.volunteer_profiles?.availability || [],
            assignedBarangays: volunteer.volunteer_profiles?.assigned_barangays || [],
            isAvailable: volunteer.volunteer_profiles?.is_available || false,
            totalIncidentsResolved: volunteer.volunteer_profiles?.total_incidents_resolved || 0,
            createdAt: volunteer.created_at,
            lastActive: volunteer.last_active,
          }

          // Add bio if requested
          if (includeBio) {
            enhanced.bio = volunteer.volunteer_profiles?.bio || 'N/A'
            enhanced.notes = volunteer.volunteer_profiles?.notes || 'N/A'
          }

          // Add profile completeness if requested
          if (includeCompleteness) {
            try {
              const { count: docCount } = await serviceClient
                .from('volunteer_documents')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', volunteer.id)

              const combinedProfile: UserWithVolunteerProfile = {
                ...volunteer,
                role: 'volunteer',
                volunteer_profiles: volunteer.volunteer_profiles || null,
              }

              const completeness = calculateProfileCompleteness(combinedProfile, docCount || 0)
              enhanced.profileCompleteness = {
                score: completeness.score,
                criticalCompleted: completeness.critical.completed,
                criticalTotal: completeness.critical.total,
                importantCompleted: completeness.important.completed,
                importantTotal: completeness.important.total,
                optionalCompleted: completeness.optional.completed,
                optionalTotal: completeness.optional.total,
                missingFields: completeness.allMissing,
              }
            } catch (err) {
              // Graceful degradation - set default values if calculation fails
              console.warn(`Error calculating completeness for volunteer ${volunteer.id}:`, err)
              enhanced.profileCompleteness = {
                score: 0,
                error: 'Could not calculate',
              }
            }
          }

          // Add performance metrics if requested
          if (includeMetrics) {
            try {
              const { count: totalIncidents } = await serviceClient
                .from('incidents')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', volunteer.id)

              const { count: resolvedIncidents } = await serviceClient
                .from('incidents')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', volunteer.id)
                .eq('status', 'RESOLVED')

              enhanced.performanceMetrics = {
                totalIncidents: totalIncidents || 0,
                resolvedIncidents: resolvedIncidents || 0,
                resolutionRate:
                  (totalIncidents || 0) > 0
                    ? Math.round(((resolvedIncidents || 0) / (totalIncidents || 0)) * 10000) / 100
                    : 0,
              }
            } catch (err) {
              console.warn(`Error calculating metrics for volunteer ${volunteer.id}:`, err)
              enhanced.performanceMetrics = {
                error: 'Could not calculate',
              }
            }
          }

          return enhanced
        } catch (err) {
          // Return basic data if enhancement fails
          console.warn(`Error enhancing volunteer ${volunteer.id}:`, err)
          return {
            id: volunteer.id,
            name: `${volunteer.first_name} ${volunteer.last_name}`,
            email: volunteer.email,
            error: 'Could not load enhanced data',
          }
        }
      })
    )

    // Calculate summary statistics
    const summary = {
      total: enhancedVolunteers.length,
      averageCompleteness:
        includeCompleteness && enhancedVolunteers.length > 0
          ? Math.round(
              (enhancedVolunteers
                .filter((v: any) => v.profileCompleteness?.score !== undefined)
                .reduce((sum: number, v: any) => sum + (v.profileCompleteness?.score || 0), 0) /
                enhancedVolunteers.filter((v: any) => v.profileCompleteness?.score !== undefined)
                  .length) *
                100
            ) / 100
          : null,
      totalResolved:
        includeMetrics && enhancedVolunteers.length > 0
          ? enhancedVolunteers.reduce(
              (sum: number, v: any) => sum + (v.performanceMetrics?.resolvedIncidents || 0),
              0
            )
          : null,
      withBio:
        includeBio && enhancedVolunteers.length > 0
          ? enhancedVolunteers.filter((v: any) => v.bio && v.bio !== 'N/A').length
          : null,
    }

    // Format response based on requested format
    if (format === 'csv') {
      // Convert to CSV format
      const headers = Object.keys(enhancedVolunteers[0] || {})
      const csvRows = [
        headers.join(','),
        ...enhancedVolunteers.map((v: any) =>
          headers
            .map((header) => {
              const value = v[header]
              if (value === null || value === undefined) return ''
              if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""')
              return String(value).replace(/"/g, '""')
            })
            .join(',')
        ),
      ]

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="enhanced-volunteers-report.csv"',
        },
      })
    }

    // Default JSON response
    return NextResponse.json({
      success: true,
      data: enhancedVolunteers,
      summary,
      metadata: {
        generatedAt: new Date().toISOString(),
        includes: {
          completeness: includeCompleteness,
          bio: includeBio,
          metrics: includeMetrics,
        },
      },
    })
  } catch (error: any) {
    console.error('Enhanced volunteer reports error:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to generate enhanced report' },
      { status: 500 }
    )
  }
}

