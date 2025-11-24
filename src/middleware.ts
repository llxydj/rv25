// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  console.log('🔥 MIDDLEWARE HIT:', req.nextUrl.pathname)
  console.log('🍪 ALL COOKIES:', req.cookies.getAll().map(c => c.name))

  const res = NextResponse.next()

  // Only call Node API route for auth/role checks
  try {
    const apiRes = await fetch(`${req.nextUrl.origin}/api/auth/check-user`, {
      headers: {
        cookie: req.headers.get('cookie') || '', // forward cookies for SSR auth
      },
    })
    const json = await apiRes.json()

    const user = json.user
    const role = json.role

    // Protect /admin/sms routes
    if (req.nextUrl.pathname.startsWith('/admin/sms')) {
      if (!user || role !== 'admin') {
        console.log('❌ Not admin - redirect to dashboard/login')
        return NextResponse.redirect(new URL('/login', req.url))
      }
    }

    // Redirect logged-in users from /login based on role
    if (user && req.nextUrl.pathname === '/login') {
      switch (role) {
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
    }

  } catch (err) {
    console.error('❌ Middleware auth check error:', err)
    // If API fails, allow next, optionally redirect to login
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
