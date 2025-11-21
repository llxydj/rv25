"use client"

import { useState, useEffect, useMemo } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Filter, MapPin, FileText, Download, BarChart3, Calendar as CalendarIcon, ChevronDown, ChevronRight, X, Eye, EyeOff, Clock, Archive } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { getAllIncidents } from "@/lib/incidents"
import { getAllVolunteers } from "@/lib/volunteers"
import { getAllSchedules } from "@/lib/schedules"
import { getIncidentsByBarangay, getIncidentsByStatus, getIncidentsByType, exportIncidentsToCSV } from "@/lib/reports"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PDFReportGenerator } from "@/components/admin/pdf-report-generator"
import { YearlyPDFReportGenerator } from "@/components/admin/yearly-pdf-report-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts"
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

export default function AdminReports() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportType, setReportType] = useState<"incidents" | "volunteers" | "schedules">("incidents")
  const [dateRange, setDateRange] = useState<"week" | "month" | "year" | "custom">("week")
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(new Date().getDate() - 7)))
  const [dateTo, setDateTo] = useState(new Date())
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [submittingMonthly, setSubmittingMonthly] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [templateNotes, setTemplateNotes] = useState("")
  const [scheduleConfig, setScheduleConfig] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [volunteers, setVolunteers] = useState([])
  const [schedules, setSchedules] = useState([])
  const [incidentsByBarangay, setIncidentsByBarangay] = useState([])
  const [incidentsByType, setIncidentsByType] = useState([])
  const [incidentsByStatus, setIncidentsByStatus] = useState([])
  
  // Year-based reports state
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [yearData, setYearData] = useState(null)
  const [expandedQuarters, setExpandedQuarters] = useState<Record<string, boolean>>({})
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
  
  // Drill-down states
  const [selectedQuarter, setSelectedQuarter] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [dateRangeFilter, setDateRangeFilter] = useState<{start: Date | null, end: Date | null}>({start: null, end: null})
  
  // Custom date range states
  const [dateRangeType, setDateRangeType] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly")
  
  // Filter states
  const [incidentTypeFilter, setIncidentTypeFilter] = useState("")
  const [barangayFilter, setBarangayFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  
  // Archive states
  const [showArchived, setShowArchived] = useState(false)
  const [archivedYears, setArchivedYears] = useState([])

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

  // Convert date range to actual dates for the reports API
  const getDateRangeParams = () => {
    const endDate = new Date().toISOString()
    let startDate = new Date()
    if (dateRange === "week") {
      startDate.setDate(startDate.getDate() - 7)
    } else if (dateRange === "month") {
      startDate.setMonth(startDate.getMonth() - 1)
    } else if (dateRange === "year") {
      startDate.setFullYear(startDate.getFullYear() - 1)
    }
    return { startDate: startDate.toISOString(), endDate }
  }

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
        const response = await fetch("/api/admin/reports", { method: "PUT" })
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

        let startDate, endDate
        if (dateFrom && dateTo) {
          startDate = dateFrom.toISOString()
          endDate = dateTo.toISOString()
        } else {
          const dateParams = getDateRangeParams()
          startDate = dateParams.startDate
          endDate = dateParams.endDate
        }

        if (reportType === "incidents") {
          const result = await getAllIncidents()
          if (result.success) {
            setIncidents(result.data || [])
          } else {
            setError(result.message || "Failed to fetch incidents")
          }

          const barangayResult = await getIncidentsByBarangay(startDate, endDate)
          if (barangayResult.success) {
            setIncidentsByBarangay(barangayResult.data || [])
          }

          const typeResult = await getIncidentsByType(startDate, endDate)
          if (typeResult.success) {
            setIncidentsByType(typeResult.data || [])
          }

          const statusResult = await getIncidentsByStatus(startDate, endDate)
          if (statusResult.success) {
            setIncidentsByStatus(statusResult.data || [])
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
    let startDate, endDate
    if (dateFrom && dateTo) {
      startDate = dateFrom
      endDate = dateTo
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
      await fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_csv_generated",
          details: `CSV report generated by admin ${user?.id}`,
          user_id: user?.id
        })
      })

      if (reportType === "incidents") {
        let startDate, endDate
        if (dateFrom && dateTo) {
          startDate = dateFrom.toISOString()
          endDate = dateTo.toISOString()
        } else {
          const dateParams = getDateRangeParams()
          startDate = dateParams.startDate
          endDate = dateParams.endDate
        }
        const result = await exportIncidentsToCSV(startDate, endDate)
        if (result.success && result.data) {
          const headers = Object.keys(result.data[0]).join(',')
          const rows = result.data.map(item => Object.values(item).join(','))
          const csvContent = [headers, ...rows].join('\n')
          const blob = new Blob([csvContent], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `incidents-report-${new Date().toISOString().split('T')[0]}.csv`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    } catch (err) {
      console.error("Error generating report:", err)
    } finally {
      setGeneratingReport(false)
    }
  }

  const archiveYearReports = async () => {
    if (!selectedYear) return
    if (!window.confirm(`Are you sure you want to archive all reports for ${selectedYear}? This action cannot be undone.`)) {
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
        const refreshResponse = await fetch(`/api/admin/reports?year=${selectedYear}`)
        const refreshResult = await refreshResponse.json()
        if (refreshResult.success) {
          setYearData(refreshResult.data)
        }
        setArchivedYears(prev => [...prev, selectedYear])
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
    if (!window.confirm(`This will automatically archive reports for years that are ${scheduleConfig?.years_old || 2} or more years old. Continue?`)) {
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
        window.location.reload()
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
        alert(`Auto-archiving schedule updated! Status: ${enabled ? 'Enabled' : 'Disabled'}\nFrequency: ${frequency}\nTime: ${time}\nYears Old: ${yearsOld}`)
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
    setExpandedQuarters(prev => ({ ...prev, [quarter]: !prev[quarter] }))
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
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))
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
    let filteredData = {...yearData}
    if (incidentTypeFilter) {
      filteredData.type_breakdown = Object.fromEntries(
        Object.entries(filteredData.type_breakdown).filter(([type]) => type === incidentTypeFilter)
      )
    }
    if (barangayFilter) {
      filteredData.barangay_breakdown = Object.fromEntries(
        Object.entries(filteredData.barangay_breakdown).filter(([barangay]) => barangay === barangayFilter)
      )
    }
    if (statusFilter) {
      filteredData.status_summary = Object.fromEntries(
        Object.entries(filteredData.status_summary).filter(([status]) => status === statusFilter)
      )
    }
    return filteredData
  }

  const filteredYearData = getFilteredYearData()
  const monthlyBreakdown = filteredYearData?.monthly_breakdown ?? yearData?.monthly_breakdown ?? []
  const monthlyBreakdownMap = useMemo(() => {
    const map = new Map()
    monthlyBreakdown?.forEach((entry: any) => {
      const monthIndex = entry.month_index ?? entry.month ?? 0
      map.set(monthIndex, entry)
    })
    return map
  }, [monthlyBreakdown])

  const getReportData = () => {
    if (reportType === "incidents") {
      const byStatus = incidentsByStatus.length > 0 ? incidentsByStatus.map(item => [item.status, parseInt(item.count)]) : []
      const byType = incidentsByType.length > 0 ? incidentsByType.map(item => [item.incident_type, parseInt(item.count)]) : []
      const byBarangay = incidentsByBarangay.length > 0 ? incidentsByBarangay.map(item => [item.barangay, parseInt(item.count)]) : []
      const total = byStatus.reduce((sum, [_, count]) => sum + (count as number), 0)
      return { total: total || filterDataByDateRange(incidents).length, byType, byStatus, byBarangay }
    } else if (reportType === "volunteers") {
      const filteredVolunteers = filterDataByDateRange(volunteers)
      const volunteersByStatus = filteredVolunteers.reduce((acc: Record<string, number>, volunteer) => {
        const status = volunteer.volunteer_profiles?.status || "UNKNOWN"
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})
      return { total: filteredVolunteers.length, byStatus: Object.entries(volunteersByStatus) }
    } else {
      const filteredSchedules = filterDataByDateRange(schedules)
      return { total: filteredSchedules.length }
    }
  }

  const reportData = !loading ? getReportData() : null
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]

  const getMonthsForQuarter = (quarter: string, year: number) => {
    const quarterMap: Record<string, number[]> = {
      'Q1': [0, 1, 2],
      'Q2': [3, 4, 5],
      'Q3': [6, 7, 8],
      'Q4': [9, 10, 11]
    }
    const months = quarterMap[quarter] || []
    return months.map(month => {
      const stats = monthlyBreakdownMap.get(month)
      const startDate = new Date(year, month, 1)
      return {
        month,
        monthLabel: format(startDate, 'MMM yyyy'),
        incident_count: stats?.incident_count ?? 0,
        week_counts: stats?.week_counts ?? [0, 0, 0, 0, 0],
        startDate,
        endDate: new Date(year, month + 1, 0),
      }
    })
  }

  const formatDateRange = () => {
    if (dateFrom && dateTo) {
      return `${format(dateFrom, "MMM d, yyyy")} - ${format(dateTo, "MMM d, yyyy")}`
    }
    return "Select date range"
  }

  const setDateRangePreset = (type: "daily" | "weekly" | "monthly" | "custom") => {
    setDateRangeType(type)
    const today = new Date()
    switch (type) {
      case "daily":
        setDateFrom(today)
        setDateTo(today)
        break
      case "weekly":
        const weekStart = startOfWeek(today)
        const weekEnd = endOfWeek(today)
        setDateFrom(weekStart)
        setDateTo(weekEnd)
        break
      case "monthly":
        const monthStart = startOfMonth(today)
        const monthEnd = endOfMonth(today)
        setDateFrom(monthStart)
        setDateTo(monthEnd)
        break
      case "custom":
        break
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-2">Generate and view comprehensive system reports</p>
          </div>
        </div>

        <Tabs defaultValue="yearly" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="yearly">Yearly Reports</TabsTrigger>
            <TabsTrigger value="analytics">Analytics Dashboard</TabsTrigger>
            <TabsTrigger value="pdf">PDF Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="yearly" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Year-Based Reports</CardTitle>
                <CardDescription>View comprehensive reports organized by year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex-1">
                    <Select value={selectedYear?.toString() || ""} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                      <SelectTrigger disabled={loading}>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.length === 0 ? (
                          <div className="p-2 text-gray-500">No years available</div>
                        ) : (
                          years.map((yearData) => (
                            <SelectItem key={yearData.year} value={yearData.year.toString()}>
                              {yearData.year} ({yearData.incident_count || 0} incidents)
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => setShowArchived(!showArchived)}
                    variant="outline"
                    className="text-gray-700"
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
                </div>

                {selectedYear && !showArchived && (
                  <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="mt-4">
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Reports
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Archive Reports</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to archive all reports for {selectedYear}?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                          Archiving will mark all reports from {selectedYear} as read-only for compliance and performance.
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={archiveYearReports}
                            disabled={archiveLoading}
                            variant="destructive"
                          >
                            {archiveLoading ? <LoadingSpinner size="sm" /> : "Archive Reports"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {archivedYears.length > 0 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-2">Archived Reports</h3>
                    <p className="text-sm text-gray-600 mb-3">Previously archived years with read-only reports</p>
                    <div className="flex flex-wrap gap-2">
                      {archivedYears.map(year => (
                        <Button
                          key={year}
                          variant="outline"
                          onClick={() => {
                            setSelectedYear(year)
                            setShowArchived(true)
                          }}
                        >
                          {year}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading report data..." />
              </div>
            ) : error ? (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-red-700">{error}</p>
                </CardContent>
              </Card>
            ) : selectedYear && yearData ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedYear} Report Summary</CardTitle>
                    {yearData?.archived && <Badge variant="secondary">Archived</Badge>}
                    <CardDescription>Comprehensive overview of incidents and reports for {selectedYear}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Total Incidents</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{filteredYearData?.total_incidents || yearData?.total_incidents || 0}</p>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Reports Generated</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{filteredYearData?.reports?.length || yearData?.reports?.length || 0}</p>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Busiest Quarter</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {filteredYearData?.quarters?.reduce((max: any, quarter: any) => quarter.incident_count > max.incident_count ? quarter : max, filteredYearData?.quarters?.[0])?.quarter || yearData?.quarters?.reduce((max: any, quarter: any) => quarter.incident_count > max.incident_count ? quarter : max, yearData?.quarters?.[0])?.quarter || "N/A"}
                        </p>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Most Common Type</p>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {Object.entries(filteredYearData?.type_breakdown || yearData?.type_breakdown || {}).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quarterly Breakdown</CardTitle>
                    <CardDescription>Incident distribution across quarters for {selectedYear}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(yearData?.quarters || []).map((quarter: any) => (
                      <div key={quarter.quarter} className="border rounded-lg">
                        <button
                          onClick={() => toggleQuarter(quarter.quarter)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-3">
                            {expandedQuarters[quarter.quarter] ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <div className="text-left">
                              <p className="font-semibold text-gray-900">{quarter.quarter}</p>
                              <p className="text-sm text-gray-500">
                                {quarter.start && quarter.end ? (
                                  <>
                                    {new Date(quarter.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(quarter.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </>
                                ) : (
                                  'Date range not available'
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">{quarter.incident_count || 0} incidents</Badge>
                        </button>

                        {expandedQuarters[quarter.quarter] && (
                          <div className="border-t p-4 bg-gray-50">
                            <h4 className="font-semibold text-gray-900 mb-3">Monthly Breakdown</h4>
                            <div className="space-y-2">
                              {getMonthsForQuarter(quarter.quarter, selectedYear).map((monthData) => {
                                const monthKey = `${quarter.quarter}-${monthData.month}`
                                const weeklySeries = (monthData.week_counts || []).map((count: number, index: number) => ({ name: `Week ${index + 1}`, incidents: count }))
                                return (
                                  <div key={monthKey} className="bg-white p-3 rounded border border-gray-200">
                                    <button
                                      onClick={() => toggleMonth(monthKey)}
                                      className="w-full flex items-center justify-between hover:bg-gray-50 p-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        {expandedMonths[monthKey] ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                        <span className="text-sm font-medium text-gray-900">{monthData.monthLabel}</span>
                                      </div>
                                      <span className="text-sm text-gray-600">{monthData.incident_count || 0} incidents</span>
                                    </button>
                                    {expandedMonths[monthKey] && (
                                      <div className="mt-3 pt-3 border-t">
                                        {weeklySeries.some(point => point.incidents > 0) ? (
                                          <ResponsiveContainer width="100%" height={200}>
                                            <LineChart data={weeklySeries}>
                                              <CartesianGrid strokeDasharray="3 3" />
                                              <XAxis dataKey="name" />
                                              <YAxis allowDecimals={false} />
                                              <Tooltip />
                                              <Line type="monotone" dataKey="incidents" stroke="#2563eb" />
                                            </LineChart>
                                          </ResponsiveContainer>
                                        ) : (
                                          <p className="text-sm text-gray-500 text-center py-4">No weekly data for this month</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Incident Types</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {Object.keys(filteredYearData?.type_breakdown || {}).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(filteredYearData?.type_breakdown || {}).map(([type, count]) => ({ name: type, value: count as number }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {Object.entries(filteredYearData?.type_breakdown || {}).map((entry, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Legend />
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-500">No type data available</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {Object.keys(filteredYearData?.status_summary || {}).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(filteredYearData?.status_summary || {}).map(([status, count]) => ({ name: status, value: count as number }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#10b981" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-500">No status data available</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>PDF Report Template</CardTitle>
                    <CardDescription>Customize the executive summary for your PDF report</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Executive Summary Notes</label>
                      <textarea
                        value={templateNotes}
                        onChange={(e) => setTemplateNotes(e.target.value)}
                        className="w-full h-24 p-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add any additional notes or summary information for the PDF report..."
                      />
                    </div>
                    <div className="flex justify-end">
                      <YearlyPDFReportGenerator yearData={filteredYearData || yearData} selectedYear={selectedYear} templateNotes={templateNotes} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap justify-end gap-2">
                      {!showArchived && (
                        <>
                          <Button onClick={scheduleAutoArchive} variant="default" className="bg-purple-600 hover:bg-purple-700">
                            <Clock className="mr-2 h-4 w-4" />
                            Schedule Auto Archive
                          </Button>
                          <Button onClick={autoArchiveReports} disabled={archiveLoading} variant="default" className="bg-yellow-600 hover:bg-yellow-700">
                            {archiveLoading ? <LoadingSpinner size="sm" /> : <>
                              <Archive className="mr-2 h-4 w-4" />
                              Auto Archive Old Years
                            </>}
                          </Button>
                          <Button onClick={() => setArchiveDialogOpen(true)} disabled={archiveLoading || !selectedYear} variant="outline">
                            {archiveLoading ? <LoadingSpinner size="sm" /> : <>
                              <FileText className="mr-2 h-4 w-4" />
                              Archive Year
                            </>}
                          </Button>
                        </>
                      )}
                      <Button onClick={exportYearCSV} disabled={exportLoading || showArchived} variant="outline">
                        {exportLoading ? <LoadingSpinner size="sm" /> : <>
                          <Download className="mr-2 h-4 w-4" />
                          Export CSV
                        </>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Year Selected</h3>
                    <p className="text-gray-600 mb-6">Select a year from the dropdown above to view reports.</p>
                    {years.length === 0 && (
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">No report data available. Reports will appear here once incidents are recorded.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>Real-time analytics and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                    <SelectTrigger disabled={loading} className="md:w-48">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incidents">Incidents Report</SelectItem>
                      <SelectItem value="volunteers">Volunteers Report</SelectItem>
                      <SelectItem value="schedules">Schedules Report</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={generateReport} disabled={loading || generatingReport} className="bg-blue-600 hover:bg-blue-700">
                    {generatingReport ? <LoadingSpinner size="sm" /> : <>
                      <Download className="mr-2 h-4 w-4" />
                      Export Report
                    </>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading report data..." />
              </div>
            ) : error ? (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <p className="text-sm text-red-700">{error}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total {reportType}</CardDescription>
                      <CardTitle className="text-3xl font-bold text-blue-600">{reportData?.total || 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  {reportType === "incidents" && reportData?.byStatus && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>By Status</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {reportData.byStatus.slice(0, 3).map(([status, count]: any) => (
                            <div key={status} className="flex justify-between">
                              <span className="text-sm text-gray-600">{status}</span>
                              <span className="text-sm font-bold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {reportType === "incidents" && incidentsByStatus.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Status Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={incidentsByStatus.map((item) => ({ name: item.status, value: Number(item.count) }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#2563eb" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pdf">
            <Card>
              <CardHeader>
                <CardTitle>PDF Reports</CardTitle>
                <CardDescription>Generate PDF reports from your data</CardDescription>
              </CardHeader>
              <CardContent>
                <PDFReportGenerator />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}