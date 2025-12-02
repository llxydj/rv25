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

        // Check if this user has a profile row with all required fields
        const { data: userRow, error: checkError } = await supabase
          .from('users')
          .select('id, role, email, first_name, last_name, phone_number, address, barangay, status')
          .eq('id', userId)
          .maybeSingle()

        if (checkError) {
          console.error('Error checking user row:', checkError)
          return NextResponse.redirect(new URL('/login?error=user_check_failed', requestUrl.origin))
        }

        // CRITICAL: Check if user is deactivated
        if (userRow && (userRow as any).status === 'inactive') {
          console.warn('Deactivated user attempted OAuth login:', userId)
          // Sign out the user
          await supabase.auth.signOut()
          return NextResponse.redirect(new URL('/login?error=account_deactivated', requestUrl.origin))
        }

        // If user doesn't have a profile, redirect to registration to complete profile
        if (!userRow) {
          // New Google OAuth user - redirect to registration page to complete profile
          return NextResponse.redirect(new URL('/resident/register-google', requestUrl.origin))
        }

        // Check if profile is complete for residents (all required fields must be present)
        const isProfileComplete = userRow.first_name && 
                                  userRow.last_name && 
                                  userRow.phone_number && 
                                  userRow.address && 
                                  userRow.barangay

        // If profile is incomplete, redirect to registration
        if (!isProfileComplete) {
          console.log('Profile incomplete, redirecting to registration:', {
            userId,
            hasFirstName: !!userRow.first_name,
            hasLastName: !!userRow.last_name,
            hasPhone: !!userRow.phone_number,
            hasAddress: !!userRow.address,
            hasBarangay: !!userRow.barangay
          })
          return NextResponse.redirect(new URL('/resident/register-google', requestUrl.origin))
        }

        // User exists with complete profile - check and assign role if needed
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

        // Determine default redirect based on role
        const defaultRedirects: Record<string, string> = {
          admin: '/admin/dashboard',
          volunteer: '/volunteer/dashboard',
          resident: '/resident/dashboard',
          barangay: '/barangay/dashboard'
        }
        const defaultRedirect = defaultRedirects[userRole] || '/resident/dashboard'

        // Check PIN status (with error handling to prevent blocking OAuth)
        let redirectUrl = defaultRedirect
        
        try {
          const { data: pinData, error: pinError } = await supabase
            .from('users')
            .select('pin_hash, pin_enabled, role')
            .eq('id', userId)
            .single()

          // SKIP PIN CHECK FOR RESIDENTS AND BARANGAY - No PIN required
          // Only check PIN if query succeeded and user is admin or volunteer
          if (!pinError && pinData && pinData.role !== 'barangay' && pinData.role !== 'resident') {
            const pinEnabled = pinData.pin_enabled !== false
            const hasPin = !!pinData.pin_hash

            if (pinEnabled && !hasPin) {
              // Needs PIN setup
              redirectUrl = `/pin/setup?redirect=${encodeURIComponent(defaultRedirect)}`
            } else if (pinEnabled && hasPin) {
              // Needs PIN verification
              redirectUrl = `/pin/verify?redirect=${encodeURIComponent(defaultRedirect)}`
            }
            // If disabled, use default redirect
          }
          // For residents and barangay, always use default redirect (no PIN)
        } catch (pinCheckError) {
          // If PIN check fails, log but don't block OAuth flow
          console.error('[OAuth Callback] PIN check failed, using default redirect:', pinCheckError)
          // Continue with default redirect to ensure OAuth doesn't fail
        }

        return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin))
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