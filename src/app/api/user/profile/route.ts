import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch user profile data including role from users table
    const { data: profile, error } = await supabase
      .from('users')
      .select('role, first_name, last_name, phone_number, address, barangay, profile_photo_url')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      ...profile,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { first_name, last_name, phone_number, address, barangay } = body

    // Validate required fields
    if (!first_name || !last_name) {
      return NextResponse.json(
        { success: false, error: 'First name and last name are required' },
        { status: 400 }
      )
    }

    // Update user profile
    const updateData: any = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
    }

    if (phone_number !== undefined) {
      updateData.phone_number = phone_number ? phone_number.trim() : null
    }
    if (address !== undefined) {
      updateData.address = address ? address.trim() : null
    }
    if (barangay !== undefined) {
      updateData.barangay = barangay ? barangay.trim().toUpperCase() : null
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        ...data,
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
