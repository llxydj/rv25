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
    console.warn(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
      'Please set it in your .env.local file.'
    )
    // Return a mock client that will fail gracefully
    return createClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-key',
      { auth: { persistSession: false } }
    )
  }

  if (!supabaseKey) {
    console.warn(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'Reference ID service will not be available. ' +
      'Please set SUPABASE_SERVICE_ROLE_KEY in your .env.local file if you need this feature.'
    )
    // Fallback to anon key if service role key is not available
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!anonKey) {
      console.error('Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is available')
      // Return a mock client that will fail gracefully
      return createClient<Database>(
        supabaseUrl,
        'placeholder-key',
        { auth: { persistSession: false } }
      )
    }
    // Use anon key as fallback (will have RLS restrictions)
    serverClient = createClient<Database>(
      supabaseUrl,
      anonKey,
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