"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
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
  Line,
  AreaChart,
  Area
} from "recharts"
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  Clock,
  MapPin,
  FileText
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function VolunteerAnalyticsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<any[]>([])
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>("all")
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year" | "all">("month")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    // Set default date range
    const end = new Date()
    const start = subMonths(end, 1)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    fetchVolunteers()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalytics()
    }
  }, [selectedVolunteer, startDate, endDate])

  const fetchVolunteers = async () => {
    try {
      const res = await fetch('/api/admin/volunteers')
      const json = await res.json()
      if (json.success) {
        setVolunteers(json.data || [])
      }
    } catch (err: any) {
      console.error('Failed to fetch volunteers:', err)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        ...(selectedVolunteer !== "all" ? { volunteer_id: selectedVolunteer } : {}),
        start_date: startDate,
        end_date: endDate
      })

      const res = await fetch(`/api/volunteers/analytics?${params}`)
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.message || 'Failed to fetch analytics')
      }

      if (selectedVolunteer === "all") {
        setAnalytics(json.data || [])
      } else {
        setAnalytics([json.data])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        ...(selectedVolunteer !== "all" ? { volunteer_id: selectedVolunteer } : {}),
        start_date: startDate,
        end_date: endDate,
        export: format
      })

      const res = await fetch(`/api/volunteers/analytics?${params}`)
      
      if (format === 'csv') {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `volunteer-analytics-${selectedVolunteer}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleDateRangeChange = (range: "month" | "quarter" | "year" | "all") => {
    setDateRange(range)
    const end = new Date()
    let start: Date

    switch (range) {
      case "month":
        start = subMonths(end, 1)
        break
      case "quarter":
        start = subMonths(end, 3)
        break
      case "year":
        start = subMonths(end, 12)
        break
      default:
        start = new Date(2020, 0, 1) // All time
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  if (loading && analytics.length === 0) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </AdminLayout>
    )
  }

  const selectedAnalytics = selectedVolunteer === "all" 
    ? analytics 
    : analytics.filter(a => a.volunteer_id === selectedVolunteer)

  // Prepare chart data
  const incidentsByTypeData = selectedAnalytics.length > 0 && selectedAnalytics[0].incidents_by_type
    ? Object.entries(selectedAnalytics[0].incidents_by_type).map(([type, count]) => ({
        name: type,
        value: count
      }))
    : []

  const incidentsBySeverityData = selectedAnalytics.length > 0 && selectedAnalytics[0].incidents_by_severity
    ? Object.entries(selectedAnalytics[0].incidents_by_severity).map(([severity, count]) => ({
        name: severity,
        value: count
      }))
    : []

  const monthlyTrendsData = selectedAnalytics.length > 0 && selectedAnalytics[0].monthly_trends
    ? selectedAnalytics[0].monthly_trends.map((trend: any) => ({
        month: trend.month,
        incidents: trend.count
      }))
    : []

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Volunteer Analytics</h1>
            <p className="text-gray-600 mt-1">Comprehensive profiling and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Volunteer</label>
                <Select value={selectedVolunteer} onValueChange={setSelectedVolunteer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select volunteer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Volunteers</SelectItem>
                    {volunteers.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.first_name} {v.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <Select value={dateRange} onValueChange={handleDateRangeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="quarter">Last Quarter</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {selectedAnalytics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedAnalytics.reduce((sum, a) => sum + (a.total_incidents || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedAnalytics.reduce((sum, a) => sum + (a.total_resolved || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedAnalytics.length > 0 && selectedAnalytics[0].average_response_time_minutes
                    ? `${Math.round(selectedAnalytics[0].average_response_time_minutes)} min`
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Volunteers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedAnalytics.length}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        {selectedAnalytics.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Incidents by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Incidents by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={incidentsByTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {incidentsByTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Incidents by Severity */}
            <Card>
              <CardHeader>
                <CardTitle>Incidents by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={incidentsBySeverityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Trends */}
            {monthlyTrendsData.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Monthly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="incidents" stroke="#8884d8" fill="#8884d8" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Detailed Table */}
        {selectedAnalytics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Details</CardTitle>
              <CardDescription>Individual volunteer performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Volunteer</th>
                      <th className="text-left p-2">Total Incidents</th>
                      <th className="text-left p-2">Resolved</th>
                      <th className="text-left p-2">Avg Response (min)</th>
                      <th className="text-left p-2">By Type</th>
                      <th className="text-left p-2">By Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAnalytics.map((analytics) => (
                      <tr key={analytics.volunteer_id} className="border-b">
                        <td className="p-2 font-medium">{analytics.volunteer_name}</td>
                        <td className="p-2">{analytics.total_incidents}</td>
                        <td className="p-2">{analytics.total_resolved}</td>
                        <td className="p-2">
                          {analytics.average_response_time_minutes 
                            ? `${Math.round(analytics.average_response_time_minutes)} min`
                            : 'N/A'}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(analytics.incidents_by_type || {}).map(([type, count]) => (
                              <Badge key={type} variant="outline">
                                {type}: {count as number}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(analytics.incidents_by_severity || {}).map(([severity, count]) => (
                              <Badge key={severity} variant="outline">
                                {severity}: {count as number}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedAnalytics.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No analytics data available for the selected filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
