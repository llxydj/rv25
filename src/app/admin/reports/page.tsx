"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import {
  FileText,
  Download,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Clock,
  Archive,
  Activity
} from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { getAllIncidents } from "@/lib/incidents"
import { getAllVolunteers } from "@/lib/volunteers"
import { getAllSchedules } from "@/lib/schedules"
import {
  getIncidentsByBarangay,
  getIncidentsByStatus,
  getIncidentsByType,
  exportIncidentsToCSV
} from "@/lib/reports"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { PDFReportGenerator } from "@/components/admin/pdf-report-generator"
import { YearlyPDFReportGenerator } from "@/components/admin/yearly-pdf-report-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts"
import { format } from "date-fns"

// ✅ PRODUCTION-READY CHART THEME
const CHART_THEME = {
  light: {
    colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"],
    grid: "#e5e7eb",
    axis: "#6b7280",
    text: "#111827",
    tooltip: {
      bg: "#ffffff",
      border: "#e5e7eb",
      text: "#111827"
    }
  },
  dark: {
    colors: ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#22d3ee"],
    grid: "#374151",
    axis: "#9ca3af",
    text: "#f3f4f6",
    tooltip: {
      bg: "#1f2937",
      border: "#374151",
      text: "#f3f4f6"
    }
  }
}

