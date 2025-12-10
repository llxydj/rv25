/**
 * Data Validation Utilities for Reports and Exports
 * Ensures data quality before export (zero tolerance policy)
 */

export interface ValidationIssue {
  type: 'orphaned_record' | 'future_date' | 'invalid_timestamp' | 'missing_required' | 'data_inconsistency'
  severity: 'error' | 'warning'
  message: string
  recordId?: string
  field?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  canExport: boolean
}

/**
 * Validate incident data before export
 */
export function validateIncidentData(incidents: any[]): ValidationResult {
  const issues: ValidationIssue[] = []
  const now = new Date()
  const maxFutureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Allow 24h future (timezone issues)

  incidents.forEach((incident, index) => {
    const recordId = incident.id || `record_${index}`

    // Check for orphaned records (missing required relationships)
    if (!incident.id) {
      issues.push({
        type: 'orphaned_record',
        severity: 'error',
        message: 'Incident missing ID',
        recordId
      })
    }

    // Check for future dates
    if (incident.created_at) {
      const createdDate = new Date(incident.created_at)
      if (createdDate > maxFutureDate) {
        issues.push({
          type: 'future_date',
          severity: 'error',
          message: `Created date is in the future: ${incident.created_at}`,
          recordId,
          field: 'created_at'
        })
      }
    }

    if (incident.assigned_at) {
      const assignedDate = new Date(incident.assigned_at)
      if (assignedDate > maxFutureDate) {
        issues.push({
          type: 'future_date',
          severity: 'error',
          message: `Assigned date is in the future: ${incident.assigned_at}`,
          recordId,
          field: 'assigned_at'
        })
      }
    }

    if (incident.resolved_at) {
      const resolvedDate = new Date(incident.resolved_at)
      if (resolvedDate > maxFutureDate) {
        issues.push({
          type: 'future_date',
          severity: 'error',
          message: `Resolved date is in the future: ${incident.resolved_at}`,
          recordId,
          field: 'resolved_at'
        })
      }
    }

    // Check for invalid timestamps (logical inconsistencies)
    if (incident.created_at && incident.assigned_at) {
      const created = new Date(incident.created_at)
      const assigned = new Date(incident.assigned_at)
      if (assigned < created) {
        issues.push({
          type: 'invalid_timestamp',
          severity: 'error',
          message: 'Assigned date is before created date',
          recordId,
          field: 'assigned_at'
        })
      }
    }

    if (incident.created_at && incident.resolved_at) {
      const created = new Date(incident.created_at)
      const resolved = new Date(incident.resolved_at)
      if (resolved < created) {
        issues.push({
          type: 'invalid_timestamp',
          severity: 'error',
          message: 'Resolved date is before created date',
          recordId,
          field: 'resolved_at'
        })
      }
    }

    if (incident.assigned_at && incident.resolved_at) {
      const assigned = new Date(incident.assigned_at)
      const resolved = new Date(incident.resolved_at)
      if (resolved < assigned) {
        issues.push({
          type: 'invalid_timestamp',
          severity: 'error',
          message: 'Resolved date is before assigned date',
          recordId,
          field: 'resolved_at'
        })
      }
    }

    // Check for data inconsistencies
    if (incident.incident_category === 'MEDICAL_TRAUMA' && !incident.trauma_subcategory) {
      issues.push({
        type: 'data_inconsistency',
        severity: 'warning',
        message: 'Medical trauma incident missing trauma subcategory',
        recordId,
        field: 'trauma_subcategory'
      })
    }

    if (incident.trauma_subcategory && incident.incident_category !== 'MEDICAL_TRAUMA') {
      issues.push({
        type: 'data_inconsistency',
        severity: 'warning',
        message: 'Trauma subcategory set but incident category is not Medical - Trauma',
        recordId,
        field: 'trauma_subcategory'
      })
    }
  })

  const errors = issues.filter(i => i.severity === 'error')
  const canExport = errors.length === 0

  return {
    valid: issues.length === 0,
    issues,
    canExport
  }
}

/**
 * Format validation issues for display
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return 'No validation issues found.'
  }

  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  let message = ''

  if (errors.length > 0) {
    message += `❌ ${errors.length} error(s) found:\n`
    errors.forEach((issue, index) => {
      message += `${index + 1}. ${issue.message}`
      if (issue.recordId) message += ` (Record: ${issue.recordId.substring(0, 8)}...)`
      message += '\n'
    })
  }

  if (warnings.length > 0) {
    message += `⚠️ ${warnings.length} warning(s) found:\n`
    warnings.forEach((issue, index) => {
      message += `${index + 1}. ${issue.message}`
      if (issue.recordId) message += ` (Record: ${issue.recordId.substring(0, 8)}...)`
      message += '\n'
    })
  }

  return message.trim()
}

