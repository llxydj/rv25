import { z } from "zod"

export const AnnouncementCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.string().optional(),
  priority: z.union([z.string(), z.number()]).optional(),
  location: z.string().max(500).nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  requirements: z.union([z.string(), z.array(z.string())]).optional(),
  created_by: z.string().uuid().optional(),
  facebook_post_url: z.string().url().nullable().optional(),
  source_type: z.enum(['MANUAL', 'FACEBOOK']).optional(),
})

export const AnnouncementUpdateSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.string().optional(),
  priority: z.union([z.string(), z.number()]).optional(),
  location: z.string().max(500).nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  requirements: z.union([z.string(), z.array(z.string())]).optional(),
  updated_by: z.string().uuid().optional(),
  facebook_post_url: z.string().url().nullable().optional(),
  source_type: z.enum(['MANUAL', 'FACEBOOK']).optional(),
})

export const AnnouncementDeleteSchema = z.object({
  id: z.union([z.string(), z.number()]),
  deleted_by: z.string().uuid().optional(),
})

export const FeedbackCreateSchema = z.object({
  incident_id: z.string().uuid().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  thumbs_up: z.coerce.boolean().optional(),
  comment: z.string().max(1000).nullable().optional(),
  created_by: z.string().uuid().optional(),
})

export type AnnouncementCreate = z.infer<typeof AnnouncementCreateSchema>
export type AnnouncementUpdate = z.infer<typeof AnnouncementUpdateSchema>
export type AnnouncementDelete = z.infer<typeof AnnouncementDeleteSchema>
export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>

export const IncidentCreateSchema = z.object({
  reporter_id: z.string().uuid(),
  incident_type: z.string().min(1),
  description: z.string().default(''), // Optional - allow empty string (DB requires NOT NULL, so empty string is used)
  location_lat: z.coerce.number().min(-90).max(90),
  location_lng: z.coerce.number().min(-180).max(180),
  address: z.string().transform(val => val === '' ? null : val).nullable().optional(),
  barangay: z.string().min(1),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  photo_url: z.string().nullable().optional(),
  photo_urls: z.array(z.string()).max(3), // REQUIRED - must be array (can be empty initially, will be updated in background)
  voice_url: z.string().nullable().optional(),
  is_offline: z.coerce.boolean().optional(),
  created_at_local: z.string().optional(),
  // New categorization fields (optional for backward compatibility)
  incident_category: z.enum([
    'MEDICAL_TRAUMA',
    'MEDICAL_NON_TRAUMA',
    'NON_MEDICAL_SAFETY',
    'NON_MEDICAL_SECURITY',
    'NON_MEDICAL_ENVIRONMENTAL',
    'NON_MEDICAL_BEHAVIORAL',
    'OTHER'
  ]).nullable().optional(),
  trauma_subcategory: z.enum([
    'FALL_RELATED',
    'BLUNT_FORCE',
    'PENETRATING',
    'BURN',
    'FRACTURE_DISLOCATION',
    'HEAD_INJURY',
    'SPINAL_INJURY',
    'MULTI_SYSTEM',
    'OTHER_TRAUMA'
  ]).nullable().optional(),
  severity_level: z.enum([
    'CRITICAL',
    'HIGH',
    'MODERATE',
    'LOW',
    'INFORMATIONAL'
  ]).nullable().optional(),
}).refine((data) => {
  // If incident_category is MEDICAL_TRAUMA, trauma_subcategory is required
  if (data.incident_category === 'MEDICAL_TRAUMA' && !data.trauma_subcategory) {
    return false
  }
  return true
}, {
  message: "Trauma sub-category is required when incident category is Medical - Trauma",
  path: ["trauma_subcategory"]
}).refine((data) => {
  // If trauma_subcategory is provided, incident_category must be MEDICAL_TRAUMA
  if (data.trauma_subcategory && data.incident_category !== 'MEDICAL_TRAUMA') {
    return false
  }
  return true
}, {
  message: "Trauma sub-category can only be set when incident category is Medical - Trauma",
  path: ["trauma_subcategory"]
})

