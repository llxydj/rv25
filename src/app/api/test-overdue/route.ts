import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Test endpoint to verify overdue incidents functionality
export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabase()
    
    // Test the overdue incidents view
    const { data: overdueView, error: viewError } = await supabase
      .from('overdue_incidents')
      .select('*')
      .limit(5)
    
    if (viewError) {
      console.error('Error querying overdue_incidents view:', viewError)
    }
    
    // Test the is_overdue computed column
    const { data: incidentsWithOverdue, error: incidentError } = await supabase
      .from('incidents')
      .select('id, incident_type, status, created_at, is_overdue')
      .limit(10)
    
    if (incidentError) {
      console.error('Error querying incidents with is_overdue:', incidentError)
    }
    
    // Test the is_incident_overdue function
    const { data: functionTest, error: functionError } = await supabase
      .rpc('is_incident_overdue', { incident_row: { status: 'PENDING', created_at: new Date(Date.now() - 10 * 60000) } })
    
    if (functionError) {
      console.error('Error testing is_incident_overdue function:', functionError)
    }
    
    return NextResponse.json({ 
      success: true,
      overdueView: overdueView || [],
      incidentsWithOverdue: incidentsWithOverdue || [],
      functionTest,
      viewError,
      incidentError,
      functionError
    })
    
  } catch (error: any) {
    console.error('Error in test endpoint:', error)
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Failed to test overdue functionality' 
    }, { status: 500 })
  }
}