import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { smsService } from '@/lib/sms-service'

export const dynamic = 'force-dynamic'

/**
 * Check SMS delivery status for a specific phone number
 * GET /api/sms/check-status?phone=639707183560
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const phoneNumber = searchParams.get('phone')

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Check delivery status
    const results = await smsService.checkDeliveryStatusByPhone(phoneNumber)

    return NextResponse.json({
      success: true,
      phoneNumber: phoneNumber.substring(0, 4) + '****' + phoneNumber.substring(phoneNumber.length - 2),
      results
    })
  } catch (error: any) {
    console.error('Error checking SMS delivery status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check delivery status' },
      { status: 500 }
    )
  }
}

