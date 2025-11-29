import { UserWithVolunteerProfile } from "@/types/volunteer"

export interface ProfileCompletenessResult {
  score: number
  critical: {
    completed: number
    total: number
    missing: string[]
  }
  important: {
    completed: number
    total: number
    missing: string[]
  }
  optional: {
    completed: number
    total: number
    missing: string[]
  }
  allMissing: string[]
}

/**
 * Calculate profile completeness based on field presence and validity
 * 
 * Critical (Required) - 50% weight:
 * - Name (first_name, last_name)
 * - Email
 * - Phone Number
 * - Emergency Contact (name, phone)
 * 
 * Important (Recommended) - 30% weight:
 * - Address
 * - Barangay
 * - Skills (at least 1)
 * - Availability (at least 1 day)
 * 
 * Optional - 20% weight:
 * - Bio
 * - Notes
 * - Documents (at least 1)
 * - Profile Photo
 * 
 * @param profile - The volunteer profile data
 * @param documentCount - Optional document count (if not provided, assumes 0)
 */
export function calculateProfileCompleteness(
  profile: UserWithVolunteerProfile | null,
  documentCount: number = 0
): ProfileCompletenessResult {
  if (!profile) {
    return {
      score: 0,
      critical: { completed: 0, total: 6, missing: ["First Name", "Last Name", "Email", "Phone Number", "Emergency Contact Name", "Emergency Contact Phone"] },
      important: { completed: 0, total: 4, missing: ["Address", "Barangay", "Skills", "Availability"] },
      optional: { completed: 0, total: 4, missing: ["Bio", "Notes", "Documents", "Profile Photo"] },
      allMissing: ["First Name", "Last Name", "Email", "Phone Number", "Emergency Contact Name", "Emergency Contact Phone", "Address", "Barangay", "Skills", "Availability", "Bio", "Notes", "Documents", "Profile Photo"]
    }
  }

  const critical: string[] = []
  const important: string[] = []
  const optional: string[] = []

  // Critical fields
  let criticalCompleted = 0
  if (profile.first_name?.trim()) criticalCompleted++
  else critical.push("First Name")
  if (profile.last_name?.trim()) criticalCompleted++
  else critical.push("Last Name")
  if (profile.email?.trim()) criticalCompleted++
  else critical.push("Email")
  if (profile.phone_number?.trim()) criticalCompleted++
  else critical.push("Phone Number")
  if (profile.emergency_contact_name?.trim()) criticalCompleted++
  else critical.push("Emergency Contact Name")
  if (profile.emergency_contact_phone?.trim()) criticalCompleted++
  else critical.push("Emergency Contact Phone")
  // Note: emergency_contact_relationship is not required for completeness

  // Important fields
  let importantCompleted = 0
  if (profile.address?.trim()) importantCompleted++
  else important.push("Address")
  if (profile.barangay?.trim()) importantCompleted++
  else important.push("Barangay")
  if (profile.volunteer_profiles?.skills && profile.volunteer_profiles.skills.length > 0) importantCompleted++
  else important.push("Skills")
  if (profile.volunteer_profiles?.availability && profile.volunteer_profiles.availability.length > 0) importantCompleted++
  else important.push("Availability")

  // Optional fields
  let optionalCompleted = 0
  // Check bio field
  if (profile.volunteer_profiles?.bio?.trim()) optionalCompleted++
  else optional.push("Bio")
  // Notes is separate from bio
  if (profile.volunteer_profiles?.notes?.trim()) optionalCompleted++
  else optional.push("Notes")
  // Documents count (passed as parameter)
  if (documentCount > 0) optionalCompleted++
  else optional.push("Documents")
  if (profile.profile_photo_url?.trim()) optionalCompleted++
  else optional.push("Profile Photo")

  // Calculate weighted score
  const criticalWeight = 0.5
  const importantWeight = 0.3
  const optionalWeight = 0.2

  const criticalScore = (criticalCompleted / 6) * 100
  const importantScore = (importantCompleted / 4) * 100
  const optionalScore = (optionalCompleted / 4) * 100 // Updated to 4 (bio, notes, documents, photo)

  const totalScore = Math.round(
    criticalScore * criticalWeight +
    importantScore * importantWeight +
    optionalScore * optionalWeight
  )

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    critical: {
      completed: criticalCompleted,
      total: 6,
      missing: critical
    },
    important: {
      completed: importantCompleted,
      total: 4,
      missing: important
    },
    optional: {
      completed: optionalCompleted,
      total: 4, // bio, notes, documents, photo
      missing: optional
    },
    allMissing: [...critical, ...important, ...optional]
  }
}

/**
 * Get color class for completeness score
 */
export function getCompletenessColor(score: number): string {
  if (score < 50) return "text-red-600 bg-red-50 border-red-200"
  if (score < 80) return "text-yellow-600 bg-yellow-50 border-yellow-200"
  return "text-green-600 bg-green-50 border-green-200"
}

/**
 * Get progress bar color class
 */
export function getProgressBarColor(score: number): string {
  if (score < 50) return "bg-red-500"
  if (score < 80) return "bg-yellow-500"
  return "bg-green-500"
}

