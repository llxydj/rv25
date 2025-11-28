// Utility functions for exporting data to CSV, Excel, and PDF

export interface ExportOptions {
  filename?: string
  includeHeaders?: boolean
}

/**
 * Export data to CSV
 */
export function exportToCSV(
  data: any[],
  headers: string[],
  options: ExportOptions = {}
): void {
  const { filename = 'export', includeHeaders = true } = options

  const csvRows: string[] = []

  // Add headers
  if (includeHeaders && headers.length > 0) {
    csvRows.push(headers.join(','))
  }

  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || ''
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    csvRows.push(values.join(','))
  })

  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

/**
 * Export data to Excel (requires xlsx library)
 */
export async function exportToExcel(
  data: any[],
  headers: string[],
  options: ExportOptions = {}
): Promise<void> {
  try {
    // Dynamic import to avoid bundling if not used
    const XLSX = await import('xlsx')
    const { filename = 'export', includeHeaders = true } = options

    // Prepare worksheet data
    const worksheetData: any[][] = []

    // Add headers
    if (includeHeaders) {
      worksheetData.push(headers)
    }

    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => row[header] || '')
      worksheetData.push(values)
    })

    // Create workbook and worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

    // Generate file and download
    XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (error) {
    console.error('Excel export error:', error)
    throw new Error('Excel export failed. Please ensure xlsx library is installed.')
  }
}

/**
 * Format data for export
 */
export function formatForExport(data: any[], fieldMappings: Record<string, string>): any[] {
  return data.map(item => {
    const formatted: any = {}
    Object.entries(fieldMappings).forEach(([key, label]) => {
      formatted[label] = item[key] || ''
    })
    return formatted
  })
}

