"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Download, FileText, Users, BarChart3, Loader2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ✅ PROPER TYPES
interface ReportFilters {
  startDate: string
  endDate: string
  status?: string[]
  incidentType?: string[]
  barangay?: string[]
  severity?: number[]
}

interface ReportType {
  value: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export function PDFReportGenerator() {
  const [reportType, setReportType] = useState<string>('incidents')
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [isGenerating, setIsGenerating] = useState(false)
  const [filters, setFilters] = useState<Partial<ReportFilters>>({})
  const [error, setError] = useState<string | null>(null)

  // ✅ DARK MODE DETECTION
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setDarkMode(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const reportTypes: ReportType[] = [
    {
      value: 'incidents',
      label: 'Incident Report',
      description: 'Detailed incident analysis with status, severity, and location data',
      icon: FileText
    },
    {
      value: 'volunteers',
      label: 'Volunteer Performance',
      description: 'Volunteer performance metrics, response times, and completion rates',
      icon: Users
    },
    {
      value: 'analytics',
      label: 'Analytics Dashboard',
      description: 'Comprehensive analytics with trends, distributions, and insights',
      icon: BarChart3
    }
  ]

  // ✅ VALIDATE DATE RANGE
  const isValidDateRange = () => {
    if (!startDate || !endDate) return false
    if (startDate > endDate) {
      setError('Start date must be before end date')
      return false
    }
    if (endDate > new Date()) {
      setError('End date cannot be in the future')
      return false
    }
    setError(null)
    return true
  }

  // ✅ IMPROVED ERROR HANDLING
  const handleGenerateReport = async () => {
    if (!isValidDateRange()) {
      toast.error(error || 'Invalid date range')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          filters: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            ...filters
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate report' }))
        throw new Error(errorData.message || `Server error: ${response.status}`)
      }

      // ✅ CHECK CONTENT TYPE
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/pdf')) {
        throw new Error('Invalid response format. Expected PDF.')
      }

      // Create blob and download
      const blob = await response.blob()

      // ✅ VALIDATE BLOB SIZE
      if (blob.size === 0) {
        throw new Error('Generated PDF is empty')
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      document.body.appendChild(a)
      a.click()

      // ✅ CLEANUP
      setTimeout(() => {
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }, 100)

      toast.success('PDF report generated successfully!')
    } catch (error: any) {
      console.error('Report generation error:', error)
      const errorMessage = error.message || 'Failed to generate report'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedReportType = reportTypes.find(rt => rt.value === reportType)

  return (
    <div className="space-y-6">
      {/* ✅ ERROR ALERT */}
      {error && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-700 dark:text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Download className="h-5 w-5" />
            PDF Report Generator
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Generate comprehensive PDF reports for incidents, volunteer performance, and analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-gray-300">Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                {reportTypes.map((type) => (
                  <SelectItem
                    key={type.value}
                    value={type.value}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReportType && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedReportType.description}
              </p>
            )}
          </div>

          {/* Date Range Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100",
                      !startDate && "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100",
                      !endDate && "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                    disabled={(date) => date > new Date() || (startDate && date < startDate)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Additional Filters for Incident Reports */}
          {reportType === 'incidents' && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Additional Filters (Optional)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Status</Label>
                  <Select
                    value={filters.status?.[0] || 'all'}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        status: value && value !== 'all' ? [value] : undefined,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      <SelectItem value="all" className="text-gray-900 dark:text-gray-100">All Statuses</SelectItem>
                      <SelectItem value="PENDING" className="text-gray-900 dark:text-gray-100">Pending</SelectItem>
                      <SelectItem value="ASSIGNED" className="text-gray-900 dark:text-gray-100">Assigned</SelectItem>
                      <SelectItem value="RESPONDING" className="text-gray-900 dark:text-gray-100">Responding</SelectItem>
                      <SelectItem value="RESOLVED" className="text-gray-900 dark:text-gray-100">Resolved</SelectItem>
                      <SelectItem value="CANCELLED" className="text-gray-900 dark:text-gray-100">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Severity Level</Label>
                  <Select
                    value={filters.severity?.[0]?.toString() || 'all'}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        severity: value && value !== 'all' ? [parseInt(value)] : undefined,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="All severity levels" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      <SelectItem value="all" className="text-gray-900 dark:text-gray-100">All Severity Levels</SelectItem>
                      <SelectItem value="1" className="text-gray-900 dark:text-gray-100">Level 1 (Critical)</SelectItem>
                      <SelectItem value="2" className="text-gray-900 dark:text-gray-100">Level 2 (High)</SelectItem>
                      <SelectItem value="3" className="text-gray-900 dark:text-gray-100">Level 3 (Medium)</SelectItem>
                      <SelectItem value="4" className="text-gray-900 dark:text-gray-100">Level 4 (Low)</SelectItem>
                      <SelectItem value="5" className="text-gray-900 dark:text-gray-100">Level 5 (Very Low)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ✅ LOADING STATE UI */}
          {isGenerating && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Generating your PDF report...
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    This may take a few moments depending on the data size
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating || !startDate || !endDate}
              className="min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate PDF Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview Information */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Report Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              <strong className="text-gray-900 dark:text-gray-100">Report Type:</strong>{' '}
              {selectedReportType?.label}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-gray-100">Date Range:</strong>{' '}
              {startDate && endDate
                ? `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`
                : 'Not selected'}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-gray-100">Generated:</strong>{' '}
              {format(new Date(), 'MMM dd, yyyy HH:mm')}
            </p>
            <p>
              <strong className="text-gray-900 dark:text-gray-100">Format:</strong>{' '}
              PDF (Portable Document Format)
            </p>
            {filters.status && (
              <p>
                <strong className="text-gray-900 dark:text-gray-100">Status Filter:</strong>{' '}
                {filters.status.join(', ')}
              </p>
            )}
            {filters.severity && (
              <p>
                <strong className="text-gray-900 dark:text-gray-100">Severity Filter:</strong>{' '}
                Level {filters.severity.join(', ')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}