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

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  // Check if user is deactivated
  if (profile && profile.status === 'inactive') {
    return NextResponse.json({ 
      user: null, 
      role: null,
      error: 'Account deactivated'
    })
  }

  return NextResponse.json({ user, role: profile?.role || null })
}
