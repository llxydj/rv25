import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin))
    }

    // After session exchange, decide where to send the user
    try {
      const { data: sessionRes, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Error getting session:', sessionError)
        return NextResponse.redirect(new URL("/login?error=session_error", requestUrl.origin))
      }
      
      const session = sessionRes?.session
      const userId = session?.user?.id
      const userEmail = session?.user?.email

      if (session && userId) {
        // Check if this is a new user (no users row exists)
        const { data: userRow, error: userError } = await supabase
          .from('users')
          .select('id, role, email')
          .eq('id', userId)
          .maybeSingle()

        if (userError) {
          console.error('Error checking user row:', userError)
          // If there's an error checking, assume new user and send to registration
          return NextResponse.redirect(new URL("/resident/register-google", requestUrl.origin))
        }

        // If no users row exists, send to resident Google registration
        if (!userRow) {
          return NextResponse.redirect(new URL("/resident/register-google", requestUrl.origin))
        }
        
        // If user exists but has no role, still redirect to registration
        if (userRow && !userRow.role) {
          return NextResponse.redirect(new URL("/resident/register-google", requestUrl.origin))
        }
        
        // If user exists with a role, redirect to appropriate dashboard
        if (userRow?.role) {
          switch (userRow.role) {
            case 'admin':
              return NextResponse.redirect(new URL("/admin/dashboard", requestUrl.origin))
            case 'volunteer':
              return NextResponse.redirect(new URL("/volunteer/dashboard", requestUrl.origin))
            case 'barangay':
              return NextResponse.redirect(new URL("/barangay/dashboard", requestUrl.origin))
            case 'resident':
              return NextResponse.redirect(new URL("/resident/dashboard", requestUrl.origin))
            default:
              // For any other role or no role, redirect to login
              return NextResponse.redirect(new URL("/login", requestUrl.origin))
          }
        }
      } else {
        // No session after exchange - this shouldn't happen, but handle it
        console.warn('No session after code exchange')
        return NextResponse.redirect(new URL("/login?error=no_session", requestUrl.origin))
      }
    } catch (error) {
      // Fallback to default redirect below
      console.error('Unexpected error in callback:', error)
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL("/login", requestUrl.origin))
}