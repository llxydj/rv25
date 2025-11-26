import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

let serverClient: SupabaseClient<Database> | null = null

// Simple server client without next/headers - safe for use in both server and client components
export function getSimpleServerSupabase(): SupabaseClient<Database> {
  if (serverClient) {
    return serverClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
      'Please set it in your .env.local file.'
    )
  }

  if (!supabaseKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'Please set it in your .env.local file.'
    )
  }

  serverClient = createClient<Database>(
    supabaseUrl,
    supabaseKey, // Use service role key for full access
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  )

  return serverClient
}