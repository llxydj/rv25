import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)

    // After session exchange, decide where to send the user
    try {
      const { data: sessionRes } = await supabase.auth.getSession()
      const session = sessionRes?.session
      const userId = session?.user?.id

      if (session && userId) {
        // If no users row exists, send to resident Google registration
        const { data: userRow } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', userId)
          .maybeSingle()

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
      }
    } catch {
      // Fallback to default redirect below
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL("/login", requestUrl.origin))
}