import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

// Create a single supabase client for the browser
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

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

// Helper to check if user is within Talisay City boundaries
// This is a simplified version - in production you would use proper geofencing
export const isWithinTalisayCity = (lat: number, lng: number): boolean => {
  // Approximate bounding box for Talisay City, Negros Occidental
  const bounds = {
    north: 10.8, // Northern boundary latitude
    south: 10.6, // Southern boundary latitude
    east: 123.0, // Eastern boundary longitude
    west: 122.8, // Western boundary longitude
  }

  return lat <= bounds.north && lat >= bounds.south && lng <= bounds.east && lng >= bounds.west
}
