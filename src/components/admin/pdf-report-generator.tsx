"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Download, FileText, Users, BarChart3, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ReportFilters {
  startDate: string
  endDate: string
  status?: string[]
  incidentType?: string[]
  barangay?: string[]
  severity?: number[]
}

export function PDFReportGenerator() {
  const [reportType, setReportType] = useState<string>('incidents')
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 30 days ago
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [isGenerating, setIsGenerating] = useState(false)
  const [filters, setFilters] = useState<Partial<ReportFilters>>({})

  const reportTypes = [
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

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates')
      return
    }

    setIsGenerating(true)
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
        const error = await response.json()
        throw new Error(error.message || 'Failed to generate report')
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('PDF report generated successfully!')
    } catch (error: any) {
      console.error('Report generation error:', error)
      toast.error(error.message || 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedReportType = reportTypes.find(rt => rt.value === reportType)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            PDF Report Generator
          </CardTitle>
          <CardDescription>
            Generate comprehensive PDF reports for incidents, volunteer performance, and analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReportType && (
              <p className="text-sm text-gray-600">{selectedReportType.description}</p>
            )}
          </div>

          {/* Date Range Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Additional Filters for Incident Reports */}
          {reportType === 'incidents' && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Additional Filters (Optional)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status?.[0] || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value ? [value] : undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="ASSIGNED">Assigned</SelectItem>
                      <SelectItem value="RESPONDING">Responding</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Severity Level</Label>
                  <Select
                    value={filters.severity?.[0]?.toString() || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value ? [parseInt(value)] : undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All severity levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Severity Levels</SelectItem>
                      <SelectItem value="1">Level 1 (Critical)</SelectItem>
                      <SelectItem value="2">Level 2 (High)</SelectItem>
                      <SelectItem value="3">Level 3 (Medium)</SelectItem>
                      <SelectItem value="4">Level 4 (Low)</SelectItem>
                      <SelectItem value="5">Level 5 (Very Low)</SelectItem>
                    </SelectContent>
                  </Select>
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
      <Card>
        <CardHeader>
          <CardTitle>Report Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Report Type:</strong> {selectedReportType?.label}</p>
            <p><strong>Date Range:</strong> {startDate && endDate ? `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}` : 'Not selected'}</p>
            <p><strong>Generated:</strong> {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
            <p><strong>Format:</strong> PDF (Portable Document Format)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
