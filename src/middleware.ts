// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Log only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔥 MIDDLEWARE HIT:', req.nextUrl.pathname)
    const cookieHeader = req.headers.get('cookie') || ''
    const cookieNames = cookieHeader ? cookieHeader.split(';').map(c => c.trim().split('=')[0]).filter(Boolean) : []
    console.log('🍪 ALL COOKIES:', cookieNames.length > 0 ? cookieNames : '[] (cookies may be HttpOnly)')
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
    const error = json.error // Check for deactivation/disabled errors

    // ✅ CRITICAL: Block deactivated/disabled users at middleware level
    // This prevents cached Google sessions from bypassing checks
    if (error && (error === 'Account deactivated' || error === 'Account disabled' || error === 'Account not found')) {
      console.warn('[middleware] Blocking deactivated/disabled user:', req.nextUrl.pathname)
      // Clear any cookies and redirect to login
      const redirect = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url), 302)
      redirect.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      // Clear auth cookies
      redirect.cookies.delete('sb-access-token')
      redirect.cookies.delete('sb-refresh-token')
      return redirect
    }

    // Protect /admin/sms pages
    if (req.nextUrl.pathname.startsWith('/admin/sms')) {
      if (!user || role !== 'admin') {
        return NextResponse.redirect(new URL('/login', req.url))
      }
    }

    // ✅ CRITICAL: Don't redirect logged-in users from /login if they're deactivated
    // The error check above will handle that case
    if (user && !error && req.nextUrl.pathname === '/login') {
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
