/**
 * Enhanced CSV Export Utility
 * Provides professional CSV exports with metadata, formatting, and Excel compatibility
 */

export interface CSVExportOptions {
  filename?: string
  includeMetadata?: boolean
  includeSummary?: boolean
  organizationName?: string
  reportTitle?: string
  metadata?: Record<string, string>
}

export interface CSVSummaryStats {
  totalRecords?: number
  dateRange?: { start: string; end: string }
  [key: string]: any
}

/**
 * Generate professional CSV with metadata headers and summary
 */
export function generateEnhancedCSV(
  data: any[],
  headers: string[],
  options: CSVExportOptions = {}
): string {
  const {
    filename = 'export',
    includeMetadata = true,
    includeSummary = true,
    organizationName = 'RVOIS - Rescue Volunteers Operations Information System',
    reportTitle = 'Data Export',
    metadata = {}
  } = options

  const csvRows: string[] = []

  // Add metadata section
  if (includeMetadata) {
    csvRows.push(organizationName)
    csvRows.push(reportTitle)
    csvRows.push(`Generated: ${new Date().toLocaleString('en-US', { 
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    })}`)
    
    // Add custom metadata (avoid duplicates)
    const seenKeys = new Set<string>()
    Object.entries(metadata).forEach(([key, value]) => {
      // Skip if "Total Records" is already in metadata
      if (key === 'Total Records' && seenKeys.has('Total Records')) {
        return
      }
      csvRows.push(`${key}: ${value}`)
      seenKeys.add(key)
    })
    
    // Only add Total Records if not already in metadata
    if (!seenKeys.has('Total Records')) {
      csvRows.push(`Total Records: ${data.length}`)
    }
    
    csvRows.push('') // Empty line separator
  }

  // Add summary statistics if provided
  if (includeSummary && data.length > 0) {
    csvRows.push('=== SUMMARY STATISTICS ===')
    
    // Calculate basic statistics
    const numericFields = headers.filter(header => {
      const sampleValue = data[0]?.[header]
      return typeof sampleValue === 'number'
    })
    
    numericFields.forEach(field => {
      const values = data.map(row => row[field]).filter(v => typeof v === 'number' && !isNaN(v))
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0)
        const avg = sum / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        // Format numbers properly - use more decimal places for coordinates
        const decimals = field.toLowerCase().includes('lat') || field.toLowerCase().includes('lng') || field.toLowerCase().includes('longitude') || field.toLowerCase().includes('latitude') ? 6 : 2
        csvRows.push(`${field}: Avg=${avg.toFixed(decimals)} Min=${min.toFixed(decimals)} Max=${max.toFixed(decimals)}`)
      }
    })
    
    csvRows.push('') // Empty line separator
  }

  // Add headers row
  csvRows.push(headers.map(escapeCSVField).join(','))

  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] ?? ''
      return escapeCSVField(String(value))
    })
    csvRows.push(values.join(','))
  })

  return csvRows.join('\n')
}

/**
 * Escape CSV field properly (handles commas, quotes, newlines)
 */
function escapeCSVField(field: string): string {
  if (field === null || field === undefined) return ''
  
  const str = String(field)
  
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  
  return str
}

/**
 * Download CSV file with proper encoding
 */
export function downloadCSV(
  csvContent: string,
  filename: string
): void {
  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { 
    type: 'text/csv;charset=utf-8;' 
  })
  
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  window.URL.revokeObjectURL(url)
}

/**
 * Format date for CSV (Excel-friendly)
 */
export function formatDateForCSV(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Manila'
  })
}

/**
 * Format number for CSV (with proper decimal places)
 */
export function formatNumberForCSV(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return ''
  return Number(value).toFixed(decimals)
}

/**
 * Create summary statistics object
 */
export function createSummaryStats(
  data: any[],
  dateField?: string,
  numericFields?: string[]
): CSVSummaryStats {
  const stats: CSVSummaryStats = {
    totalRecords: data.length
  }

  // Date range
  if (dateField && data.length > 0) {
    const dates = data
      .map(row => row[dateField])
      .filter(d => d)
      .map(d => new Date(d).getTime())
      .sort((a, b) => a - b)
    
    if (dates.length > 0) {
      stats.dateRange = {
        start: new Date(dates[0]).toISOString(),
        end: new Date(dates[dates.length - 1]).toISOString()
      }
    }
  }

  // Numeric field statistics
  if (numericFields) {
    numericFields.forEach(field => {
      const values = data
        .map(row => row[field])
        .filter(v => typeof v === 'number')
      
      if (values.length > 0) {
        stats[`${field}_sum`] = values.reduce((a, b) => a + b, 0)
        stats[`${field}_avg`] = values.reduce((a, b) => a + b, 0) / values.length
        stats[`${field}_min`] = Math.min(...values)
        stats[`${field}_max`] = Math.max(...values)
      }
    })
  }

  return stats
}

