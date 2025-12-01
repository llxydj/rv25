// src/app/api/analytics/admin-metrics/route.ts

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

// Simple in-memory cache
const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Generate cache key based on parameters
function getCacheKey(params: Record<string, string | undefined>) {
  return 'admin_metrics:' + Object.entries(params)
    .filter(([_, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start') || undefined
    const end = searchParams.get('end') || undefined
    
    const cacheKey = getCacheKey({ start, end })
    const now = Date.now()
    
    // Check cache first
    if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_DURATION) {
      return NextResponse.json({ 
        success: true, 
        data: cache[cacheKey].data,
        cached: true,
        source: 'memory'
      })
    }

    // Fetch all required data in parallel
    const [
      usersByRole,
      incidentsByBarangay,
      systemMetrics,
      volunteerResponseMetrics
    ] = await Promise.all([
      // Total registered users by role - use count queries for accuracy
      Promise.all([
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'volunteer'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'resident'),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'barangay'),
      ]).then(([adminRes, volunteerRes, residentRes, barangayRes]) => {
        if (adminRes.error) throw adminRes.error
        if (volunteerRes.error) throw volunteerRes.error
        if (residentRes.error) throw residentRes.error
        if (barangayRes.error) throw barangayRes.error
        
        return {
          admin: adminRes.count || 0,
          volunteer: volunteerRes.count || 0,
          resident: residentRes.count || 0,
          barangay: barangayRes.count || 0,
        }
      }),
      
      // Incidents by barangay with percentages - get total count first for accurate percentages
      Promise.all([
        supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('incidents').select('barangay')
      ]).then(([totalRes, barangayRes]) => {
        if (totalRes.error) throw totalRes.error
        if (barangayRes.error) throw barangayRes.error
        
        const totalIncidents = totalRes.count || 0
        const barangayCounts: Record<string, number> = {}
        
        // Count incidents by barangay (may be paginated, but we have total count)
        barangayRes.data?.forEach((incident: any) => {
          const barangay = incident.barangay || 'Unknown'
          barangayCounts[barangay] = (barangayCounts[barangay] || 0) + 1
        })
        
        // If we got all incidents (no pagination), use actual counts
        // Otherwise, we'd need to fetch all with pagination, but for now use what we have
        // Note: For very large datasets, consider using SQL aggregation instead
        const sortedBarangays = Object.entries(barangayCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([barangay, count]) => ({
            barangay,
            count,
            percentage: totalIncidents > 0 ? ((count / totalIncidents) * 100).toFixed(1) : '0.0'
          }))
        
        return sortedBarangays
      }),
      
      // System-wide metrics
      Promise.all([
        // Total active residents
        supabaseAdmin
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'resident')
          .then(result => {
            if (result.error) throw result.error
            return result.count || 0
          }),
        
        // Total handled incidents
        supabaseAdmin
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .then(result => {
            if (result.error) throw result.error
            return result.count || 0
          }),
          
        // Active volunteers
        supabaseAdmin
          .from('volunteer_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ACTIVE')
          .then(result => {
            if (result.error) throw result.error
            return result.count || 0
          })
      ]).then(([activeResidents, totalIncidents, activeVolunteers]) => ({
        activeResidents,
        totalIncidents,
        activeVolunteers
      })),
      
      // Volunteer response averages
      supabaseAdmin
        .from('incidents')
        .select('created_at, assigned_at, resolved_at')
        .not('assigned_at', 'is', null)
        .then(result => {
          if (result.error) throw result.error
          
          let totalAssignmentTime = 0
          let totalResolutionTime = 0
          let assignmentCount = 0
          let resolutionCount = 0
          
          result.data.forEach(incident => {
            if (incident.assigned_at) {
              const created = new Date(incident.created_at)
              const assigned = new Date(incident.assigned_at)
              totalAssignmentTime += (assigned.getTime() - created.getTime()) / (1000 * 60) // minutes
              assignmentCount++
            }
            
            if (incident.resolved_at) {
              const created = new Date(incident.created_at)
              const resolved = new Date(incident.resolved_at)
              totalResolutionTime += (resolved.getTime() - created.getTime()) / (1000 * 60) // minutes
              resolutionCount++
            }
          })
          
          return {
            avgAssignmentTime: assignmentCount > 0 ? totalAssignmentTime / assignmentCount : 0,
            avgResolutionTime: resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0,
            totalResolved: resolutionCount
          }
        })
    ])

    const data = {
      usersByRole,
      incidentsByBarangay,
      systemMetrics,
      volunteerResponseMetrics
    }

    // Cache the result
    cache[cacheKey] = { data, timestamp: now }

    return NextResponse.json({ 
      success: true, 
      data,
      cached: false,
      source: 'database'
    })
  } catch (e: any) {
    console.error('Admin metrics error:', e)
    return NextResponse.json({ 
      success: false, 
      code: 'INTERNAL_ERROR', 
      message: e?.message || 'Failed to load admin metrics' 
    }, { status: 500 })
  }
}