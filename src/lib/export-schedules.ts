// Schedule export utilities for CSV and JSON formats

export interface ExportSchedule {
  id: string
  title: string
  description?: string
  volunteer_name: string
  volunteer_email: string
  start_time: string
  end_time: string
  location?: string
  barangay?: string
  status: string
  is_accepted: boolean | null
  response_at?: string
  completed_at?: string
  attendance_marked: boolean
  created_at: string
}

/**
 * Convert schedules to CSV format
 */
export function schedulesToCSV(schedules: ExportSchedule[]): string {
  const headers = [
    'ID',
    'Title',
    'Description',
    'Volunteer Name',
    'Volunteer Email',
    'Start Time',
    'End Time',
    'Location',
    'Barangay',
    'Status',
    'Acceptance',
    'Response Date',
    'Completed Date',
    'Attendance Marked',
    'Created Date'
  ]

  const rows = schedules.map(schedule => [
    schedule.id,
    schedule.title,
    schedule.description || '',
    schedule.volunteer_name,
    schedule.volunteer_email,
    new Date(schedule.start_time).toLocaleString(),
    new Date(schedule.end_time).toLocaleString(),
    schedule.location || '',
    schedule.barangay || '',
    schedule.status,
    schedule.is_accepted === null ? 'Pending' : schedule.is_accepted ? 'Accepted' : 'Declined',
    schedule.response_at ? new Date(schedule.response_at).toLocaleString() : '',
    schedule.completed_at ? new Date(schedule.completed_at).toLocaleString() : '',
    schedule.attendance_marked ? 'Yes' : 'No',
    new Date(schedule.created_at).toLocaleString()
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  return csvContent
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string = 'schedules-export.csv'): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Download JSON file
 */
export function downloadJSON(data: any, filename: string = 'schedules-export.json'): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Format schedule data for export
 */
export function formatScheduleForExport(schedule: any): ExportSchedule {
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    volunteer_name: `${schedule.volunteer?.first_name || ''} ${schedule.volunteer?.last_name || ''}`.trim(),
    volunteer_email: schedule.volunteer?.email || '',
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    location: schedule.location,
    barangay: schedule.barangay,
    status: schedule.status || 'SCHEDULED',
    is_accepted: schedule.is_accepted,
    response_at: schedule.response_at,
    completed_at: schedule.completed_at,
    attendance_marked: schedule.attendance_marked || false,
    created_at: schedule.created_at
  }
}

/**
 * Generate summary statistics from schedules
 */
export function generateScheduleSummary(schedules: ExportSchedule[]) {
  const total = schedules.length
  const scheduled = schedules.filter(s => s.status === 'SCHEDULED').length
  const ongoing = schedules.filter(s => s.status === 'ONGOING').length
  const completed = schedules.filter(s => s.status === 'COMPLETED').length
  const cancelled = schedules.filter(s => s.status === 'CANCELLED').length
  
  const accepted = schedules.filter(s => s.is_accepted === true).length
  const declined = schedules.filter(s => s.is_accepted === false).length
  const pending = schedules.filter(s => s.is_accepted === null).length
  
  const attendanceMarked = schedules.filter(s => s.attendance_marked).length
  const completionRate = completed > 0 ? Math.round((completed / total) * 100) : 0
  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0
  
  return {
    total,
    scheduled,
    ongoing,
    completed,
    cancelled,
    accepted,
    declined,
    pending,
    attendanceMarked,
    completionRate,
    acceptanceRate,
    exportDate: new Date().toISOString()
  }
}
