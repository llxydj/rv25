import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id
    if (!uid) return NextResponse.json({ success: false, code: 'NOT_AUTHENTICATED' }, { status: 401 })

    const { data: roleRow } = await supabase.from('users').select('role').eq('id', uid).maybeSingle()
    if (!roleRow || roleRow.role !== 'admin') {
      return NextResponse.json({ success: false, code: 'FORBIDDEN' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // Get all incidents within the period
    const { data: incidents } = await supabaseAdmin
      .from('incidents')
      .select('id, barangay, location_lat, location_lng, incident_type, status')
      .gte('created_at', startDateStr)
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null)

    if (!incidents || incidents.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          areas: [],
          total_incidents: 0,
          period_days: days
        }
      })
    }

    // Group incidents by barangay and calculate average coordinates
    const areaMap: Record<string, {
      barangay: string
      count: number
      lat: number
      lng: number
      types: Record<string, number>
      statuses: Record<string, number>
    }> = {}

    incidents.forEach((incident: any) => {
      const brgy = incident.barangay || 'Unknown'
      const lat = parseFloat(incident.location_lat)
      const lng = parseFloat(incident.location_lng)

      if (isNaN(lat) || isNaN(lng)) return

      if (!areaMap[brgy]) {
        areaMap[brgy] = {
          barangay: brgy,
          count: 0,
          lat: 0,
          lng: 0,
          types: {},
          statuses: {}
        }
      }

      areaMap[brgy].count++
      // Accumulate coordinates for averaging
      areaMap[brgy].lat += lat
      areaMap[brgy].lng += lng

      // Track types and statuses
      const type = incident.incident_type || 'Unknown'
      areaMap[brgy].types[type] = (areaMap[brgy].types[type] || 0) + 1
      const status = incident.status || 'Unknown'
      areaMap[brgy].statuses[status] = (areaMap[brgy].statuses[status] || 0) + 1
    })

    // Calculate average coordinates and determine risk level
    const areas = Object.values(areaMap).map(area => {
      const avgLat = area.lat / area.count
      const avgLng = area.lng / area.count

      // Determine risk level based on count
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
      if (area.count >= 50) riskLevel = 'CRITICAL'
      else if (area.count >= 30) riskLevel = 'HIGH'
      else if (area.count >= 15) riskLevel = 'MEDIUM'

      return {
        barangay: area.barangay,
        count: area.count,
        lat: avgLat,
        lng: avgLng,
        risk_level: riskLevel,
        top_incident_type: Object.entries(area.types)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown',
        top_type_count: Object.entries(area.types)
          .sort(([, a], [, b]) => b - a)[0]?.[1] || 0,
        status_breakdown: area.statuses
      }
    }).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      data: {
        areas,
        total_incidents: incidents.length,
        period_days: days,
        total_areas: areas.length
      }
    })
  } catch (e: any) {
    console.error('Area map API error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'Failed to fetch area map data' }, { status: 500 })
  }
}

