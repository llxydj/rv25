// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Log only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔥 MIDDLEWARE HIT:', req.nextUrl.pathname)
    console.log('🍪 ALL COOKIES:', req.cookies.getAll().map(c => c.name))
  }

  // Add cache-control headers to prevent 304s for login/forgot-password
  const res = NextResponse.next()
  
  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/forgot-password') {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
  }

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
      const redirectUrl = (() => {
        switch (role) {
          case 'admin':
            return '/admin/dashboard'
          case 'volunteer':
            return '/volunteer/dashboard'
          case 'barangay':
            return '/barangay/dashboard'
          case 'resident':
            return '/resident/dashboard'
          default:
            return '/resident/register-google'
        }
      })()
      
      // Use 302 (Found) instead of 307 to prevent caching issues
      // 302 is better for authentication redirects as it's not cached by default
      const redirect = NextResponse.redirect(new URL(redirectUrl, req.url), 302)
      // Add cache control headers to prevent any caching of redirect
      redirect.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      redirect.headers.set('Pragma', 'no-cache')
      redirect.headers.set('Expires', '0')
      return redirect
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
