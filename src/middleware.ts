// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Log only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔥 MIDDLEWARE HIT:', req.nextUrl.pathname)
    console.log('🍪 ALL COOKIES:', req.cookies.getAll().map(c => c.name))
  }

  const res = NextResponse.next()

  // Only run auth logic for pages, not APIs
  try {
    const apiRes = await fetch(`${req.nextUrl.origin}/api/auth/check-user`, {
      headers: {
        cookie: req.headers.get('cookie') || '', // forward cookies for SSR auth
      },
    })

    if (!apiRes.ok) {
      // If API fails, allow navigation but could redirect to /login optionally
      return res
    }

    const json = await apiRes.json()
    const user = json.user
    const role = json.role

    // Protect /admin/sms pages
    if (req.nextUrl.pathname.startsWith('/admin/sms')) {
      if (!user || role !== 'admin') {
        return NextResponse.redirect(new URL('/login', req.url))
      }
    }

    // Redirect logged-in users from /login
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
    // Allow next if auth check fails
  }

  return res
}

export const config = {
  matcher: [
    '/login',
    '/admin/sms/:path*', // protect admin SMS pages only
    // do NOT include /api/* routes
  ],
}
