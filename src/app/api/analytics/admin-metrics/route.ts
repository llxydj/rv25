import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
      // Total registered users by role
      supabase
        .from('users')
        .select('role')
        .then(result => {
          if (result.error) throw result.error
          const roles: Record<string, number> = {}
          result.data.forEach(user => {
            roles[user.role] = (roles[user.role] || 0) + 1
          })
          return roles
        }),
      
      // Incidents by barangay with percentages
      supabase
        .from('incidents')
        .select('barangay')
        .then(result => {
          if (result.error) throw result.error
          
          const barangayCounts: Record<string, number> = {}
          result.data.forEach(incident => {
            barangayCounts[incident.barangay] = (barangayCounts[incident.barangay] || 0) + 1
          })
          
          const total = result.data.length
          const sortedBarangays = Object.entries(barangayCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([barangay, count]) => ({
              barangay,
              count,
              percentage: total > 0 ? (count / total * 100).toFixed(1) : '0.0'
            }))
          
          return sortedBarangays
        }),
      
      // System-wide metrics
      Promise.all([
        // Total active residents
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'resident')
          .then(result => {
            if (result.error) throw result.error
            return result.count || 0
          }),
        
        // Total handled incidents
        supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .then(result => {
            if (result.error) throw result.error
            return result.count || 0
          }),
          
        // Active volunteers
        supabase
          .from('users')
          .select('id', { count: 'exact' })
          .eq('role', 'volunteer')
          .contains('volunteer_profiles', { status: 'ACTIVE' })
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
      supabase
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