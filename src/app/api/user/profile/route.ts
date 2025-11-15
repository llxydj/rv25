import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  // Initialize Supabase client with cookies
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Get the user's session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // Fetch user profile data including role from users table (app-standard)
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, first_name, last_name, phone_number, address, barangay')
    .eq('id', session.user.id)
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    ...profile,
  })
}