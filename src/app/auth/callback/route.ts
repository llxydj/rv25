// src/app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore errors in Server Components
            }
          },
        },
      }
    )

    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
    }

    // After session exchange, get the user
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('Error getting user:', userError)
        return NextResponse.redirect(new URL('/login?error=session_error', requestUrl.origin))
      }

      if (user) {
        const userId = user.id
        const userEmail = user.email

        // Check if this user has a profile row
        const { data: userRow, error: checkError } = await supabase
          .from('users')
          .select('id, role, email')
          .eq('id', userId)
          .maybeSingle()

        if (checkError) {
          console.error('Error checking user row:', checkError)
          return NextResponse.redirect(new URL('/login?error=user_check_failed', requestUrl.origin))
        }

        // If user doesn't have a profile, CREATE ONE for Google OAuth users
        if (!userRow) {
          const fullName = user.user_metadata?.full_name || 'Google User'
          const nameParts = fullName.split(' ')
          const firstName = nameParts[0] || 'Google'
          const lastName = nameParts.slice(1).join(' ') || 'User'

          const { error: createError } = await supabase.from('users').insert({
            id: userId,
            email: userEmail,
            first_name: firstName,
            last_name: lastName,
            role: 'resident',
            phone_number: user.user_metadata?.phone_number || '',
            address: '',
            barangay: '',
            city: 'TALISAY CITY',
            province: 'NEGROS OCCIDENTAL',
            confirmation_phrase: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          if (createError) {
            console.error('Error creating user profile:', createError)
            return NextResponse.redirect(new URL('/login?error=profile_creation_failed', requestUrl.origin))
          }

          return NextResponse.redirect(new URL('/resident/dashboard', requestUrl.origin))
        }

        // User exists - check and assign role if needed
        let userRole = userRow.role
        
        if (!userRole) {
          const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'resident' })
            .eq('id', userId)

          if (updateError) {
            console.error('Error updating user role:', updateError)
            return NextResponse.redirect(new URL('/login?error=role_update_failed', requestUrl.origin))
          }
          userRole = 'resident'
        }

        // Redirect based on user role
        switch (userRole) {
          case 'admin':
            return NextResponse.redirect(new URL('/admin/dashboard', requestUrl.origin))
          case 'volunteer':
            return NextResponse.redirect(new URL('/volunteer/dashboard', requestUrl.origin))
          case 'barangay':
            return NextResponse.redirect(new URL('/barangay/dashboard', requestUrl.origin))
          case 'resident':
            return NextResponse.redirect(new URL('/resident/dashboard', requestUrl.origin))
          default:
            return NextResponse.redirect(new URL('/login', requestUrl.origin))
        }
      } else {
        console.warn('No user after code exchange')
        return NextResponse.redirect(new URL('/login?error=no_session', requestUrl.origin))
      }
    } catch (error) {
      console.error('Unexpected error in callback:', error)
      return NextResponse.redirect(new URL('/login?error=unexpected', requestUrl.origin))
    }
  }

  // No code provided - redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}