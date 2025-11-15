import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable")
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable")
}

// Create and export the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Helper function to convert text to uppercase
export const toUpperCase = (text: string): string => {
  return text ? text.toUpperCase() : ""
}

// Helper to validate Philippine mobile number (11 digits starting with 09)
export const isValidPhilippineNumber = (number: string): boolean => {
  return /^09\d{9}$/.test(number)
}

// Helper to format Philippine mobile number
export const formatPhilippineNumber = (number: string): string => {
  // Remove all non-digit characters
  const digits = number.replace(/\D/g, "")

  // If it starts with 0, return as is (if valid)
  if (digits.startsWith("09") && digits.length === 11) {
    return digits
  }

  // If it starts with 63, convert to 0
  if (digits.startsWith("63") && digits.length === 12) {
    return `0${digits.substring(2)}`
  }

  // If it's 10 digits and doesn't start with 0, assume it needs a 0
  if (digits.length === 10 && !digits.startsWith("0")) {
    return `0${digits}`
  }

  // Return original if no formatting applied
  return digits
}
