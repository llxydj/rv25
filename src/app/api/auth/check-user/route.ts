// src/app/api/auth/check-user/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = req.headers.get('cookie') || ''
          return cookieHeader
            .split(';')
            .map((c) => {
              const [name, ...v] = c.trim().split('=')
              return { name, value: v.join('=') }
            })
        },
        setAll() {
          // Not needed in this API
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ user: null, role: null })
  }

  // ✅ CRITICAL: Check app_metadata.disabled flag (set by admin for OAuth users)
  // This blocks users even if they have cached Google sessions
  if (user.app_metadata?.disabled === true) {
    console.warn('[check-user] User blocked - app_metadata.disabled = true:', user.id)
    return NextResponse.json({ 
      user: null, 
      role: null,
      error: 'Account disabled' 
    })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  // ✅ CRITICAL: Check if user is deactivated in database
  if (profile && profile.status === 'inactive') {
    console.warn('[check-user] User blocked - status = inactive:', user.id)
    return NextResponse.json({ 
      user: null, 
      role: null,
      error: 'Account deactivated' 
    })
  }

  // ✅ CRITICAL: If user row doesn't exist, they were deleted - block access
  if (!profile) {
    console.warn('[check-user] User blocked - no profile found (deleted):', user.id)
    return NextResponse.json({ 
      user: null, 
      role: null,
      error: 'Account not found' 
    })
  }

  return NextResponse.json({ user, role: profile?.role || null })
}