export type IncidentCreate = z.infer<typeof IncidentCreateSchema>

export const TrainingCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start_at: z.string().min(1),
  end_at: z.string().optional(),
  location: z.string().optional(),
  created_by: z.string().uuid().optional(),
})

export const TrainingEvaluationCreateSchema = z.object({
  training_id: z.union([z.string(), z.number()]),
  user_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(2000).optional(),
})

export const IncidentHandoffCreateSchema = z.object({
  incident_id: z.string().uuid(),
  from_lgu: z.string().min(1),
  to_lgu: z.string().min(1),
  notes: z.string().optional(),
  created_by: z.string().uuid().optional(),
})

export const IncidentHandoffUpdateSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"]),
  notes: z.string().optional(),
  updated_by: z.string().uuid().optional(),
})

export type IncidentHandoffUpdate = z.infer<typeof IncidentHandoffUpdateSchema>

// ============================================================================
// Volunteer Profile Validation Utilities
// ============================================================================

/**
 * Philippine phone number validation
 * Accepts formats:
 * - +63XXXXXXXXXX (with country code)
 * - 09XXXXXXXXX (local format)
 * - 9XXXXXXXXX (without leading 0)
 */
export const PHILIPPINE_PHONE_REGEX = /^(\+63|0)?9\d{9}$/

export function isValidPhilippinePhone(phone: string): boolean {
  if (!phone) return false
  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  return PHILIPPINE_PHONE_REGEX.test(cleaned)
}

/**
 * Format Philippine phone number to standard format (+63XXXXXXXXXX)
 */
