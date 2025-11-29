// Enhanced Volunteer Analytics Endpoint
// This is a NEW endpoint - does NOT modify existing /api/admin/analytics/volunteers/route.ts
// Includes: Profile Completeness, Performance Metrics, Training History, etc.

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
    const section = searchParams.get('section') || 'overview'
    const volunteerId = searchParams.get('volunteer_id') // Optional: for single volunteer

    // If volunteer_id is provided, return enhanced analytics for that volunteer
    if (volunteerId) {
      return await getSingleVolunteerEnhancedAnalytics(volunteerId)
    }

    // Aggregate enhanced analytics for all volunteers
    return await getAllVolunteersEnhancedAnalytics(section)
  } catch (error: any) {
    console.error('Enhanced volunteer analytics error:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to load enhanced analytics' },
      { status: 500 }
    )
  }
}

async function getSingleVolunteerEnhancedAnalytics(volunteerId: string) {
  try {
    // Get volunteer user data
    const { data: userData, error: userError } = await serviceClient
      .from('users')
      .select('*')
      .eq('id', volunteerId)
      .eq('role', 'volunteer')
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, message: 'Volunteer not found' },
        { status: 404 }
      )
    }

    // Get volunteer profile (handle case where profile doesn't exist)
    const { data: profileData, error: profileError } = await serviceClient
      .from('volunteer_profiles')
      .select('*')
      .eq('volunteer_user_id', volunteerId)
      .maybeSingle()

    // Ignore profile error if profile doesn't exist (volunteer might not have profile yet)
    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('Profile fetch error (non-critical):', profileError)
    }

    // Get document count (handle errors gracefully)
    let documentCount = 0
    try {
      const { count } = await serviceClient
        .from('volunteer_documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', volunteerId)
      documentCount = count || 0
    } catch (docError) {
      console.warn('Document count error (non-critical):', docError)
      documentCount = 0
    }

    // Combine for completeness calculation
    const combinedProfile: UserWithVolunteerProfile = {
      ...userData,
      role: 'volunteer',
      volunteer_profiles: profileData || null,
    }

    // Calculate profile completeness (handle errors gracefully)
    let completeness
    try {
      completeness = calculateProfileCompleteness(combinedProfile, documentCount)
    } catch (calcError) {
      console.warn('Completeness calculation error:', calcError)
      // Return default completeness if calculation fails
      completeness = {
        score: 0,
        critical: { completed: 0, total: 6, missing: [] },
        important: { completed: 0, total: 4, missing: [] },
        optional: { completed: 0, total: 4, missing: [] },
        allMissing: [],
      }
    }

    // Get performance metrics (handle errors gracefully)
    let resolvedCount = 0
    let totalCount = 0
    try {
      const { data: incidents, error: incidentsError } = await serviceClient
        .from('incidents')
        .select('id, status, assigned_at, resolved_at, created_at')
        .eq('assigned_to', volunteerId)

      if (incidentsError) {
        console.warn('Incidents fetch error (non-critical):', incidentsError)
      } else {
        resolvedCount = incidents?.filter((i: any) => i.status === 'RESOLVED').length || 0
        totalCount = incidents?.length || 0
      }
    } catch (metricsError) {
      console.warn('Performance metrics error (non-critical):', metricsError)
    }

    return NextResponse.json({
      success: true,
      data: {
        volunteer: {
          id: userData.id,
          name: `${userData.first_name} ${userData.last_name}`,
          email: userData.email,
        },
        profileCompleteness: completeness,
        performance: {
          totalIncidents: totalCount,
          resolvedIncidents: resolvedCount,
          resolutionRate: totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching single volunteer enhanced analytics:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to fetch volunteer analytics' },
      { status: 500 }
    )
  }
}

async function getAllVolunteersEnhancedAnalytics(section: string) {
  try {
    // Get all volunteers with their profiles
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
          total_incidents_resolved,
          bio,
          notes,
          is_available
        )
      `)
      .eq('role', 'volunteer')

    if (volunteersError) throw volunteersError

    if (!volunteers || volunteers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalVolunteers: 0,
          profileCompleteness: {
            average: 0,
            distribution: { low: 0, medium: 0, high: 0 },
          },
          performance: {
            averageResolutionRate: 0,
            totalResolved: 0,
          },
        },
      })
    }

    // Calculate profile completeness for all volunteers
    const completenessScores: number[] = []
    let totalResolved = 0
    let totalIncidents = 0

    for (const volunteer of volunteers) {
      try {
        // Get document count for this volunteer
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
        completenessScores.push(completeness.score)

        // Get incident stats (handle errors gracefully)
        try {
          const { count: incidentCount } = await serviceClient
            .from('incidents')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', volunteer.id)

          const { count: resolvedCount } = await serviceClient
            .from('incidents')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', volunteer.id)
            .eq('status', 'RESOLVED')

          totalIncidents += incidentCount || 0
          totalResolved += resolvedCount || 0
        } catch (incidentError) {
          console.warn(`Error fetching incidents for volunteer ${volunteer.id}:`, incidentError)
          // Continue with other volunteers
        }
      } catch (err) {
        // Skip this volunteer if there's an error (graceful degradation)
        console.warn(`Error processing volunteer ${volunteer.id}:`, err)
        continue
      }
    }

    // Calculate aggregate metrics
    const averageCompleteness =
      completenessScores.length > 0
        ? completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length
        : 0

    const distribution = {
      low: completenessScores.filter((s) => s < 50).length,
      medium: completenessScores.filter((s) => s >= 50 && s < 80).length,
      high: completenessScores.filter((s) => s >= 80).length,
    }

    const averageResolutionRate =
      totalIncidents > 0 ? (totalResolved / totalIncidents) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        totalVolunteers: volunteers.length,
        profileCompleteness: {
          average: Math.round(averageCompleteness * 100) / 100,
          distribution,
          scores: completenessScores, // Optional: include individual scores
        },
        performance: {
          averageResolutionRate: Math.round(averageResolutionRate * 100) / 100,
          totalResolved,
          totalIncidents,
        },
        volunteersWithBio: volunteers.filter(
          (v: any) => v.volunteer_profiles?.bio?.trim()
        ).length,
        volunteersWithCompleteProfiles: distribution.high,
      },
    })
  } catch (error: any) {
    console.error('Error fetching all volunteers enhanced analytics:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to fetch enhanced analytics' },
      { status: 500 }
    )
  }
}

