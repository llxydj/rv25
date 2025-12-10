import { NextRequest, NextResponse } from 'next/server'
import { getSimpleServerSupabase } from '@/lib/supabase-server-simple'
import { referenceIdService } from '@/lib/reference-id-service'

/**
 * API route for reference ID operations
 * Uses service role key server-side to bypass RLS
 */

// GET - Get reference ID for an incident
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const incidentId = searchParams.get('incident_id')

    if (!incidentId) {
      return NextResponse.json(
        { success: false, error: 'incident_id parameter is required' },
        { status: 400 }
      )
    }

    const result = await referenceIdService.getReferenceId(incidentId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        referenceId: result.referenceId
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to get reference ID' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in reference ID API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create reference ID for an incident
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { incident_id } = body

    if (!incident_id) {
      return NextResponse.json(
        { success: false, error: 'incident_id is required' },
        { status: 400 }
      )
    }

    const result = await referenceIdService.createReferenceId(incident_id)

    if (result.success) {
      return NextResponse.json({
        success: true,
        referenceId: result.referenceId
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create reference ID' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in reference ID API:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