export function formatPhilippinePhone(phone: string): string {
  if (!phone) return ''
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')
  
  // If starts with 63, add +
  if (cleaned.startsWith('63') && cleaned.length === 12) {
    return `+${cleaned}`
  }
  // If starts with 0, remove it and add +63
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+63${cleaned.slice(1)}`
  }
  // If starts with 9, add +63
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return `+63${cleaned}`
  }
  // If already in +63 format, return as is
  if (cleaned.startsWith('63') && cleaned.length === 12) {
    return `+${cleaned}`
  }
  
  return phone // Return original if can't format
}

/**
 * Email validation
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  if (!email) return false
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Check for duplicate email (would need to query database)
 * This is a placeholder - actual implementation would query the database
 */
export async function isDuplicateEmail(email: string, excludeUserId?: string): Promise<boolean> {
  // This would need to be implemented with actual database query
  // For now, return false as placeholder
  return false
}

/**
 * Validate skills array
 */
export function isValidSkillsArray(skills: any): boolean {
  if (!Array.isArray(skills)) return false
  const validSkills = [
    "FIRST AID",
    "CPR",
    "FIREFIGHTING",
    "WATER RESCUE",
    "SEARCH AND RESCUE",
    "EMERGENCY RESPONSE",
    "DISASTER MANAGEMENT",
    "MEDICAL ASSISTANCE",
    "TRAFFIC MANAGEMENT",
    "COMMUNICATION",
  ]
  return skills.every(skill => validSkills.includes(skill))
}

/**
 * Validate availability array
 */
export function isValidAvailabilityArray(availability: any): boolean {
  if (!Array.isArray(availability)) return false
  const validDays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]
  return availability.every(day => validDays.includes(day))
}

/**
 * Validate date format (ISO 8601)
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Volunteer Profile Update Schema
 */
export const VolunteerProfileUpdateSchema = z.object({
  skills: z.array(z.string()).optional(),
  availability: z.array(z.string()).optional(),
  notes: z.string().max(1000).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  is_available: z.boolean().optional(),
  assigned_barangays: z.array(z.string()).optional(),
})

/**
 * Volunteer Personal Info Update Schema
 */
export const VolunteerPersonalInfoUpdateSchema = z.object({
  phone_number: z.string().refine(
    (val) => !val || isValidPhilippinePhone(val),
    { message: "Invalid Philippine phone number format" }
  ).optional(),
  address: z.string().max(500).optional(),
  barangay: z.string().max(100).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z.string().refine(
    (val) => !val || isValidPhilippinePhone(val),
    { message: "Invalid Philippine phone number format" }
  ).optional(),
  emergency_contact_relationship: z.string().max(100).optional(),
})

export type VolunteerProfileUpdate = z.infer<typeof VolunteerProfileUpdateSchema>
export type VolunteerPersonalInfoUpdate = z.infer<typeof VolunteerPersonalInfoUpdateSchema>

/**
 * Validation error result
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Validate volunteer profile update
 */
export function validateVolunteerProfileUpdate(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  // Validate skills
  if (data.skills !== undefined && !isValidSkillsArray(data.skills)) {
    errors.push({
      field: 'skills',
      message: 'Invalid skills array. Skills must be from the predefined list.'
    })
  }

  // Validate availability
  if (data.availability !== undefined && !isValidAvailabilityArray(data.availability)) {
    errors.push({
      field: 'availability',
      message: 'Invalid availability array. Days must be valid day names.'
    })
  }

  // Validate notes/bio length
  if (data.notes !== undefined && data.notes && data.notes.length > 1000) {
    errors.push({
      field: 'notes',
      message: 'Notes must be 1000 characters or less.'
    })
  }

  if (data.bio !== undefined && data.bio && data.bio.length > 1000) {
    errors.push({
      field: 'bio',
      message: 'Bio must be 1000 characters or less.'
    })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate volunteer personal info update
 */
export function validateVolunteerPersonalInfo(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  // Validate phone number
  if (data.phone_number && !isValidPhilippinePhone(data.phone_number)) {
    errors.push({
      field: 'phone_number',
      message: 'Invalid Philippine phone number. Use format: +63XXXXXXXXXX or 09XXXXXXXXX'
    })
  }

  // Validate emergency contact phone
  if (data.emergency_contact_phone && !isValidPhilippinePhone(data.emergency_contact_phone)) {
    errors.push({
      field: 'emergency_contact_phone',
      message: 'Invalid Philippine phone number. Use format: +63XXXXXXXXXX or 09XXXXXXXXX'
    })
  }

  // Validate address length
  if (data.address && data.address.length > 500) {
    errors.push({
      field: 'address',
      message: 'Address must be 500 characters or less.'
    })
  }

  // Validate barangay length
  if (data.barangay && data.barangay.length > 100) {
    errors.push({
      field: 'barangay',
      message: 'Barangay must be 100 characters or less.'
    })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * LGU Contact Create/Update Schema
 */
export const LguContactCreateSchema = z.object({
  agency_name: z.string().min(1, "Agency name is required").max(200),
  contact_person: z.string().max(200).nullable().optional(),
  contact_number: z.string().min(1, "Contact number is required").max(50),
  notes: z.string().max(1000).nullable().optional(),
})

export type LguContactCreate = z.infer<typeof LguContactCreateSchema>

/**
 * Barangay Account Create Schema
 */
export const BarangayAccountCreateSchema = z.object({
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phoneNumber: z.string().max(50).optional(),
  barangay: z.string().min(1, "Barangay is required").max(100),
})

export type BarangayAccountCreate = z.infer<typeof BarangayAccountCreateSchema>

/**
 * Schedule Create Schema
 */
export const ScheduleCreateSchema = z.object({
  volunteer_id: z.string().uuid().optional(),
  volunteer_ids: z.array(z.string().uuid()).optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).nullable().optional(),
  start_time: z.string().datetime("Invalid start time format"),
  end_time: z.string().datetime("Invalid end time format"),
  location: z.string().max(500).nullable().optional(),
  barangay: z.string().max(100).nullable().optional(),
}).refine((data) => {
  // At least one volunteer must be selected
  return data.volunteer_id || (data.volunteer_ids && data.volunteer_ids.length > 0)
}, {
  message: "At least one volunteer must be selected",
  path: ["volunteer_id"]
}).refine((data) => {
  // End time must be after start time
  if (data.start_time && data.end_time) {
    return new Date(data.end_time) > new Date(data.start_time)
  }
  return true
}, {
  message: "End time must be after start time",
  path: ["end_time"]
})

export type ScheduleCreate = z.infer<typeof ScheduleCreateSchema>

