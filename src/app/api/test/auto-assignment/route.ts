import { NextResponse } from 'next/server'
import { autoAssignmentTester } from '@/lib/test-auto-assignment'
import { getServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }

    // Run all tests
    const testResults = await autoAssignmentTester.runAllTests()

    return NextResponse.json({
      success: true,
      data: testResults
    })
  } catch (error: any) {
    console.error('Auto-assignment test error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Test failed'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })
    }

    // Run specific test
    const testResults = await autoAssignmentTester.testAutoAssignment()

    return NextResponse.json({
      success: true,
      data: testResults
    })
  } catch (error: any) {
    console.error('Auto-assignment test error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Test failed'
    }, { status: 500 })
  }
}
