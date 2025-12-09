// src/app/api/analytics/admin-metrics/route.ts

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin dashboard to bypass RLS and get accurate data
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
      
      // Incidents by barangay with percentages - fetch all with pagination for accuracy
      (async () => {
        // Get total count first
        const totalRes = await supabaseAdmin.from('incidents').select('*', { count: 'exact', head: true })
        if (totalRes.error) throw totalRes.error
        
        const totalIncidents = totalRes.count || 0
        const barangayCounts: Record<string, number> = {}
        
        // Fetch all incidents with pagination to ensure we get accurate counts
        let page = 0
        const pageSize = 1000
        
        while (true) {
          const { data, error } = await supabaseAdmin
            .from('incidents')
            .select('barangay')
            .range(page * pageSize, (page + 1) * pageSize - 1)
          
          if (error) throw error
          if (!data || data.length === 0) break
          
          // Count incidents by barangay
          data.forEach((incident: any) => {
            const barangay = incident.barangay || 'Unknown'
            barangayCounts[barangay] = (barangayCounts[barangay] || 0) + 1
          })
          
          // If we got fewer results than page size, we've reached the end
          if (data.length < pageSize) break
          page++
        }
        
        // Sort and format results
        const sortedBarangays = Object.entries(barangayCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([barangay, count]) => ({
            barangay,
            count,
            percentage: totalIncidents > 0 ? ((count / totalIncidents) * 100).toFixed(1) : '0.0'
          }))
        
        return sortedBarangays
      })(),
      
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
      
      // Volunteer response averages - FIXED: Added pagination to ensure all incidents are included
      (async () => {
        let allIncidents: Array<{ created_at: string; assigned_at: string | null; resolved_at: string | null }> = []
        let page = 0
        const pageSize = 1000
        
        // Fetch all incidents with pagination
        while (true) {
          const { data, error } = await supabaseAdmin
            .from('incidents')
            .select('created_at, assigned_at, resolved_at')
            .not('assigned_at', 'is', null)
            .range(page * pageSize, (page + 1) * pageSize - 1)
          
          if (error) throw error
          if (!data || data.length === 0) break
          
          allIncidents = allIncidents.concat(data)
          if (data.length < pageSize) break
          page++
        }
        
        let totalAssignmentTime = 0
        let totalResolutionTime = 0
        let assignmentCount = 0
        let resolutionCount = 0
        
        // Calculate averages from all incidents
        allIncidents.forEach(incident => {
          if (incident.assigned_at) {
            const created = new Date(incident.created_at)
            const assigned = new Date(incident.assigned_at)
            // Validate dates before calculation
            if (!isNaN(created.getTime()) && !isNaN(assigned.getTime()) && assigned >= created) {
              totalAssignmentTime += (assigned.getTime() - created.getTime()) / (1000 * 60) // minutes
              assignmentCount++
            }
          }
          
          if (incident.resolved_at) {
            const created = new Date(incident.created_at)
            const resolved = new Date(incident.resolved_at)
            // Validate dates before calculation
            if (!isNaN(created.getTime()) && !isNaN(resolved.getTime()) && resolved >= created) {
              totalResolutionTime += (resolved.getTime() - created.getTime()) / (1000 * 60) // minutes
              resolutionCount++
            }
          }
        })
        
        return {
          avgAssignmentTime: assignmentCount > 0 ? Math.round((totalAssignmentTime / assignmentCount) * 100) / 100 : 0, // Round to 2 decimal places
          avgResolutionTime: resolutionCount > 0 ? Math.round((totalResolutionTime / resolutionCount) * 100) / 100 : 0, // Round to 2 decimal places
          totalResolved: resolutionCount
        }
      })()
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