// File: src/app/api/admin/volunteers/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Create Supabase admin client (server-side with service role key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

/**
 * GET: Fetch all volunteers with their volunteer profiles
 */
export async function GET(request: NextRequest) {
  try {
    const { data: volunteers, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        volunteer_profiles!volunteer_profiles_volunteer_user_id_fkey(*)
      `)
      .eq('role', 'volunteer')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching volunteers:', error)
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: true, data: volunteers || [] },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Unexpected error in GET volunteers:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST: Create a new volunteer (auth user + profile + volunteer profile)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      barangay,
      password,
      skills,
      status,
    } = body

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // ✅ CREATE AUTH USER (server-side admin method)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true, // Auto-confirm email
      }
    )

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { message: authError.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { message: 'Failed to create user account' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // ✅ CREATE USER PROFILE
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        address,
        barangay,
        role: 'volunteer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      // Cleanup: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { message: 'Failed to create profile' },
        { status: 400 }
      )
    }

    // ✅ CREATE VOLUNTEER PROFILE
    const { error: volunteerError } = await supabaseAdmin
      .from('volunteer_profiles')
      .insert({
        volunteer_user_id: userId,
        status: status || 'ACTIVE',
        skills: skills || [],
        assigned_barangays: barangay ? [barangay] : [],
        total_incidents_resolved: 0,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_status_change: new Date().toISOString(),
      })

    if (volunteerError) {
      console.error('Volunteer profile error:', volunteerError)
      // Cleanup on failure
      await supabaseAdmin.from('users').delete().eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { message: 'Failed to create volunteer profile' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        message: 'Volunteer created successfully',
        data: {
          id: userId,
          email,
          firstName,
          lastName,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
