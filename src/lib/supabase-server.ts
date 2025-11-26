import { cookies, headers } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export async function getServerSupabase() {
  const cookieStore = cookies()
  const headersList = headers()
  
  // Check for Authorization header (for API routes where cookies aren't sent)
  const authHeader = headersList.get('authorization')

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Cookie setting may fail in route handlers
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', options)
          } catch {
            // Cookie removal may fail in route handlers
          }
        },
      },
      global: authHeader ? {
        headers: {
          Authorization: authHeader
        }
      } : undefined
    }
  )
}
