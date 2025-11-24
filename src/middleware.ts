// src/middleware.ts

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  console.log('🔥 MIDDLEWARE HIT:', req.nextUrl.pathname)
  console.log('🍪 ALL COOKIES:', req.cookies.getAll().map(c => c.name))

  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookies = req.cookies.getAll()
          console.log('🔑 MIDDLEWARE getAll:', cookies.map(c => c.name))
          return cookies
        },
        setAll(cookiesToSet) {
          console.log(
            '🟢 MIDDLEWARE setAll:',
            cookiesToSet.map(c => c.name)
          )

          // Write cookies to req
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))

          res = NextResponse.next({ request: req })

          // Write cookies to response
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: Refresh auth token
  const { data: { user }, error } = await supabase.auth.getUser()
  console.log(
    '👤 MIDDLEWARE USER:',
    user?.id || 'NO USER',
    'ERROR:',
    error?.message || 'none'
  )

  // ✅ NEW: PROTECT /admin/sms ROUTES
  if (req.nextUrl.pathname.startsWith('/admin/sms')) {
    console.log('🔐 SMS ROUTE PROTECTION - Checking admin access')

    // Check if user is authenticated
    if (!user) {
      console.log('❌ No user - redirecting to login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    try {
      // Check if user is admin
      const { data: adminProfile, error: adminError } = await supabase
        .from('admin_profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle()

      console.log('🛡️ Admin check:', {
        userId: user.id,
        isAdmin: !!adminProfile,
        adminRole: adminProfile?.role,
        error: adminError?.message
      })

      if (adminError || !adminProfile) {
        console.log('❌ User is not admin - redirecting to dashboard')
        return NextResponse.redirect(new URL('/admin/dashboard', req.url))
      }

      // User is admin - allow access
      console.log('✅ Admin access granted')
      return res
    } catch (err) {
      console.error('❌ Error checking admin status:', err)
      return NextResponse.redirect(new URL('/admin/dashboard', req.url))
    }
  }

  // If user is logged in and tries to access /login → redirect based on role
  if (user && req.nextUrl.pathname === '/login') {
    try {
      console.log('🔎 Checking user role for redirect…')

      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      console.log('📌 User role result:', userData, 'ERROR:', roleError?.message)

      if (!roleError && userData) {
        switch (userData.role) {
          case 'admin':
            return NextResponse.redirect(new URL('/admin/dashboard', req.url))
          case 'volunteer':
            return NextResponse.redirect(new URL('/volunteer/dashboard', req.url))
          case 'barangay':
            return NextResponse.redirect(new URL('/barangay/dashboard', req.url))
          case 'resident':
            return NextResponse.redirect(new URL('/resident/dashboard', req.url))
          default:
            return NextResponse.redirect(new URL('/resident/register-google', req.url))
        }
      } else {
        return NextResponse.redirect(new URL('/resident/register-google', req.url))
      }
    } catch (err) {
      console.error('❌ Error in middleware role check:', err)
      return NextResponse.redirect(new URL('/resident/register-google', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/login',
    '/admin/sms/:path*', 
    '/api/:path*',
  ],
}