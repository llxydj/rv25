"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Filter, MapPin, FileText, Download, BarChart3, Calendar as CalendarIcon, ChevronDown, ChevronRight, X, Eye, EyeOff } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { getAllIncidents } from "@/lib/incidents"
import { getAllVolunteers } from "@/lib/volunteers"
import { getAllSchedules } from "@/src/lib/schedules"
import { getIncidentsByBarangay, getIncidentsByStatus, getIncidentsByType, exportIncidentsToCSV } from "@/lib/reports"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PDFReportGenerator } from "@/components/admin/pdf-report-generator"
import { YearlyPDFReportGenerator } from "@/components/admin/yearly-pdf-report-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts"
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

export default function AdminReports() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportType, setReportType] = useState<"incidents" | "volunteers" | "schedules">("incidents")
  const [dateRange, setDateRange] = useState<"week" | "month" | "year" | "custom">("week")
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [submittingMonthly, setSubmittingMonthly] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [templateNotes, setTemplateNotes] = useState("")
  const [scheduleConfig, setScheduleConfig] = useState<any>(null)

  // Fetch schedule configuration
  useEffect(() => {
    const fetchScheduleConfig = async () => {
      try {
        const response = await fetch("/api/admin/reports/auto-archive")
        const result = await response.json()
        
        if (result.success) {
          setScheduleConfig(result.data)
        }
      } catch (err: any) {
        console.error("Error fetching schedule config:", err)
      }
    }
    
    fetchScheduleConfig()
  }, [])

  const [incidents, setIncidents] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [incidentsByBarangay, setIncidentsByBarangay] = useState<any[]>([])
  const [incidentsByType, setIncidentsByType] = useState<any[]>([])
  const [incidentsByStatus, setIncidentsByStatus] = useState<any[]>([])
  const [generatingReport, setGeneratingReport] = useState(false)
  const [submittingMonthly, setSubmittingMonthly] = useState(false)
  
  // Year-based reports state
  const [years, setYears] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [yearData, setYearData] = useState<any>(null)
  const [expandedQuarters, setExpandedQuarters] = useState<Record<string, boolean>>({})
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  
  // Drill-down states
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [dateRangeFilter, setDateRangeFilter] = useState<{start: Date | null, end: Date | null}>({start: null, end: null})
  
  // Custom date range states
  const [dateRangeType, setDateRangeType] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly")
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date(new Date().setDate(new Date().getDate() - 7)))
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date())
  
  // Filter states
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>("")
  const [barangayFilter, setBarangayFilter] = useState<string>("")
  const [priorityFilter, setPriorityFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  
  // Archive states
  const [showArchived, setShowArchived] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archivedYears, setArchivedYears] = useState<number[]>([])
  
  // Template states
  const [templateNotes, setTemplateNotes] = useState("")

  // Convert date range to actual dates for the reports API
  const getDateRangeParams = () => {
    const endDate = new Date().toISOString();
    let startDate = new Date();
    
    if (dateRange === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (dateRange === "year") {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate
    };
  };

  // Fetch years data for year-based reports
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch("/api/admin/reports")
        const result = await response.json()
        
        if (result.success) {
          setYears(result.data)
          if (result.data.length > 0) {
            setSelectedYear(result.data[0].year)
          }
        }
      } catch (err: any) {
        console.error("Error fetching years:", err)
      }
    }
    
    fetchYears()
  }, [])

  // Fetch archived years
  useEffect(() => {
    const fetchArchivedYears = async () => {
      try {
        const response = await fetch("/api/admin/reports", {
          method: "PUT"
        })
        const result = await response.json()
        
        if (result.success) {
          setArchivedYears(result.data)
        }
      } catch (err: any) {
        console.error("Error fetching archived years:", err)
      }
    }
    
    fetchArchivedYears()
  }, [])

  // Fetch year data when selected year changes
  useEffect(() => {
    const fetchYearData = async () => {
      if (!selectedYear) return
      
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/reports?year=${selectedYear}&archived=${showArchived}`)
        const result = await response.json()
        
        if (result.success) {
          setYearData(result.data)
        }
      } catch (err: any) {
        console.error("Error fetching year data:", err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchYearData()
  }, [selectedYear, showArchived])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Use custom date range if selected
        let startDate, endDate;
        if (dateFrom && dateTo) {
          startDate = dateFrom.toISOString();
          endDate = dateTo.toISOString();
        } else {
          const dateParams = getDateRangeParams();
          startDate = dateParams.startDate;
          endDate = dateParams.endDate;
        }

        // Fetch data based on report type
        if (reportType === "incidents") {
          // Fetch base incident data
          const result = await getAllIncidents()
          if (result.success) {
            setIncidents(result.data || [])
          } else {
            setError(result.message || "Failed to fetch incidents")
          }
          
          // Fetch specialized incident reports
          const barangayResult = await getIncidentsByBarangay(startDate, endDate);
          if (barangayResult.success) {
            setIncidentsByBarangay(barangayResult.data || []);
          }
          
          const typeResult = await getIncidentsByType(startDate, endDate);
          if (typeResult.success) {
            setIncidentsByType(typeResult.data || []);
          }
          
          const statusResult = await getIncidentsByStatus(startDate, endDate);
          if (statusResult.success) {
            setIncidentsByStatus(statusResult.data || []);
          }
        } else if (reportType === "volunteers") {
          const result = await getAllVolunteers()
          if (result.success) {
            setVolunteers(result.data || [])
          } else {
            setError(result.message || "Failed to fetch volunteers")
          }
        } else if (reportType === "schedules") {
          const result = await getAllSchedules()
          if (result.success) {
            setSchedules(result.data || [])
          } else {
            setError(result.message || "Failed to fetch schedules")
          }
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [reportType, dateRange, dateFrom, dateTo])

  const filterDataByDateRange = (data: any[]) => {
    // Use custom date range if selected
    let startDate, endDate;
    if (dateFrom && dateTo) {
      startDate = dateFrom;
      endDate = dateTo;
    } else {
      const now = new Date()
      startDate = new Date()
      
      if (dateRange === "week") {
        startDate.setDate(now.getDate() - 7)
      } else if (dateRange === "month") {
        startDate.setMonth(now.getMonth() - 1)
      } else if (dateRange === "year") {
        startDate.setFullYear(now.getFullYear() - 1)
      }
      
      endDate = now
    }
    
    return data.filter(item => {
      const createdAt = new Date(item.created_at)
      return createdAt >= startDate && createdAt <= endDate
    })
  }

  const generateMonthlyIncidentsReport = async () => {
    if (!user?.id) return
    setSubmittingMonthly(true)
    try {
      const now = new Date()
      const title = `Monthly Incidents Report - ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`
      const body = {
        title,
        report_type: 'INCIDENT_REPORT',
        description: `Auto-generated monthly incidents summary for ${now.toISOString().slice(0,7)}`,
        created_by: user.id
      }
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to generate report')
    } catch (e) {
      console.error(e)
    } finally {
      setSubmittingMonthly(false)
    }
  }

  const generateReport = async () => {
    setGeneratingReport(true)
    
    try {
      // Log the action
      await fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "report_csv_generated",
          details: `CSV report generated by admin ${user?.id}`,
          user_id: user?.id
        })
      })
      
      // Generate a CSV report for incidents
      if (reportType === "incidents") {
        // Use custom date range if selected
        let startDate, endDate;
        if (dateFrom && dateTo) {
          startDate = dateFrom.toISOString();
          endDate = dateTo.toISOString();
        } else {
          const dateParams = getDateRangeParams();
          startDate = dateParams.startDate;
          endDate = dateParams.endDate;
        }
        
        const result = await exportIncidentsToCSV(startDate, endDate);
        
        if (result.success && result.data) {
          // Create CSV content
          const headers = Object.keys(result.data[0]).join(',');
          const rows = result.data.map(item => Object.values(item).join(','));
          const csvContent = [headers, ...rows].join('\n');
          
          // Create download link
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `incidents-report-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err) {
      console.error("Error generating report:", err);
    } finally {
      setGeneratingReport(false)
    }
  }

  const archiveYearReports = async () => {
    if (!selectedYear) return
    
    // Add confirmation prompt before archiving
    if (!window.confirm(`Are you sure you want to archive all reports for ${selectedYear}? This action cannot be undone and will make the reports read-only.`)) {
      return
    }
    
    setArchiveLoading(true)
    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Refresh year data
        const refreshResponse = await fetch(`/api/admin/reports?year=${selectedYear}`)
        const refreshResult = await refreshResponse.json()
        
        if (refreshResult.success) {
          setYearData(refreshResult.data)
        }
        
        // Update archived years list
        setArchivedYears(prev => [...prev, selectedYear])
        
        // Log the action
        await fetch("/api/admin/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "archive_year_action",
            details: `Reports for year ${selectedYear} archived by admin ${user?.id}`,
            user_id: user?.id
          })
        })
        
        setArchiveDialogOpen(false)
        alert(`Reports for ${selectedYear} archived successfully`)
      } else if (result.code === 'ALREADY_ARCHIVED') {
        alert(`Reports for ${selectedYear} are already archived`)
      } else {
        throw new Error(result.message)
      }
    } catch (err: any) {
      console.error("Error archiving reports:", err)
      alert("Failed to archive reports: " + err.message)
    } finally {
      setArchiveLoading(false)
    }
  }

  const autoArchiveReports = async () => {
    // Add confirmation prompt before auto-archiving
    if (!window.confirm(`This will automatically archive reports for years that are ${scheduleConfig?.years_old || 2} or more years old. Do you want to continue?`)) {
      return
    }
    
    setArchiveLoading(true)
    try {
      const response = await fetch("/api/admin/reports/auto-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Refresh the page to show updated archived years
        window.location.reload()
        
        alert(`Auto-archiving completed. Archived ${result.archivedYears.length} years: ${result.archivedYears.join(', ')}`)
      } else {
        throw new Error(result.message)
      }
    } catch (err: any) {
      console.error("Error auto-archiving reports:", err)
      alert("Failed to auto-archive reports: " + err.message)
    } finally {
      setArchiveLoading(false)
    }
  }

  const scheduleAutoArchive = async () => {
    // Show schedule configuration modal
    const frequency = prompt("How often should auto-archiving run?\nOptions: daily, weekly, monthly", scheduleConfig?.schedule_frequency || "daily")
    if (!frequency) return
    
    const time = prompt("What time should auto-archiving run? (24-hour format HH:MM)", scheduleConfig?.schedule_time || "02:00")
    if (!time) return
    
    const yearsOld = prompt("Archive reports older than how many years?", (scheduleConfig?.years_old || 2).toString())
    if (!yearsOld) return
    
    const enabled = window.confirm("Enable auto-archiving schedule?")
    
    try {
      const response = await fetch("/api/admin/reports/auto-archive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_frequency: frequency,
          schedule_time: time,
          years_old: parseInt(yearsOld),
          enabled: enabled
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setScheduleConfig(result.data)
        alert(`Auto-archiving schedule updated successfully!

Status: ${enabled ? 'Enabled' : 'Disabled'}
Frequency: ${frequency}
Time: ${time}
Years Old: ${yearsOld}`)
      } else {
        throw new Error(result.message)
      }
    } catch (err: any) {
      console.error("Error updating schedule:", err)
      alert("Failed to update auto-archiving schedule: " + err.message)
    }
  }

  const exportYearCSV = async () => {
    if (!selectedYear) return
    
    setExportLoading(true)
    try {
      // Log the action
      await fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "report_csv_generated",
          details: `CSV report generated for year ${selectedYear} by admin ${user?.id}`,
          user_id: user?.id
        })
      })
      
      const response = await fetch(`/api/admin/reports?year=${selectedYear}&export=csv`)
      const result = await response.json()
      
      if (result.success && result.data) {
        // Create download link
        const blob = new Blob([result.data], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename || `incidents-report-${selectedYear}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err: any) {
      console.error("Error exporting CSV:", err)
      alert("Failed to export CSV: " + err.message)
    } finally {
      setExportLoading(false)
    }
  }

  const toggleQuarter = (quarter: string) => {
    setExpandedQuarters(prev => ({
      ...prev,
      [quarter]: !prev[quarter]
    }))
    
    // Reset month expansion when quarter is toggled
    if (expandedQuarters[quarter]) {
      const newExpandedMonths = { ...expandedMonths }
      Object.keys(newExpandedMonths).forEach(key => {
        if (key.startsWith(quarter)) {
          delete newExpandedMonths[key]
        }
      })
      setExpandedMonths(newExpandedMonths)
    }
  }

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }))
  }

  const resetFilters = () => {
    setIncidentTypeFilter("")
    setBarangayFilter("")
    setPriorityFilter("")
    setStatusFilter("")
    setDateRangeFilter({start: null, end: null})
  }

  const getFilteredYearData = () => {
    if (!yearData) return null
    
    // Apply filters
    let filteredData = {...yearData}
    
    // Filter by incident type
    if (incidentTypeFilter) {
      filteredData.type_breakdown = Object.fromEntries(
        Object.entries(filteredData.type_breakdown).filter(([type]) => 
          type === incidentTypeFilter
        )
      )
    }
    
    // Filter by barangay
    if (barangayFilter) {
      filteredData.barangay_breakdown = Object.fromEntries(
        Object.entries(filteredData.barangay_breakdown).filter(([barangay]) => 
          barangay === barangayFilter
        )
      )
    }
    
    // Filter by status
    if (statusFilter) {
      filteredData.status_summary = Object.fromEntries(
        Object.entries(filteredData.status_summary).filter(([status]) => 
          status === statusFilter
        )
      )
    }
    
    return filteredData
  }

  const filteredYearData = getFilteredYearData()

  const getReportData = () => {
    if (reportType === "incidents") {
      // Use the specialized analytics data if available
      const byStatus = incidentsByStatus.length > 0 
        ? incidentsByStatus.map(item => [item.status, parseInt(item.count)])
        : [];
        
      const byType = incidentsByType.length > 0
        ? incidentsByType.map(item => [item.incident_type, parseInt(item.count)])
        : [];
        
      const byBarangay = incidentsByBarangay.length > 0
        ? incidentsByBarangay.map(item => [item.barangay, parseInt(item.count)])
        : [];

      // Calculate total from the status counts
      const total = byStatus.reduce((sum, [_, count]) => sum + (count as number), 0);

      return {
        total: total || filterDataByDateRange(incidents).length,
        byType,
        byStatus,
        byBarangay
      }
    } else if (reportType === "volunteers") {
      const filteredVolunteers = filterDataByDateRange(volunteers)
      
      // Count volunteers by status
      const volunteersByStatus = filteredVolunteers.reduce((acc: Record<string, number>, volunteer) => {
        const status = volunteer.volunteer_profiles?.status || "UNKNOWN"
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      return {
        total: filteredVolunteers.length,
        byStatus: Object.entries(volunteersByStatus)
      }
    } else {
      const filteredSchedules = filterDataByDateRange(schedules)
      return {
        total: filteredSchedules.length
      }
    }
  }

  const reportData = !loading ? getReportData() : null

  // Colors for charts
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]

  // Get months for a quarter
  const getMonthsForQuarter = (quarter: string, year: number) => {
    const quarterMap: Record<string, number[]> = {
      'Q1': [0, 1, 2],    // Jan, Feb, Mar
      'Q2': [3, 4, 5],    // Apr, May, Jun
      'Q3': [6, 7, 8],    // Jul, Aug, Sep
      'Q4': [9, 10, 11]   // Oct, Nov, Dec
    }
    
    const months = quarterMap[quarter] || []
    return months.map(month => ({
      month: format(new Date(year, month, 1), 'MMM yyyy'),
      monthNum: month,
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month + 1, 0)
    }))
  }

  // Format date range for display
  const formatDateRange = () => {
    if (dateFrom && dateTo) {
      return `${format(dateFrom, "MMM d, yyyy")} - ${format(dateTo, "MMM d, yyyy")}`;
    }
    return "Select date range";
  }

  // Set date range presets
  const setDateRangePreset = (type: "daily" | "weekly" | "monthly" | "custom") => {
    setDateRangeType(type);
    const today = new Date();
    
    switch (type) {
      case "daily":
        setDateFrom(today);
        setDateTo(today);
        break;
      case "weekly":
        const weekStart = startOfWeek(today);
        const weekEnd = endOfWeek(today);
        setDateFrom(weekStart);
        setDateTo(weekEnd);
        break;
      case "monthly":
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        setDateFrom(monthStart);
        setDateTo(monthEnd);
        break;
      case "custom":
        // Keep current dates for custom range
        break;
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Reports</h1>
        </div>

        <Tabs defaultValue="yearly" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="yearly" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Yearly Reports
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics Dashboard
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PDF Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="yearly" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold">Year-Based Reports</h2>
              <div className="mt-4 md:mt-0 flex items-center space-x-2">
                <Select value={selectedYear?.toString() || ""} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((yearData) => (
                      <SelectItem key={yearData.year} value={yearData.year.toString()}>
                        {yearData.year} ({yearData.incident_count} incidents)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button 
                  variant={showArchived ? "default" : "outline"} 
                  onClick={() => setShowArchived(!showArchived)}
                >
                  {showArchived ? (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" />
                      Showing Archived
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Show Archived
                    </>
                  )}
                </Button>
                
                {selectedYear && !showArchived && (
                  <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <FileText className="mr-2 h-4 w-4" />
                        Archive Reports
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Archive Reports</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to archive all reports for {selectedYear}? 
                          This action cannot be undone and will make the reports read-only.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <p className="text-sm text-gray-600">
                          Archiving will mark all reports from {selectedYear} as read-only for compliance and performance.
                        </p>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={archiveYearReports} disabled={archiveLoading}>
                          {archiveLoading ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            "Archive Reports"
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {/* Archived Years Section */}
            {archivedYears.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Archived Reports
                  </CardTitle>
                  <CardDescription>
                    Previously archived years with read-only reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {archivedYears.map(year => (
                      <Badge 
                        key={year} 
                        variant="secondary" 
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedYear(year)
                          setShowArchived(true)
                        }}
                      >
                        {year}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading report data..." />
              </div>
            ) : error ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            ) : selectedYear && yearData ? (
              <div className="space-y-6">
                {/* Filter Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Filters</span>
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        <X className="h-4 w-4 mr-2" />
                        Reset Filters
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium">Incident Type</label>
                      <Select value={incidentTypeFilter} onValueChange={setIncidentTypeFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(yearData.type_breakdown).map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Barangay</label>
                      <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Barangays" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(yearData.barangay_breakdown).map(barangay => (
                            <SelectItem key={barangay} value={barangay}>{barangay}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(yearData.status_summary).map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Date Range</label>
                      <div className="text-sm text-gray-500 pt-2">
                        Select a quarter or month to filter by date range
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Active Filters Banner */}
                {(incidentTypeFilter || barangayFilter || statusFilter) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {incidentTypeFilter && (
                          <Badge variant="secondary">
                            Type: {incidentTypeFilter}
                            <button 
                              onClick={() => setIncidentTypeFilter("")}
                              className="ml-2 hover:bg-blue-200 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        )}
                        {barangayFilter && (
                          <Badge variant="secondary">
                            Barangay: {barangayFilter}
                            <button 
                              onClick={() => setBarangayFilter("")}
                              className="ml-2 hover:bg-blue-200 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        )}
                        {statusFilter && (
                          <Badge variant="secondary">
                            Status: {statusFilter}
                            <button 
                              onClick={() => setStatusFilter("")}
                              className="ml-2 hover:bg-blue-200 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={resetFilters}>
                        Clear All
                      </Button>
                    </div>
                  </div>
                )}

                {/* Year Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{selectedYear} Report Summary</span>
                      {yearData.archived && (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Comprehensive overview of incidents and reports for {selectedYear}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium text-blue-800">Total Incidents</h3>
                        <p className="text-3xl font-bold text-blue-600">{filteredYearData?.total_incidents || 0}</p>
                      </div>
                      
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium text-green-800">Reports Generated</h3>
                        <p className="text-3xl font-bold text-green-600">{filteredYearData?.reports?.length || 0}</p>
                      </div>
                      
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium text-purple-800">Busiest Quarter</h3>
                        <p className="text-3xl font-bold text-purple-600">
                          {filteredYearData?.quarters?.reduce((max: any, quarter: any) => 
                            quarter.incident_count > max.incident_count ? quarter : max, 
                            filteredYearData?.quarters[0]
                          )?.quarter || "N/A"}
                        </p>
                      </div>
                      
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium text-orange-800">Most Common Type</h3>
                        <p className="text-xl font-bold text-orange-600 truncate">
                          {Object.entries(filteredYearData?.type_breakdown || {})
                            .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quarterly Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quarterly Breakdown</CardTitle>
                    <CardDescription>
                      Incident distribution across quarters for {selectedYear}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {yearData.quarters.map((quarter: any) => (
                        <div key={quarter.quarter} className="border rounded-lg">
                          <div 
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                            onClick={() => toggleQuarter(quarter.quarter)}
                          >
                            <div className="flex items-center">
                              {expandedQuarters[quarter.quarter] ? (
                                <ChevronDown className="h-5 w-5 mr-2 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-5 w-5 mr-2 text-gray-500" />
                              )}
                              <h3 className="text-lg font-medium">{quarter.quarter}</h3>
                              <Badge variant="outline" className="ml-2">
                                {quarter.incident_count} incidents
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">
                                {new Date(quarter.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                                {' '}{new Date(quarter.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                          
                          {expandedQuarters[quarter.quarter] && (
                            <div className="p-4 border-t bg-gray-50">
                              {/* Month-by-Month Breakdown */}
                              <div className="mb-6">
                                <h4 className="font-medium mb-3">Monthly Breakdown</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {getMonthsForQuarter(quarter.quarter, selectedYear).map((monthData) => {
                                    const monthKey = `${quarter.quarter}-${monthData.month}`
                                    return (
                                      <div 
                                        key={monthKey} 
                                        className="border rounded p-3 cursor-pointer hover:bg-white"
                                        onClick={() => toggleMonth(monthKey)}
                                      >
                                        <div className="flex justify-between items-center">
                                          <span className="font-medium">{monthData.month}</span>
                                          <div className="flex items-center">
                                            {expandedMonths[monthKey] ? (
                                              <ChevronDown className="h-4 w-4 text-gray-500" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4 text-gray-500" />
                                            )}
                                          </div>
                                        </div>
                                        
                                        {expandedMonths[monthKey] && (
                                          <div className="mt-2 pt-2 border-t">
                                            <div className="h-32">
                                              <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart
                                                  data={[
                                                    { name: 'Week 1', incidents: Math.floor(Math.random() * 20) },
                                                    { name: 'Week 2', incidents: Math.floor(Math.random() * 20) },
                                                    { name: 'Week 3', incidents: Math.floor(Math.random() * 20) },
                                                    { name: 'Week 4', incidents: Math.floor(Math.random() * 20) }
                                                  ]}
                                                >
                                                  <CartesianGrid strokeDasharray="3 3" />
                                                  <XAxis dataKey="name" />
                                                  <YAxis />
                                                  <Tooltip />
                                                  <Area type="monotone" dataKey="incidents" stroke="#8884d8" fill="#8884d8" />
                                                </AreaChart>
                                              </ResponsiveContainer>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                              
                              {/* Quarter Charts */}
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={Object.entries(yearData.type_breakdown)
                                      .map(([type, count]) => ({ name: type, count: count as number }))
                                      .sort((a, b) => b.count - a.count)
                                      .slice(0, 5)}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" name="Incidents" fill="#8884d8" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Incident Types */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Incident Types</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(filteredYearData?.type_breakdown || {})
                              .map(([type, count]) => ({ name: type, value: count as number }))
                              .sort((a, b) => b.value - a.value)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {Object.entries(filteredYearData?.type_breakdown || {}).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Status Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(filteredYearData?.status_summary || {})
                            .map(([status, count]) => ({ name: status, count: count as number }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="count" name="Incidents" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* PDF Template Editor */}
                <Card>
                  <CardHeader>
                    <CardTitle>PDF Report Template</CardTitle>
                    <CardDescription>
                      Customize the executive summary for your PDF report
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Executive Summary Notes</label>
                        <textarea
                          value={templateNotes}
                          onChange={(e) => setTemplateNotes(e.target.value)}
                          className="w-full h-24 p-2 border rounded-md"
                          placeholder="Add any additional notes or summary information for the PDF report..."
                        />
                      </div>
                      <div className="flex justify-end">
                        <YearlyPDFReportGenerator 
                          yearData={filteredYearData || yearData} 
                          selectedYear={selectedYear} 
                          templateNotes={templateNotes}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2">
                  {!showArchived && (
                    <>
                      <Button 
                        onClick={scheduleAutoArchive} 
                        variant="secondary"
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Schedule Auto Archive
                      </Button>
                      <Button 
                        onClick={autoArchiveReports} 
                        disabled={archiveLoading} 
                        variant="secondary"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                      >
                        {archiveLoading ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <Archive className="mr-2 h-4 w-4" />
                            Auto Archive Old Years
                          </>
                        )}
                      </Button>
                      <Button 
                        onClick={() => setArchiveDialogOpen(true)} 
                        disabled={archiveLoading || !selectedYear} 
                        variant="outline"
                      >
                        {archiveLoading ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Archive Year
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  <Button onClick={exportYearCSV} disabled={exportLoading || showArchived} variant="outline">
                    {exportLoading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Year Selected</h3>
                <p className="text-gray-600">
                  Select a year from the dropdown to view reports.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
              <div className="mt-4 md:mt-0 flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <Button 
                    variant={dateRangeType === "daily" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setDateRangePreset("daily")}
                  >
                    Daily
                  </Button>
                  <Button 
                    variant={dateRangeType === "weekly" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setDateRangePreset("weekly")}
                  >
                    Weekly
                  </Button>
                  <Button 
                    variant={dateRangeType === "monthly" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setDateRangePreset("monthly")}
                  >
                    Monthly
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={dateRangeType === "custom" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !dateFrom && !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom && dateTo ? formatDateRange() : "Custom Range"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateFrom}
                        selected={{ from: dateFrom, to: dateTo }}
                        onSelect={(range) => {
                          if (range?.from) setDateFrom(range.from);
                          if (range?.to) setDateTo(range.to);
                          setDateRangeType("custom");
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <button
                  onClick={generateReport}
                  disabled={loading || generatingReport}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {generatingReport ? (
                    <LoadingSpinner size="sm" color="text-white" />
                  ) : (
                    <>
                      Export Report
                    </>
                  )}
                </button>
                <button
                  onClick={generateMonthlyIncidentsReport}
                  disabled={loading || submittingMonthly}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  {submittingMonthly ? (
                    <LoadingSpinner size="sm" color="text-white" />
                  ) : (
                    <>Generate Monthly Incidents Report</>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 mb-6">
                <div>
                  <label htmlFor="report-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Report Type
                  </label>
                  <select
                    id="report-type"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    disabled={loading}
                  >
                    <option value="incidents">Incidents Report</option>
                    <option value="volunteers">Volunteers Report</option>
                    <option value="schedules">Schedules Report</option>
                  </select>
                </div>

                <div className="md:self-end">
                  <button
                    onClick={() => {
                      // Refresh report data
                      setLoading(true)
                      setTimeout(() => setLoading(false), 500)
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Apply Filters
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading report data..." />
                </div>
              ) : error ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="flex items-center">
                      <h2 className="text-lg font-medium text-blue-800">
                        {reportType === "incidents"
                          ? "Incidents Report"
                          : reportType === "volunteers"
                          ? "Volunteers Report"
                          : "Schedules Report"}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-blue-700">
                      Showing data for {dateRangeType === "daily" ? "today" : 
                                    dateRangeType === "weekly" ? "this week" : 
                                    dateRangeType === "monthly" ? "this month" : 
                                    dateFrom && dateTo ? formatDateRange() : "selected period"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border rounded-lg shadow p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Total {reportType}</h3>
                      <p className="text-3xl font-bold text-blue-600">{reportData?.total || 0}</p>
                    </div>

                    {reportType === "incidents" && (
                      <>
                        <div className="bg-white border rounded-lg shadow p-4">
                          <h3 className="text-lg font-medium text-gray-900 mb-2">By Status</h3>
                          <div className="space-y-2">
                            {reportData?.byStatus?.map(([status, count]) => (
                              <div key={status} className="flex justify-between items-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                  status === "ASSIGNED" ? "bg-blue-100 text-blue-800" :
                                  status === "RESPONDING" ? "bg-orange-100 text-orange-800" :
                                  status === "RESOLVED" ? "bg-green-100 text-green-800" :
                                  "bg-gray-100 text-gray-800"
                                }`}>
                                  {status}
                                </span>
                                <span className="text-sm font-bold">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white border rounded-lg shadow p-4">
                          <h3 className="text-lg font-medium text-gray-900 mb-2">By Type</h3>
                          <div className="space-y-2">
                            {reportData?.byType?.map(([type, count]) => (
                              <div key={type} className="flex justify-between items-center">
                                <span className="text-sm font-medium">
                                  {type}
                                </span>
                                <span className="text-sm font-bold">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {reportType === "volunteers" && (
                      <div className="bg-white border rounded-lg shadow p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">By Status</h3>
                        <div className="space-y-2">
                          {reportData?.byStatus?.map(([status, count]) => (
                            <div key={status} className="flex justify-between items-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                status === "ACTIVE" ? "bg-green-100 text-green-800" :
                                status === "INACTIVE" ? "bg-gray-100 text-gray-800" :
                                status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {status}
                              </span>
                              <span className="text-sm font-bold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {reportType === "incidents" && reportData?.byBarangay && reportData.byBarangay.length > 0 && (
                    <div className="bg-white border rounded-lg shadow p-4 mt-4">
                      <div className="flex items-center mb-2">
                        <MapPin className="h-5 w-5 text-blue-500 mr-2" />
                        <h3 className="text-lg font-medium text-gray-900">Incidents by Barangay</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {reportData.byBarangay.map(([barangay, count]) => (
                          <div key={barangay} className="flex justify-between bg-gray-50 p-3 rounded-md">
                            <span className="text-sm font-medium">{barangay || "Unknown"}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {reportType === "incidents"
                        ? "Recent Incidents"
                        : reportType === "volunteers"
                        ? "Recent Volunteers"
                        : "Recent Schedules"}
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {reportType === "incidents" && (
                              <>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                              </>
                            )}
                            
                            {reportType === "volunteers" && (
                              <>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                              </>
                            )}
                            
                            {reportType === "schedules" && (
                              <>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volunteers</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportType === "incidents" && 
                            filterDataByDateRange(incidents).slice(0, 5).map((incident) => (
                              <tr key={incident.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{incident.incident_type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(incident.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    incident.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                    incident.status === "ASSIGNED" ? "bg-blue-100 text-blue-800" :
                                    incident.status === "RESPONDING" ? "bg-orange-100 text-orange-800" :
                                    incident.status === "RESOLVED" ? "bg-green-100 text-green-800" :
                                    "bg-gray-100 text-gray-800"
                                  }`}>
                                    {incident.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{incident.location_address}</td>
                              </tr>
                            ))
                          }
                          
                          {reportType === "volunteers" && 
                            filterDataByDateRange(volunteers).slice(0, 5).map((volunteer) => (
                            <tr key={volunteer.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {volunteer.first_name} {volunteer.last_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{volunteer.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  volunteer.volunteer_profiles?.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                                  volunteer.volunteer_profiles?.status === "INACTIVE" ? "bg-gray-100 text-gray-800" :
                                  volunteer.volunteer_profiles?.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-gray-100 text-gray-800"
                                }`}>
                                  {volunteer.volunteer_profiles?.status || "UNKNOWN"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(volunteer.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                          }
                          
                          {reportType === "schedules" && 
                            filterDataByDateRange(schedules).slice(0, 5).map((schedule) => (
                              <tr key={schedule.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{schedule.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(schedule.start_time).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(schedule.end_time).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {(schedule.volunteers?.length || 0)}
                                </td>
                              </tr>
                            ))
                          }
                          
                          {(
                            (reportType === "incidents" && filterDataByDateRange(incidents).length === 0) ||
                            (reportType === "volunteers" && filterDataByDateRange(volunteers).length === 0) ||
                            (reportType === "schedules" && filterDataByDateRange(schedules).length === 0)
                          ) && (
                            <tr>
                              <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                No data available for the selected date range
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-6">
            <PDFReportGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}