// ✅ CUSTOM TOOLTIP FOR DARK MODE
const CustomTooltip = ({ active, payload, label, darkMode }: any) => {
  if (!active || !payload?.length) return null
  const theme = darkMode ? CHART_THEME.dark : CHART_THEME.light

  return (
    <div
      style={{
        backgroundColor: theme.tooltip.bg,
        border: `1px solid ${theme.tooltip.border}`,
        borderRadius: '6px',
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <p style={{ color: theme.tooltip.text, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </p>
      {payload.map((entry: any, index: number) => (
        <p key={index} style={{ color: entry.color, fontSize: '14px' }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

export default function AdminReports() {
  const { user } = useAuth()

  // ✅ STATE MANAGEMENT - GROUPED BY CONCERN
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Report type & date range
  const [reportType, setReportType] = useState<"incidents" | "volunteers" | "schedules">("incidents")
  const [dateRange, setDateRange] = useState<"week" | "month" | "year" | "custom">("week")
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  // Dialog & loading states
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)

  // Template & config
  const [templateNotes, setTemplateNotes] = useState("")
  const [scheduleConfig, setScheduleConfig] = useState<any>(null)

  // Data states
  const [incidents, setIncidents] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [incidentsByBarangay, setIncidentsByBarangay] = useState<any[]>([])
  const [incidentsByType, setIncidentsByType] = useState<any[]>([])
  const [incidentsByStatus, setIncidentsByStatus] = useState<any[]>([])
  
  // Resident analytics state
  const [residentAnalytics, setResidentAnalytics] = useState<any>(null)

  // Year-based reports
  const [years, setYears] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [yearData, setYearData] = useState<any>(null)
  const [expandedQuarters, setExpandedQuarters] = useState<Record<string, boolean>>({})
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})

  // Archive states
  const [showArchived, setShowArchived] = useState(false)
  const [archivedYears, setArchivedYears] = useState<number[]>([])

  // ✅ DARK MODE DETECTION (PROPER)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setDarkMode(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => setDarkMode(e.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // ✅ MEMOIZED CHART THEME
  const chartTheme = useMemo(() =>
    darkMode ? CHART_THEME.dark : CHART_THEME.light,
    [darkMode]
  )

  // ✅ FETCH SCHEDULE CONFIG (CLEANUP)
  useEffect(() => {
    let isMounted = true

    const fetchScheduleConfig = async () => {
      try {
        const response = await fetch("/api/admin/reports/auto-archive")
        if (!response.ok) throw new Error('Failed to fetch')
        const result = await response.json()
        if (isMounted && result.success) {
          setScheduleConfig(result.data)
        }
      } catch (err) {
        console.error("Error fetching schedule config:", err)
      }
    }

    fetchScheduleConfig()
    return () => { isMounted = false }
  }, [])

  // ✅ DATE RANGE PARAMS (MEMOIZED)
  const getDateRangeParams = useCallback(() => {
    if (dateRange === "custom" && dateFrom && dateTo) {
      const fromDate = new Date(dateFrom)
      const toDate = new Date(dateTo)
      const [start, end] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    }

    const endDate = new Date()
    const startDate = new Date(endDate)

    switch (dateRange) {
      case "week":
        startDate.setDate(startDate.getDate() - 7)
        break
      case "month":
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  }, [dateRange, dateFrom, dateTo])

  // ✅ FETCH YEARS (CLEANUP)
  useEffect(() => {
    let isMounted = true

    const fetchYears = async () => {
      try {
        const response = await fetch("/api/admin/reports")
        if (!response.ok) {
          const errorText = await response.text()
          console.error("Failed to fetch years - response:", errorText)
          throw new Error(`Failed to fetch years: ${response.status} ${response.statusText}`)
        }
        const result = await response.json()
        console.log("Years fetch result:", result) // Debug log

        if (isMounted && result.success && result.data) {
          // Keep full objects with year and incident_count
          const yearList = result.data.map((item: any) => ({
            year: item.year,
            incident_count: item.incident_count || 0
          }))
          setYears(yearList)
          if (yearList.length > 0 && !selectedYear) {
            setSelectedYear(yearList[0].year)
          }
        }
      } catch (err) {
        console.error("Error fetching years:", err)
        // Set some default years if fetch fails (as objects)
        if (isMounted) {
          const currentYear = new Date().getFullYear()
          setYears([
            { year: currentYear, incident_count: 0 },
            { year: currentYear - 1, incident_count: 0 },
            { year: currentYear - 2, incident_count: 0 }
          ])
        }
      }
    }

    fetchYears()
    return () => { isMounted = false }
  }, [])

  // ✅ FETCH ARCHIVED YEARS (CLEANUP)
  useEffect(() => {
    let isMounted = true

    const fetchArchivedYears = async () => {
      try {
        const response = await fetch("/api/admin/reports", { method: "PUT" })
        if (!response.ok) {
          const errorText = await response.text()
          console.error("Failed to fetch archived years - response:", errorText)
          throw new Error(`Failed to fetch archived years: ${response.status} ${response.statusText}`)
        }
        const result = await response.json()
        console.log("Archived years fetch result:", result) // Debug log

        if (isMounted && result.success && result.data) {
          setArchivedYears(result.data)
        }
      } catch (err) {
        console.error("Error fetching archived years:", err)
      }
    }

    fetchArchivedYears()
    return () => { isMounted = false }
  }, [])

  // ✅ FETCH YEAR DATA (CLEANUP)
  useEffect(() => {
    if (!selectedYear) return

    let isMounted = true

    const fetchYearData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/reports?year=${selectedYear}&archived=${showArchived}`)
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to fetch year data for ${selectedYear} - response:`, errorText)
          throw new Error(`Failed to fetch year data: ${response.status} ${response.statusText}`)
        }
        const result = await response.json()
        console.log(`Year data fetch result for ${selectedYear}:`, result) // Debug log

        if (isMounted && result.success) {
          setYearData(result.data)
        }
      } catch (err) {
        console.error("Error fetching year data:", err)
        if (isMounted) setError("Failed to load year data")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchYearData()
    return () => { isMounted = false }
  }, [selectedYear, showArchived])

  // ✅ FETCH REPORT DATA (CLEANUP + DEBOUNCE)
  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const { startDate, endDate } = getDateRangeParams()

        if (reportType === "incidents") {
          const [incidentsRes, barangayRes, typeRes, statusRes, residentRes] = await Promise.all([
            getAllIncidents(),
            getIncidentsByBarangay(startDate, endDate),
            getIncidentsByType(startDate, endDate),
            getIncidentsByStatus(startDate, endDate),
            fetch(`/api/analytics/resident-incidents?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`, {
              signal: controller.signal
            }).then(res => res.json()).catch(() => ({ success: false }))
          ])

          if (!isMounted) return

          if (incidentsRes.success) setIncidents(incidentsRes.data || [])
          else setError(incidentsRes.message || "Failed to fetch incidents")

          if (barangayRes.success) setIncidentsByBarangay(barangayRes.data || [])
          if (typeRes.success) setIncidentsByType(typeRes.data || [])
          if (statusRes.success) setIncidentsByStatus(statusRes.data || [])
          
          // Set resident analytics
          if (residentRes.success && residentRes.data) {
            setResidentAnalytics(residentRes.data)
          } else {
            setResidentAnalytics(null)
          }

        } else if (reportType === "volunteers") {
          const result = await getAllVolunteers()
          if (!isMounted) return

          if (result.success) setVolunteers(result.data || [])
          else setError(result.message || "Failed to fetch volunteers")

        } else if (reportType === "schedules") {
          const result = await getAllSchedules()
          if (!isMounted) return

          if (result.success) setSchedules(result.data || [])
          else setError(result.message || "Failed to fetch schedules")
        }
      } catch (err: any) {
        if (!isMounted) return
        setError(err.message || "An unexpected error occurred")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchData, 300) // Debounce 300ms

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [reportType, getDateRangeParams])

  // ✅ FILTER DATA BY DATE RANGE (MEMOIZED)
  const filterDataByDateRange = useCallback((data: any[]) => {
    const { startDate, endDate } = getDateRangeParams()
    const rangeStart = new Date(startDate)
    const rangeEnd = new Date(endDate)

    return data.filter(item => {
      if (!item?.created_at) return false
      const createdAt = new Date(item.created_at)
      return createdAt >= rangeStart && createdAt <= rangeEnd
    })
  }, [getDateRangeParams])

  // ✅ GENERATE REPORT (WITH ERROR HANDLING)
  const generateReport = useCallback(async () => {
    if (!user?.id) return

    setGeneratingReport(true)
    try {
      // Log action
      await fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_csv_generated",
          details: `CSV report generated by admin ${user.id}`,
          user_id: user.id
        })
      })

      if (reportType === "incidents") {
        const { startDate, endDate } = getDateRangeParams()

        const result = await exportIncidentsToCSV(startDate, endDate)

        if (result.success && result.data && result.data.length > 0) {
          const headers = Object.keys(result.data[0]).join(',')
          const rows = result.data.map((item: any) =>
            Object.values(item).map(v =>
              typeof v === 'string' && v.includes(',') ? `"${v}"` : v
            ).join(',')
          )
          const csvContent = [headers, ...rows].join('\n')

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `incidents-report-${new Date().toISOString().split('T')[0]}.csv`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } else {
          throw new Error('No data to export')
        }
      }
    } catch (err) {
      console.error("Error generating report:", err)
      alert("Failed to generate report. Please try again.")
    } finally {
      setGeneratingReport(false)
    }
  }, [user, reportType, getDateRangeParams])

  // ✅ ARCHIVE YEAR REPORTS
  const archiveYearReports = useCallback(async () => {
    if (!selectedYear || !user?.id) return

    if (!confirm(`Archive all reports for ${selectedYear}? This cannot be undone.`)) {
      return
    }

    setArchiveLoading(true)
    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear })
      })

      if (!response.ok) throw new Error('Archive failed')
      const result = await response.json()

      if (result.success) {
        // Refresh year data
        const refreshResponse = await fetch(`/api/admin/reports?year=${selectedYear}`)
        const refreshResult = await refreshResponse.json()
        if (refreshResult.success) {
          setYearData(refreshResult.data)
        }

        setArchivedYears(prev => Array.from(new Set([...prev, selectedYear])))

        // Log action
        await fetch("/api/admin/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "archive_year_action",
            details: `Reports for ${selectedYear} archived by admin ${user.id}`,
            user_id: user.id
          })
        })

        setArchiveDialogOpen(false)
        alert(`Reports for ${selectedYear} archived successfully`)
      } else if (result.code === 'ALREADY_ARCHIVED') {
        alert(`Reports for ${selectedYear} are already archived`)
      } else {
        throw new Error(result.message || 'Archive failed')
      }
    } catch (err: any) {
      console.error("Error archiving reports:", err)
      alert(`Failed to archive reports: ${err.message}`)
    } finally {
      setArchiveLoading(false)
    }
  }, [selectedYear, user])

  // ✅ EXPORT YEAR CSV
  const exportYearCSV = useCallback(async () => {
    if (!selectedYear || !user?.id) return

    setExportLoading(true)
    try {
      await fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report_csv_generated",
          details: `CSV for year ${selectedYear} by admin ${user.id}`,
          user_id: user.id
        })
      })

      const response = await fetch(`/api/admin/reports?year=${selectedYear}&export=csv`)
      if (!response.ok) throw new Error('Export failed')
      const result = await response.json()

      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename || `incidents-${selectedYear}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        throw new Error('No data to export')
      }
    } catch (err: any) {
      console.error("Error exporting CSV:", err)
      alert(`Failed to export CSV: ${err.message}`)
    } finally {
      setExportLoading(false)
    }
  }, [selectedYear, user])

  // ✅ TOGGLE QUARTER
  const toggleQuarter = useCallback((quarter: string) => {
    setExpandedQuarters(prev => {
      const isExpanding = !prev[quarter]

      if (!isExpanding) {
        // Collapse all months in this quarter
        setExpandedMonths(prevMonths => {
          const newMonths = { ...prevMonths }
          Object.keys(newMonths).forEach(key => {
            if (key.startsWith(quarter)) {
              delete newMonths[key]
            }
          })
          return newMonths
        })
      }

      return { ...prev, [quarter]: isExpanding }
    })
  }, [])

  // ✅ TOGGLE MONTH
  const toggleMonth = useCallback((monthKey: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))
  }, [])

  // ✅ FILTERED YEAR DATA (MEMOIZED)
  const getFilteredYearData = useMemo(() => {
    if (!yearData) return null
    return yearData // Filters removed for simplicity, add back if needed
  }, [yearData])

  // ✅ MONTHLY BREAKDOWN MAP (MEMOIZED)
  const monthlyBreakdownMap = useMemo(() => {
    const breakdown = getFilteredYearData?.monthly_breakdown || yearData?.monthly_breakdown || []
    const map = new Map()

    breakdown.forEach((entry: any) => {
      const monthIndex = entry.month_index ?? entry.month ?? 0
      map.set(monthIndex, entry)
    })

    return map
  }, [getFilteredYearData, yearData])

  // ✅ REPORT DATA (MEMOIZED)
  const reportData = useMemo(() => {
    if (loading) return null

    if (reportType === "incidents") {
      const byStatus = incidentsByStatus.map((item) => [item.status, parseInt(item.count || "0", 10)])
      const byType = incidentsByType.map((item) => [item.incident_type, parseInt(item.count || "0", 10)])
      const byBarangay = incidentsByBarangay.map((item) => [item.barangay, parseInt(item.count || "0", 10)])
      const total = byStatus.reduce((sum, [_, count]) => sum + (count as number), 0) || filterDataByDateRange(incidents).length

      return { total, byType, byStatus, byBarangay }
    }

    if (reportType === "volunteers") {
      const filteredVolunteers = filterDataByDateRange(volunteers)
      const volunteersByStatus = filteredVolunteers.reduce((acc: Record<string, number>, volunteer) => {
        const status = volunteer.volunteer_profiles?.status || "UNKNOWN"
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      // Additional volunteer analytics
      const volunteersBySkills = filteredVolunteers.reduce((acc: Record<string, number>, volunteer) => {
        const skills = volunteer.volunteer_profiles?.skills || []
        skills.forEach((skill: string) => {
          acc[skill] = (acc[skill] || 0) + 1
        })
        return acc
      }, {})

      const volunteersByAvailability = filteredVolunteers.reduce((acc: Record<string, number>, volunteer) => {
        const availability = volunteer.volunteer_profiles?.availability
        let availabilityStr = "Not Set"
        
        if (Array.isArray(availability)) {
          // If availability is an array
          if (availability.length > 0) {
            availabilityStr = availability.join(', ')
          }
        } else if (typeof availability === 'string' && availability.trim()) {
          // If availability is a string
          availabilityStr = availability
        }
        
        acc[availabilityStr] = (acc[availabilityStr] || 0) + 1
        return acc
      }, {})

      return { 
        total: filteredVolunteers.length, 
        byStatus: Object.entries(volunteersByStatus),
        bySkills: Object.entries(volunteersBySkills),
        byAvailability: Object.entries(volunteersByAvailability),
        details: filteredVolunteers
      }
    }

    if (reportType === "schedules") {
      const filteredSchedules = filterDataByDateRange(schedules)
      
      // Schedule analytics
      const schedulesByStatus = filteredSchedules.reduce((acc: Record<string, number>, schedule) => {
        const status = schedule.status || "UNKNOWN"
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      const schedulesByBarangay = filteredSchedules.reduce((acc: Record<string, number>, schedule) => {
        const barangay = schedule.barangay || "UNKNOWN"
        acc[barangay] = (acc[barangay] || 0) + 1
        return acc
      }, {})

      const schedulesByType = filteredSchedules.reduce((acc: Record<string, number>, schedule) => {
        const type = schedule.title || schedule.activity_type || "Not Set"
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})

      return { 
        total: filteredSchedules.length,
        byStatus: Object.entries(schedulesByStatus),
        byBarangay: Object.entries(schedulesByBarangay),
        byType: Object.entries(schedulesByType),
        details: filteredSchedules
      }
    }

    return { total: 0 }
  }, [loading, reportType, incidentsByStatus, incidentsByType, incidentsByBarangay, filterDataByDateRange, incidents, volunteers, schedules])

  // ✅ BARANGAY ANALYTICS (INCIDENTS)
  const barangayAnalytics = useMemo(() => {
    if (!incidentsByBarangay || incidentsByBarangay.length === 0) {
      return { total: 0, items: [] as Array<{ barangay: string; count: number; percentage: number }> }
    }

    const total = incidentsByBarangay.reduce((sum, item) => {
      const raw = typeof item.count === "number" ? item.count : parseInt(item.count || "0", 10)
      const count = Number.isNaN(raw) ? 0 : raw
      return sum + count
    }, 0)

    const items = incidentsByBarangay
      .map((item) => {
        const raw = typeof item.count === "number" ? item.count : parseInt(item.count || "0", 10)
        const count = Number.isNaN(raw) ? 0 : raw
        const percentage = total > 0 ? (count / total) * 100 : 0
        return {
          barangay: item.barangay || "UNKNOWN",
          count,
          percentage,
        }
      })
      .sort((a, b) => b.count - a.count)

    return { total, items }
  }, [incidentsByBarangay])

  const busiestQuarter = useMemo(() => {
    if (!yearData?.quarters?.length) return null
    return yearData.quarters.reduce((max: any, quarter: any) =>
      quarter.incident_count > max.incident_count ? quarter : max,
      yearData.quarters[0]
    )
  }, [yearData])

  // ✅ GET MONTHS FOR QUARTER (MEMOIZED)
  const getMonthsForQuarter = useCallback((quarter: string, year: number) => {
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
  }, [monthlyBreakdownMap])

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        {/* HEADER */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Reports
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            Generate and view comprehensive system reports
          </p>
        </div>

        <Tabs defaultValue="yearly" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="yearly">Yearly Reports</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="pdf">PDF Reports</TabsTrigger>
          </TabsList>

          {/* YEARLY REPORTS TAB */}
          <TabsContent value="yearly" className="space-y-4 md:space-y-6">
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg md:text-xl text-gray-900 dark:text-gray-100">
                  Year-Based Reports
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  View comprehensive reports organized by year
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select
                    value={selectedYear?.toString() || ""}
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger
                      disabled={loading}
                      className="w-full sm:w-48 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      {years.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                          No years available
                        </div>
                      ) : (
                        years.map((yearItem: any) => {
                          // Handle both object and number formats for safety
                          const year = typeof yearItem === 'object' ? yearItem.year : yearItem
                          const count = typeof yearItem === 'object' ? (yearItem.incident_count || 0) : 0
                          return (
                            <SelectItem
                              key={year}
                              value={year.toString()}
                              className="text-gray-900 dark:text-gray-100"
                            >
                              {year} ({count} incidents)
                            </SelectItem>
                          )
                        })
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={() => setShowArchived(!showArchived)}
                    variant="outline"
                    className="w-full sm:w-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
                      <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Reports
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-gray-100">
                          Archive Reports
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                          Archive all reports for {selectedYear}?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Archiving will mark all reports from {selectedYear} as read-only.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setArchiveDialogOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={archiveYearReports}
                            disabled={archiveLoading}
                            variant="destructive"
                            className="w-full sm:w-auto"
                          >
                            {archiveLoading ? <LoadingSpinner size="sm" /> : "Archive"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {archivedYears.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Archived Reports
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      Previously archived years
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {archivedYears.map(year => (
                        <Button
                          key={year}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedYear(year)
                            setShowArchived(true)
                          }}
                          className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
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
              <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                <CardContent className="py-6">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </CardContent>
              </Card>
            ) : selectedYear && yearData ? (
              <div className="space-y-4 md:space-y-6">
                {/* SUMMARY CARDS */}
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardHeader className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="text-lg md:text-xl text-gray-900 dark:text-gray-100">
                        {selectedYear} Report Summary
                      </CardTitle>
                      {yearData?.archived && (
                        <Badge variant="secondary" className="w-fit">
                          Archived
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                      Comprehensive overview for {selectedYear}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800/50">
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Total Incidents
                        </p>
                        <p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {yearData?.total_incidents || 0}
                        </p>
                      </div>

                      <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800/50">
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Reports Generated
                        </p>
                        <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                          {yearData?.reports?.length || 0}
                        </p>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800/50">
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Busiest Quarter
                        </p>
                        <p className="text-xl md:text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {busiestQuarter?.quarter || "N/A"}
                        </p>
                      </div>

                      <div className="p-4 bg-orange-50 dark:bg-orange-950/50 rounded-lg border border-orange-200 dark:border-orange-800/50">
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-1">
                          Most Common Type
                        </p>
                        <p className="text-xl md:text-2xl font-bold text-orange-600 dark:text-orange-400 truncate">
                          {Object.entries(yearData?.type_breakdown || {})
                            .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* QUARTERLY BREAKDOWN */}
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                      Quarterly Breakdown
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                      Incident distribution for {selectedYear}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(yearData?.quarters || []).map((quarter: any) => (
                      <div
                        key={quarter.quarter}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => toggleQuarter(quarter.quarter)}
                          className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-2 md:gap-3 min-w-0">
                            {expandedQuarters[quarter.quarter] ? (
                              <ChevronDown className="h-4 w-4 md:h-5 md:w-5 text-gray-900 dark:text-gray-100 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-900 dark:text-gray-100 flex-shrink-0" />
                            )}
                            <div className="text-left min-w-0">
                              <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100">
                                {quarter.quarter}
                              </p>
                              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                                {quarter.start && quarter.end ? (
                                  <>
                                    {new Date(quarter.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    {' - '}
                                    {new Date(quarter.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </>
                                ) : (
                                  'Date range not available'
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="flex-shrink-0 text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                          >
                            {quarter.incident_count || 0}
                          </Badge>
                        </button>

                        {expandedQuarters[quarter.quarter] && (
                          <div className="border-t border-gray-200 dark:border-gray-700 p-3 md:p-4 bg-gray-50 dark:bg-gray-800">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                              Monthly Breakdown
                            </h4>
                            <div className="space-y-2">
                              {getMonthsForQuarter(quarter.quarter, selectedYear).map((monthData) => {
                                const monthKey = `${quarter.quarter}-${monthData.month}`
                                const weeklySeries = (monthData.week_counts || []).map((count: number, index: number) => ({
                                  name: `W${index + 1}`,
                                  incidents: count
                                }))

                                return (
                                  <div
                                    key={monthKey}
                                    className="bg-white dark:bg-gray-900 p-2 md:p-3 rounded border border-gray-200 dark:border-gray-700"
                                  >
                                    <button
                                      onClick={() => toggleMonth(monthKey)}
                                      className="w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        {expandedMonths[monthKey] ? (
                                          <ChevronDown className="h-3 w-3 md:h-4 md:w-4 text-gray-900 dark:text-gray-100 flex-shrink-0" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-gray-900 dark:text-gray-100 flex-shrink-0" />
                                        )}
                                        <span className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">
                                          {monthData.monthLabel}
                                        </span>
                                      </div>
                                      <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                                        {monthData.incident_count || 0} incidents
                                      </span>
                                    </button>

                                    {expandedMonths[monthKey] && (
                                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        {weeklySeries.some((p: any) => p.incidents > 0) ? (
                                          <div className="w-full overflow-x-auto">
                                            <div style={{ minWidth: '280px', height: '180px' }}>
                                              <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={weeklySeries} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                                  <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    stroke={chartTheme.grid}
                                                  />
                                                  <XAxis
                                                    dataKey="name"
                                                    stroke={chartTheme.axis}
                                                    tick={{ fontSize: 11 }}
                                                  />
                                                  <YAxis
                                                    allowDecimals={false}
                                                    stroke={chartTheme.axis}
                                                    tick={{ fontSize: 11 }}
                                                  />
                                                  <Tooltip
                                                    content={<CustomTooltip darkMode={darkMode} />}
                                                  />
                                                  <Line
                                                    type="monotone"
                                                    dataKey="incidents"
                                                    stroke={chartTheme.colors[0]}
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                  />
                                                </LineChart>
                                              </ResponsiveContainer>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                            No weekly data for this month
                                          </p>
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

                {/* CHARTS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* INCIDENT TYPES PIE CHART */}
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm md:text-base text-gray-900 dark:text-gray-100">
                        Incident Types
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-64 md:h-80">
                      {Object.keys(yearData?.type_breakdown || {}).length > 0 ? (
                        <div className="w-full h-full overflow-hidden">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(yearData.type_breakdown).map(([type, count]) => ({
                                  name: type,
                                  value: count as number
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius="70%"
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => {
                                  const pct = (percent * 100).toFixed(0)
                                  return `${name}: ${pct}%`
                                }}
                              >
                                {Object.entries(yearData.type_breakdown).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={chartTheme.colors[index % chartTheme.colors.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                              <Legend
                                wrapperStyle={{ fontSize: '11px', color: chartTheme.text }}
                                iconSize={10}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                          No type data available
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* STATUS DISTRIBUTION BAR CHART */}
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm md:text-base text-gray-900 dark:text-gray-100">
                        Status Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-64 md:h-80">
                      {Object.keys(yearData?.status_summary || {}).length > 0 ? (
                        <div className="w-full h-full overflow-hidden">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={Object.entries(yearData.status_summary).map(([status, count]) => ({
                                name: status,
                                value: count as number
                              }))}
                              margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={chartTheme.grid}
                              />
                              <XAxis
                                dataKey="name"
                                stroke={chartTheme.axis}
                                tick={{ fontSize: 11 }}
                              />
                              <YAxis
                                allowDecimals={false}
                                stroke={chartTheme.axis}
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                              <Bar
                                dataKey="value"
                                fill={chartTheme.colors[1]}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                          No status data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* PDF TEMPLATE NOTES */}
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                      PDF Report Template
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                      Customize the executive summary for your PDF report
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Executive Summary Notes
                      </label>
                      <textarea
                        value={templateNotes}
                        onChange={(e) => setTemplateNotes(e.target.value)}
                        className="w-full h-20 md:h-24 p-3 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
                        placeholder="Add any additional notes or summary information..."
                      />
                    </div>
                    <div className="flex justify-end">
                      <YearlyPDFReportGenerator
                        yearData={getFilteredYearData || yearData}
                        selectedYear={selectedYear}
                        templateNotes={templateNotes}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ACTION BUTTONS */}
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-2">
                      <Button
                        onClick={exportYearCSV}
                        disabled={exportLoading || showArchived}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        {exportLoading ? <LoadingSpinner size="sm" /> : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <CalendarIcon className="h-12 w-12 md:h-16 md:w-16 text-gray-400 dark:text-gray-600 mx-auto" />
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        No Year Selected
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Select a year from the dropdown above to view reports.
                      </p>
                    </div>
                    {years.length === 0 && (
                      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-xs md:text-sm text-yellow-800 dark:text-yellow-200">
                          No report data available. Reports will appear once incidents are recorded.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-4 md:space-y-6">
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg md:text-xl text-gray-900 dark:text-gray-100">
                  Analytics Dashboard
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  Real-time analytics and insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row md:flex-wrap gap-3">
                  <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                    <SelectTrigger
                      disabled={loading}
                      className="w-full sm:w-48 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                    >
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      <SelectItem value="incidents">Incidents</SelectItem>
                      <SelectItem value="volunteers">Volunteers</SelectItem>
                      <SelectItem value="schedules">Schedules</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                    <SelectTrigger
                      disabled={loading}
                      className="w-full sm:w-48 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                    >
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                      <SelectItem value="year">Last 12 Months</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={generateReport}
                    disabled={loading || generatingReport}
                    className="w-full sm:w-auto"
                  >
                    {generatingReport ? <LoadingSpinner size="sm" /> : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export Report
                      </>
                    )}
                  </Button>
                </div>

                {dateRange === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="analytics-custom-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Start Date
                      </label>
                      <input
                        id="analytics-custom-start"
                        type="date"
                        value={dateFrom ? format(dateFrom, "yyyy-MM-dd") : ""}
                        max={dateTo ? format(dateTo, "yyyy-MM-dd") : new Date().toISOString().split("T")[0]}
                        onChange={(e) => {
                          const value = e.target.value
                          setDateFrom(value ? new Date(value) : null)
                        }}
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="analytics-custom-end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        End Date
                      </label>
                      <input
                        id="analytics-custom-end"
                        type="date"
                        value={dateTo ? format(dateTo, "yyyy-MM-dd") : ""}
                        min={dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => {
                          const value = e.target.value
                          setDateTo(value ? new Date(value) : null)
                        }}
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
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
              <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                <CardContent className="py-6">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        Total {reportType}
                      </CardDescription>
                      <CardTitle className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {reportData?.total || 0}
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  {(reportType === "incidents" || reportType === "volunteers" || reportType === "schedules") && reportData && (
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 sm:col-span-2 lg:col-span-2">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          {reportType === "incidents" && "By Status"}
                          {reportType === "volunteers" && "Volunteer Distribution"}
                          {reportType === "schedules" && "Schedule Distribution"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {reportType === "incidents" && reportData.byStatus && reportData.byStatus.slice(0, 6).map(([status, count]: any) => (
                            <div key={status} className="flex flex-col">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {status}
                              </span>
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {count}
                              </span>
                            </div>
                          ))}
                          {reportType === "volunteers" && reportData.byStatus && reportData.byStatus.slice(0, 6).map(([status, count]: any) => (
                            <div key={status} className="flex flex-col">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {status}
                              </span>
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {count}
                              </span>
                            </div>
                          ))}
                          {reportType === "schedules" && reportData.byStatus && reportData.byStatus.slice(0, 6).map(([status, count]: any) => (
                            <div key={status} className="flex flex-col">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {status}
                              </span>
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* VOLUNTEER SKILLS AND AVAILABILITY */}
                {reportType === "volunteers" && reportData?.bySkills && reportData.bySkills.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Skills Distribution */}
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                          Volunteer Skills Distribution
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          Distribution of volunteer skills
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64 md:h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={reportData.bySkills.map(([skill, count]: any) => ({
                                name: skill,
                                value: count
                              }))}
                              margin={{ top: 5, right: 10, left: -15, bottom: 40 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={chartTheme.grid}
                              />
                              <XAxis
                                dataKey="name"
                                stroke={chartTheme.axis}
                                tick={{ fontSize: 10 }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis
                                allowDecimals={false}
                                stroke={chartTheme.axis}
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                              <Bar
                                dataKey="value"
                                fill={chartTheme.colors[2]}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Availability Distribution */}
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                          Volunteer Availability
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          Distribution of volunteer availability
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64 md:h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={reportData.byAvailability.map(([availability, count]: any) => ({
                                  name: availability,
                                  value: count
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius="70%"
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => {
                                  const pct = (percent * 100).toFixed(0)
                                  return `${name}: ${pct}%`
                                }}
                              >
                                {reportData.byAvailability.map((_: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={chartTheme.colors[index % chartTheme.colors.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                              <Legend
                                wrapperStyle={{ fontSize: '11px', color: chartTheme.text }}
                                iconSize={10}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* SCHEDULE DETAILS */}
                {reportType === "schedules" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Schedule Types */}
                    {reportData?.byType && reportData.byType.length > 0 && (
                      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                            Schedule Types
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                            Distribution of schedule types
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-64 md:h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={reportData.byType.map(([type, count]: any) => ({
                                  name: type,
                                  value: count
                                }))}
                                margin={{ top: 5, right: 10, left: -15, bottom: 40 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke={chartTheme.grid}
                                />
                                <XAxis
                                  dataKey="name"
                                  stroke={chartTheme.axis}
                                  tick={{ fontSize: 10 }}
                                  interval={0}
                                  angle={-45}
                                  textAnchor="end"
                                  height={60}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  stroke={chartTheme.axis}
                                  tick={{ fontSize: 11 }}
                                />
                                <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                                <Bar
                                  dataKey="value"
                                  fill={chartTheme.colors[0]}
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Schedule by Barangay */}
                    {reportData?.byBarangay && reportData.byBarangay.length > 0 && (
                      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                            Schedules by Barangay
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                            Distribution of schedules across barangays
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-64 md:h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={reportData.byBarangay.map(([barangay, count]: any) => ({
                                    name: barangay,
                                    value: count
                                  }))}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius="70%"
                                  fill="#8884d8"
                                  dataKey="value"
                                  label={({ name, percent }) => {
                                    const pct = (percent * 100).toFixed(0)
                                    return `${name}: ${pct}%`
                                  }}
                                >
                                  {reportData.byBarangay.map((_: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={chartTheme.colors[index % chartTheme.colors.length]} />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                                <Legend
                                  wrapperStyle={{ fontSize: '11px', color: chartTheme.text }}
                                  iconSize={10}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* RESIDENT SUMMARY ROW */}
                {reportType === "incidents" && residentAnalytics?.overall && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          Total Resident Reports
                        </CardDescription>
                        <CardTitle className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {residentAnalytics.overall.totalIncidents || 0}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          Top Barangay (Resident Reports)
                        </CardDescription>
                        <CardTitle className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                          {residentAnalytics.summary?.topBarangay || "N/A"}
                        </CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {residentAnalytics.summary?.topBarangayCount || 0} incidents
                          {residentAnalytics.overall.totalIncidents > 0 && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400">
                              ({((residentAnalytics.summary?.topBarangayCount || 0) / residentAnalytics.overall.totalIncidents * 100).toFixed(1)}%)
                            </span>
                          )}
                        </p>
                      </CardHeader>
                    </Card>

                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          Emergency vs Non-Emergency (Resident)
                        </CardDescription>
                        <CardTitle className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                          {residentAnalytics.overall.totalEmergency || 0} emergency
                        </CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {residentAnalytics.overall.totalNonEmergency || 0} non-emergency
                        </p>
                        {residentAnalytics.overall.totalIncidents > 0 && (
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full"
                              style={{
                                width: `${(residentAnalytics.overall.totalEmergency / residentAnalytics.overall.totalIncidents) * 100}%`
                              }}
                            />
                          </div>
                        )}
                      </CardHeader>
                    </Card>

                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                          Resolution Rate (Resident)
                        </CardDescription>
                        <CardTitle className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">
                          {parseFloat(residentAnalytics.overall.resolutionRate || "0").toFixed(1)}%
                        </CardTitle>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          of resident reports resolved
                        </p>
                      </CardHeader>
                    </Card>
                  </div>
                )}

                {/* INCIDENT DETAILS TABLE */}
                {reportType === "incidents" && filterDataByDateRange(incidents).length > 0 && (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                        Incident Details
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        Detailed list of all incidents in selected date range
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Date Reported
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Type
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Barangay
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Reporter
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Contact
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Priority
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                            {filterDataByDateRange(incidents).slice(0, 50).map((incident: any) => (
                              <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {new Date(incident.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {incident.incident_type}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {incident.barangay}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {incident.reporter ? (
                                    <div>
                                      <div className="font-medium">
                                        {incident.reporter.first_name && incident.reporter.last_name
                                          ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                                          : incident.reporter.first_name || incident.reporter.last_name || incident.reporter.email || "Unknown"}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400">Anonymous</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {incident.reporter?.phone_number || incident.reporter?.email || "—"}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${incident.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200' :
                                      incident.status === 'ASSIGNED' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200' :
                                        incident.status === 'RESPONDING' ? 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200' :
                                          incident.status === 'RESOLVED' ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200' :
                                            'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                                    }`}>
                                    {incident.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${incident.priority === 1 ? 'bg-red-600 text-white' :
                                      incident.priority === 2 ? 'bg-orange-500 text-white' :
                                        incident.priority === 3 ? 'bg-yellow-500 text-black dark:text-white' :
                                          incident.priority === 4 ? 'bg-green-500 text-white' :
                                            'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                    }`}>
                                    {incident.priority === 1 ? 'Critical' :
                                      incident.priority === 2 ? 'High' :
                                        incident.priority === 3 ? 'Medium' :
                                          incident.priority === 4 ? 'Low' : 'Info'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filterDataByDateRange(incidents).length > 50 && (
                        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                          Showing first 50 of {filterDataByDateRange(incidents).length} incidents. Export CSV for full list.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* VOLUNTEER DETAILS TABLE */}
                {reportType === "volunteers" && reportData?.details && reportData.details.length > 0 && (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                        Volunteer Details
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        Detailed list of all volunteers in selected date range
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Name
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Email
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Phone
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Skills
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Availability
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                            {reportData.details.slice(0, 50).map((volunteer: any) => (
                              <tr key={volunteer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {volunteer.first_name && volunteer.last_name
                                    ? `${volunteer.first_name} ${volunteer.last_name}`
                                    : volunteer.first_name || volunteer.last_name || "Unknown"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {volunteer.email || "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {volunteer.phone_number || "—"}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${volunteer.volunteer_profiles?.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200' :
                                      volunteer.volunteer_profiles?.status === 'INACTIVE' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' :
                                        'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200'
                                    }`}>
                                    {volunteer.volunteer_profiles?.status || "UNKNOWN"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  <div className="flex flex-wrap gap-1">
                                    {volunteer.volunteer_profiles?.skills?.slice(0, 3).map((skill: string, index: number) => (
                                      <span key={index} className="inline-flex px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                        {skill}
                                      </span>
                                    ))}
                                    {volunteer.volunteer_profiles?.skills?.length > 3 && (
                                      <span className="inline-flex px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                                        +{volunteer.volunteer_profiles.skills.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {volunteer.volunteer_profiles?.availability || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {reportData.details.length > 50 && (
                        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                          Showing first 50 of {reportData.details.length} volunteers. Export CSV for full list.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* SCHEDULE DETAILS TABLE */}
                {reportType === "schedules" && reportData?.details && reportData.details.length > 0 && (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                        Schedule Details
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        Detailed list of all schedules in selected date range
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Activity
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Volunteer
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Start Time
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                End Time
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Barangay
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                            {reportData.details.slice(0, 50).map((schedule: any) => (
                              <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {schedule.activity_type || schedule.title || "Unknown Activity"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {schedule.volunteer?.first_name && schedule.volunteer?.last_name
                                    ? `${schedule.volunteer.first_name} ${schedule.volunteer.last_name}`
                                    : schedule.volunteer?.first_name || schedule.volunteer?.last_name || "Unassigned"}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {schedule.start_time ? new Date(schedule.start_time).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : "—"}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {schedule.end_time ? new Date(schedule.end_time).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {schedule.barangay || "—"}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${schedule.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200' :
                                      schedule.status === 'CONFIRMED' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200' :
                                        schedule.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200' :
                                          schedule.status === 'CANCELLED' ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200' :
                                            'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                                    }`}>
                                    {schedule.status || "UNKNOWN"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {reportData.details.length > 50 && (
                        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                          Showing first 50 of {reportData.details.length} schedules. Export CSV for full list.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* RESIDENT-REPORTED INCIDENTS BY BARANGAY */}
                {reportType === "incidents" && residentAnalytics?.byBarangay && residentAnalytics.byBarangay.length > 0 && (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                        Resident-Reported Incidents by Barangay
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        Per barangay, selected period
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bar Chart */}
                        <div className="h-64 md:h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={residentAnalytics.byBarangay
                                .slice(0, 10)
                                .map((item: any) => ({
                                  barangay: item.barangay,
                                  count: item.total,
                                  percentage: residentAnalytics.overall.totalIncidents > 0
                                    ? ((item.total / residentAnalytics.overall.totalIncidents) * 100).toFixed(1)
                                    : '0.0'
                                }))}
                              margin={{ top: 5, right: 10, left: -15, bottom: 40 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={chartTheme.grid}
                              />
                              <XAxis
                                dataKey="barangay"
                                stroke={chartTheme.axis}
                                tick={{ fontSize: 10 }}
                                interval={0}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis
                                allowDecimals={false}
                                stroke={chartTheme.axis}
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload
                                    return (
                                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{data.barangay}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                          Count: <span className="font-semibold">{data.count}</span>
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                          {data.percentage}% of resident reports
                                        </p>
                                      </div>
                                    )
                                  }
                                  return null
                                }}
                              />
                              <Bar
                                dataKey="count"
                                fill={chartTheme.colors[2]}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Top Barangays List */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            Top 5 Barangays
                          </h4>
                          {residentAnalytics.byBarangay.slice(0, 5).map((item: any, index: number) => {
                            const percentage = residentAnalytics.overall.totalIncidents > 0
                              ? ((item.total / residentAnalytics.overall.totalIncidents) * 100).toFixed(1)
                              : '0.0'
                            return (
                              <div
                                key={item.barangay}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                      {index + 1}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                      {item.barangay}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      {item.total} incident{item.total !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                <Badge className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                  {percentage}%
                                </Badge>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* RESIDENT TREND CHART */}
                {reportType === "incidents" && residentAnalytics?.trends && (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                        Resident Incident Trend
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        {(() => {
                          const daysDiff = dateRange === "custom" && dateFrom && dateTo
                            ? Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))
                            : dateRange === "week" ? 7
                            : dateRange === "month" ? 30
                            : 365
                          return daysDiff <= 30 ? "Daily trend" : daysDiff <= 90 ? "Weekly trend" : "Monthly trend"
                        })()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 md:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={(() => {
                              const daysDiff = dateRange === "custom" && dateFrom && dateTo
                                ? Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))
                                : dateRange === "week" ? 7
                                : dateRange === "month" ? 30
                                : 365
                              
                              let trendData: any[] = []
                              if (daysDiff <= 30 && residentAnalytics.trends.daily && residentAnalytics.trends.daily.length > 0) {
                                trendData = residentAnalytics.trends.daily.map((item: any) => {
                                  try {
                                    const date = new Date(item.date)
                                    return {
                                      date: format(date, 'MMM dd'),
                                      count: item.count || 0
                                    }
                                  } catch {
                                    return { date: item.date, count: item.count || 0 }
                                  }
                                })
                              } else if (daysDiff <= 90 && residentAnalytics.trends.weekly && residentAnalytics.trends.weekly.length > 0) {
                                trendData = residentAnalytics.trends.weekly.map((item: any) => {
                                  try {
                                    const date = new Date(item.week)
                                    return {
                                      date: format(date, 'MMM dd'),
                                      count: item.count || 0
                                    }
                                  } catch {
                                    return { date: item.week || 'Unknown', count: item.count || 0 }
                                  }
                                })
                              } else if (residentAnalytics.trends.monthly && residentAnalytics.trends.monthly.length > 0) {
                                trendData = residentAnalytics.trends.monthly.map((item: any) => {
                                  try {
                                    const monthStr = item.month || ''
                                    const date = new Date(monthStr + '-01')
                                    return {
                                      date: format(date, 'MMM yyyy'),
                                      count: item.count || 0
                                    }
                                  } catch {
                                    return { date: item.month || 'Unknown', count: item.count || 0 }
                                  }
                                })
                              }
                              return trendData
                            })()}
                            margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={chartTheme.grid}
                            />
                            <XAxis
                              dataKey="date"
                              stroke={chartTheme.axis}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              allowDecimals={false}
                              stroke={chartTheme.axis}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke={chartTheme.colors[0]}
                              strokeWidth={2}
                              dot={{ fill: chartTheme.colors[0], r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* INCIDENTS BY BARANGAY (ANALYTICS) */}
                {reportType === "incidents" && barangayAnalytics.items.length > 0 && (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                        Incidents by Barangay
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                        Distribution of incidents across barangays for the selected period
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="h-64 md:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={barangayAnalytics.items}
                            margin={{ top: 5, right: 10, left: -15, bottom: 40 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={chartTheme.grid}
                            />
                            <XAxis
                              dataKey="barangay"
                              stroke={chartTheme.axis}
                              tick={{ fontSize: 10 }}
                              interval={0}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              allowDecimals={false}
                              stroke={chartTheme.axis}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                            <Bar
                              dataKey="count"
                              fill={chartTheme.colors[2]}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {barangayAnalytics.items.slice(0, 6).map((item) => (
                          <div
                            key={item.barangay}
                            className="flex items-center justify-between p-2 md:p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {item.barangay}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {item.count} incidents
                              </p>
                            </div>
                            <div className="ml-3 text-xs md:text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {item.percentage.toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {reportType === "incidents" && incidentsByStatus.length > 0 && (
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base md:text-lg text-gray-900 dark:text-gray-100">
                        Status Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-64 md:h-80">
                      <div className="w-full h-full overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={incidentsByStatus.map((item) => ({
                              name: item.status,
                              value: Number(item.count)
                            }))}
                            margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={chartTheme.grid}
                            />
                            <XAxis
                              dataKey="name"
                              stroke={chartTheme.axis}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              allowDecimals={false}
                              stroke={chartTheme.axis}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                            <Bar
                              dataKey="value"
                              fill={chartTheme.colors[0]}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* PDF TAB */}
          <TabsContent value="pdf">
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg md:text-xl text-gray-900 dark:text-gray-100">
                  PDF Reports
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  Generate PDF reports from your data
                </CardDescription>
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