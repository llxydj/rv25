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
// Dynamically import jsPDF and jspdf-autotable only on client side


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

  const generatePDFReport = async (reportData: any, reportType: string) => {
    // Dynamically import jsPDF only when needed
    const { jsPDF } = await import('jspdf')
    await import('jspdf-autotable')
    
    const doc = new jsPDF() as any

    if (reportType === 'incidents') {
      // Add header
      doc.setFontSize(20)
      doc.text('RVOIS Incident Report', 20, 30)
      
      doc.setFontSize(12)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40)
      doc.text(`Period: ${new Date(reportData.summary.period.start).toLocaleDateString()} - ${new Date(reportData.summary.period.end).toLocaleDateString()}`, 20, 50)
      doc.text(`Total Incidents: ${reportData.summary.total}`, 20, 60)

      // Add summary statistics
      if (reportData.incidents && reportData.incidents.length > 0) {
        doc.setFontSize(14)
        doc.text('Summary Statistics', 20, 80)
        
        doc.setFontSize(10)
        let yPos = 90
        doc.text('Status Distribution:', 20, yPos)
        yPos += 10
        Object.entries(reportData.summary.statusCounts).forEach(([status, count]) => {
          doc.text(`  ${status}: ${count}`, 30, yPos)
          yPos += 8
        })

        yPos += 10
        doc.text('Severity Distribution:', 20, yPos)
        yPos += 10
        Object.entries(reportData.summary.severityCounts).forEach(([severity, count]) => {
          doc.text(`  Level ${severity}: ${count}`, 30, yPos)
          yPos += 8
        })

        // Add incidents table
        yPos += 20
        doc.setFontSize(14)
        doc.text('Incident Details', 20, yPos)
        yPos += 10

        // Prepare table data
        const tableData = reportData.incidents.map((incident: any) => [
          incident.id.slice(0, 8),
          incident.incident_type,
          incident.status,
          `Level ${incident.severity}`,
          incident.barangay,
          new Date(incident.created_at).toLocaleDateString(),
          incident.assigned_to ? 'Yes' : 'No',
          incident.resolved_at ? new Date(incident.resolved_at).toLocaleDateString() : 'N/A'
        ])

        doc.autoTable({
          head: [['ID', 'Type', 'Status', 'Severity', 'Barangay', 'Created', 'Assigned', 'Resolved']],
          body: tableData,
          startY: yPos,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 38, 38] },
          alternateRowStyles: { fillColor: [248, 250, 252] }
        })
      }
    } else if (reportType === 'volunteers') {
      // Add header
      doc.setFontSize(20)
      doc.text('RVOIS Volunteer Performance Report', 20, 30)
      
      doc.setFontSize(12)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40)
      doc.text(`Period: ${new Date(reportData.summary.period.start).toLocaleDateString()} - ${new Date(reportData.summary.period.end).toLocaleDateString()}`, 20, 50)
      doc.text(`Active Volunteers: ${reportData.summary.totalVolunteers}`, 20, 60)

      // Add performance summary
      if (reportData.volunteers.length > 0) {
        doc.setFontSize(14)
        doc.text('Performance Summary', 20, 80)
        
        doc.setFontSize(10)
        doc.text(`Total Incidents Assigned: ${reportData.summary.totalIncidents}`, 20, 90)
        doc.text(`Total Incidents Resolved: ${reportData.summary.totalResolved}`, 20, 100)
        doc.text(`Overall Resolution Rate: ${reportData.summary.avgResolutionRate}%`, 20, 110)

        // Add volunteer performance table
        doc.setFontSize(14)
        doc.text('Volunteer Performance Details', 20, 130)

        const tableData = reportData.volunteers.map((volunteer: any) => [
          `${volunteer.users.first_name} ${volunteer.users.last_name}`,
          volunteer.users.phone_number,
          volunteer.skills?.join(', ') || 'None',
          volunteer.totalIncidents.toString(),
          volunteer.resolvedIncidents.toString(),
          `${volunteer.resolutionRate}%`
        ])

        doc.autoTable({
          head: [['Name', 'Phone', 'Skills', 'Assigned', 'Resolved', 'Resolution Rate']],
          body: tableData,
          startY: 140,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 38, 38] },
          alternateRowStyles: { fillColor: [248, 250, 252] }
        })
      }
    } else if (reportType === 'analytics') {
      // Add header
      doc.setFontSize(20)
      doc.text('RVOIS Analytics Report', 20, 30)
      
      doc.setFontSize(12)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40)
      doc.text(`Period: ${new Date(reportData.analytics.period.start).toLocaleDateString()} - ${new Date(reportData.analytics.period.end).toLocaleDateString()}`, 20, 50)

      // Add key metrics
      doc.setFontSize(14)
      doc.text('Key Metrics', 20, 70)
      
      doc.setFontSize(10)
      doc.text(`Total Incidents: ${reportData.analytics.totalIncidents}`, 20, 80)
      doc.text(`Resolved Incidents: ${reportData.analytics.statusDistribution.RESOLVED || 0}`, 20, 90)
      doc.text(`Average Response Time: ${parseFloat(reportData.analytics.avgResponseTime).toFixed(1)} hours`, 20, 100)
      doc.text(`Resolution Rate: ${reportData.analytics.resolutionRate}%`, 20, 110)

      // Add distribution tables
      let yPos = 130

      // Status distribution
      doc.setFontSize(12)
      doc.text('Status Distribution', 20, yPos)
      yPos += 10

      const statusData = Object.entries(reportData.analytics.statusDistribution).map(([status, count]) => [
        status,
        (count as number).toString(),
        `${((count as number) / reportData.analytics.totalIncidents * 100).toFixed(1)}%`
      ])

      doc.autoTable({
        head: [['Status', 'Count', 'Percentage']],
        body: statusData,
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      })

      yPos = doc.lastAutoTable.finalY + 20

      // Incident type distribution
      doc.setFontSize(12)
      doc.text('Incident Type Distribution', 20, yPos)
      yPos += 10

      const typeData = Object.entries(reportData.analytics.typeDistribution).map(([type, count]) => [
        type,
        (count as number).toString(),
        `${((count as number) / reportData.analytics.totalIncidents * 100).toFixed(1)}%`
      ])

      doc.autoTable({
        head: [['Type', 'Count', 'Percentage']],
        body: typeData,
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      })

      yPos = doc.lastAutoTable.finalY + 20

      // Barangay distribution
      doc.setFontSize(12)
      doc.text('Barangay Distribution', 20, yPos)
      yPos += 10

      const barangayData = Object.entries(reportData.analytics.barangayDistribution)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10) // Top 10 barangays
        .map(([barangay, count]) => [
          barangay,
          (count as number).toString(),
          `${((count as number) / reportData.analytics.totalIncidents * 100).toFixed(1)}%`
        ])

      doc.autoTable({
        head: [['Barangay', 'Count', 'Percentage']],
        body: barangayData,
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      })
    }

    // Add footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(`Page ${i} of ${pageCount}`, 20, doc.internal.pageSize.height - 10)
      doc.text('RVOIS - Resident Volunteer Operations Information System', doc.internal.pageSize.width - 100, doc.internal.pageSize.height - 10)
    }

    // Create blob and download
    const blob = doc.output('blob')
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

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

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to generate report')
      }

      // Generate PDF on client side
      await generatePDFReport(result.data, result.reportType)

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
                      <SelectItem value="all">All Statuses</SelectItem>
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
                      <SelectItem value="all">All Severity Levels</SelectItem>
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