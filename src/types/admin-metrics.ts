export interface AdminMetrics {
  usersByRole: Record<string, number>
  incidentsByBarangay: Array<{
    barangay: string
    count: number
    percentage: string
  }>
  systemMetrics: {
    activeResidents: number
    totalIncidents: number
    activeVolunteers: number
  }
  volunteerResponseMetrics: {
    avgAssignmentTime: number
    avgResolutionTime: number
    totalResolved: number
  }
}