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

        // If userRow doesn't exist, this is a NEW user - redirect to registration
        // (Not a deleted account - deleted accounts would have been removed from Auth too)
        if (!userRow) {
          console.log('[OAuth Callback] New Google OAuth user detected - redirecting to registration:', {
            userId,
            email: userEmail
          })
          // CRITICAL: Redirect new Google OAuth users to registration page
          // Use 302 redirect to prevent caching issues
          const redirect = NextResponse.redirect(new URL('/resident/register-google', requestUrl.origin), 302)
          redirect.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
          redirect.headers.set('Pragma', 'no-cache')
          redirect.headers.set('Expires', '0')
          return redirect
        }

        // CRITICAL: Check if user is deactivated
        if ((userRow as any).status === 'inactive') {
          console.warn('Deactivated user attempted OAuth login:', userId)
          // Sign out the user
          await supabase.auth.signOut()
          return NextResponse.redirect(new URL('/login?error=account_deactivated', requestUrl.origin))
        }

        // Check if profile is complete for residents (all required fields must be present)
        const isProfileComplete = userRow.first_name && 
                                  userRow.last_name && 
                                  userRow.phone_number && 
                                  userRow.address && 
                                  userRow.barangay

        // If profile is incomplete, redirect to registration
        if (!isProfileComplete) {
          console.log('[OAuth Callback] Profile incomplete, redirecting to registration:', {
            userId,
            role: userRow.role,
            hasFirstName: !!userRow.first_name,
            hasLastName: !!userRow.last_name,
            hasPhone: !!userRow.phone_number,
            hasAddress: !!userRow.address,
            hasBarangay: !!userRow.barangay
          })
          // CRITICAL: Redirect to registration page with no-cache headers
          const redirect = NextResponse.redirect(new URL('/resident/register-google', requestUrl.origin), 302)
          redirect.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
          redirect.headers.set('Pragma', 'no-cache')
          redirect.headers.set('Expires', '0')
          return redirect
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

        // Determine default redirect based on role (PIN system removed)
        const defaultRedirects: Record<string, string> = {
          admin: '/admin/dashboard',
          volunteer: '/volunteer/dashboard',
          resident: '/resident/dashboard',
          barangay: '/barangay/dashboard'
        }
        const redirectUrl = defaultRedirects[userRole] || '/resident/dashboard'

        // Use 302 redirect with no-cache headers to prevent caching issues
        const redirect = NextResponse.redirect(new URL(redirectUrl, requestUrl.origin), 302)
        redirect.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        redirect.headers.set('Pragma', 'no-cache')
        redirect.headers.set('Expires', '0')
        return redirect
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