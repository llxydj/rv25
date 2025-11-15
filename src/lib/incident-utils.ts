export type IncidentSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL'

// Map numeric priority (1-5) to severity enum
export const mapPriorityToSeverity = (priority: number): IncidentSeverity => {
  if (priority >= 5) return 'CRITICAL'
  if (priority === 4) return 'SEVERE'
  if (priority === 3) return 'MODERATE'
  return 'MINOR'
}
