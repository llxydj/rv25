import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely formats a user's full name from first and last name fields
 * Handles null, undefined, and partial names gracefully
 * 
 * @param user - User object with optional first_name and last_name
 * @param fallback - Text to display if no name available (default: "Anonymous")
 * @returns Formatted name or fallback text
 * 
 * @example
 * formatUserName({ first_name: 'John', last_name: 'Doe' }) // "John Doe"
 * formatUserName({ first_name: 'John', last_name: null }) // "John"
 * formatUserName({ first_name: null, last_name: null }) // "Anonymous"
 * formatUserName(null, "Unknown User") // "Unknown User"
 */
export function formatUserName(
  user: { first_name?: string | null; last_name?: string | null } | null | undefined,
  fallback: string = "Anonymous"
): string {
  if (!user) return fallback
  
  const parts = [user.first_name, user.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : fallback
}

/**
 * Generates initials from a user's name for avatar display
 * 
 * @param user - User object with optional first_name and last_name
 * @param fallback - Initials to display if no name available (default: "?")
 * @returns Two-character initials or fallback
 * 
 * @example
 * formatUserInitials({ first_name: 'John', last_name: 'Doe' }) // "JD"
 * formatUserInitials({ first_name: 'John', last_name: null }) // "J?"
 * formatUserInitials({ first_name: null, last_name: null }) // "??"
 */
export function formatUserInitials(
  user: { first_name?: string | null; last_name?: string | null } | null | undefined,
  fallback: string = "?"
): string {
  if (!user) return fallback.repeat(2)
  
  const first = user.first_name?.[0]?.toUpperCase() || fallback
  const last = user.last_name?.[0]?.toUpperCase() || fallback
  return `${first}${last}`
}

/**
 * Safely formats contact information with fallback text
 * 
 * @param value - Contact info value (email, phone, etc.)
 * @param fallback - Text to display if value is empty/null
 * @returns Value or fallback text
 * 
 * @example
 * formatContactInfo('user@example.com', 'No email') // "user@example.com"
 * formatContactInfo(null, 'No email') // "No email"
 * formatContactInfo('', 'No email') // "No email"
 */
export function formatContactInfo(
  value: string | null | undefined,
  fallback: string
): string {
  return value && value.trim() !== '' ? value : fallback
}

/**
 * Safely formats address/location information
 * 
 * @param address - Address string
 * @param fallback - Text to display if address is empty (default: "Not specified")
 * @returns Address or fallback text
 */
export function formatAddress(
  address: string | null | undefined,
  fallback: string = "Not specified"
): string {
  return formatContactInfo(address, fallback)
} 