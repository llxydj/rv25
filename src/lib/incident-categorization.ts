/**
 * Incident Categorization Utilities
 * Handles mapping between new severity_level and existing severity enum
 */

import type { Database } from '@/types/supabase'

export type IncidentSeverity = Database['public']['Enums']['incident_severity']
export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFORMATIONAL'

/**
 * Maps new severity_level to existing severity enum for backward compatibility
 */
export function mapSeverityLevelToEnum(severityLevel: SeverityLevel | null | undefined): IncidentSeverity {
  if (!severityLevel) {
    return 'MODERATE' // Default
  }

  switch (severityLevel) {
    case 'CRITICAL':
      return 'CRITICAL'
    case 'HIGH':
      return 'SEVERE'
    case 'MODERATE':
      return 'MODERATE'
    case 'LOW':
      return 'MINOR'
    case 'INFORMATIONAL':
      return 'MINOR'
    default:
      return 'MODERATE'
  }
}

/**
 * Maps existing severity enum to new severity_level
 */
export function mapEnumToSeverityLevel(severity: IncidentSeverity | null | undefined): SeverityLevel | null {
  if (!severity) {
    return null
  }

  switch (severity) {
    case 'CRITICAL':
      return 'CRITICAL'
    case 'SEVERE':
      return 'HIGH'
    case 'MODERATE':
      return 'MODERATE'
    case 'MINOR':
      return 'LOW'
    default:
      return null
  }
}

/**
 * Validates incident categorization data
 */
export interface IncidentCategorizationData {
  incident_category?: string | null
  trauma_subcategory?: string | null
  severity_level?: SeverityLevel | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateIncidentCategorization(data: IncidentCategorizationData): ValidationResult {
  const errors: string[] = []

  // If incident_category is MEDICAL_TRAUMA, trauma_subcategory is required
  if (data.incident_category === 'MEDICAL_TRAUMA') {
    if (!data.trauma_subcategory || data.trauma_subcategory.trim() === '') {
      errors.push('Trauma sub-category is required when incident category is Medical - Trauma')
    }
  }

  // If trauma_subcategory is provided, incident_category must be MEDICAL_TRAUMA
  if (data.trauma_subcategory && data.incident_category !== 'MEDICAL_TRAUMA') {
    errors.push('Trauma sub-category can only be set when incident category is Medical - Trauma')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

