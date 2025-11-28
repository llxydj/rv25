"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { FileText, Download, BarChart3, TrendingUp, Clock, MapPin, AlertCircle, Users } from "lucide-react"
import { toast } from "sonner"
import { CITIES, getBarangays } from "@/lib/locations"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export default function IncidentAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })
  const [filters, setFilters] = useState({
    incident_type: '',
    status: '',
    barangay: '',
    severity: '',
    volunteer_id: ''
  })

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange, filters])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        ...(filters.incident_type && { incident_type: filters.incident_type }),
        ...(filters.status && { status: filters.status }),
        ...(filters.barangay && { barangay: filters.barangay }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.volunteer_id && { volunteer_id: filters.volunteer_id })
      })

      const res = await fetch(`/api/admin/analytics/incidents/complete?${params}`)
      const json = await res.json()

      if (res.ok && json.success) {
        setAnalytics(json.data)
      } else {
        throw new Error(json.message || "Failed to load analytics")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load analytics")
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async (format: 'json' | 'csv' | 'pdf') => {
    try {
      const res = await fetch('/api/admin/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'incidents',
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          format,
          filters
        })
      })

      if (format === 'csv') {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `incident-report-${dateRange.start_date}-${dateRange.end_date}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
        toast.success('Report exported to CSV')
      } else if (format === 'json') {
        const json = await res.json()
        const dataStr = JSON.stringify(json.data, null, 2)
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `incident-report-${dateRange.start_date}-${dateRange.end_date}.json`
        a.click()
        window.URL.revokeObjectURL(url)
        toast.success('Report exported to JSON')
      } else {
        toast.info('PDF generation available at Reports page')
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report")
    }
  }

  // Prepare chart data
  const typeChartData = analytics ? Object.entries(analytics.by_type || {}).map(([name, data]: [string, any]) => ({
    name,
    value: data.count,
    resolved: data.resolved,
    pending: data.pending
  })) : []

  const barangayChartData = analytics ? Object.entries(analytics.by_barangay || {})
    .sort(([, a]: [string, any], [, b]: [string, any]) => b.count - a.count)
    .slice(0, 10)
    .map(([name, data]: [string, any]) => ({
      name,
      count: data.count,
      resolved: data.resolved,
      pending: data.pending
    })) : []

  const hourlyData = analytics?.time_patterns?.by_hour ? 
    Object.entries(analytics.time_patterns.by_hour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, count]: [string, any]) => ({
        hour: `${hour}:00`,
        incidents: count
      })) : []

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Complete Incident Analytics
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive analytics with all incident details
            </p>
          </div>
          {analytics && (
            <div className="flex gap-2">
              <button
                onClick={() => generateReport('csv')}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() => generateReport('json')}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
              <select
                value={filters.incident_type}
                onChange={(e) => setFilters({ ...filters, incident_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="">All Types</option>
                <option value="FIRE">Fire</option>
                <option value="MEDICAL">Medical</option>
                <option value="FLOOD">Flood</option>
                <option value="EARTHQUAKE">Earthquake</option>
                <option value="TRAFFIC">Traffic</option>
                <option value="CRIME">Crime</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ARRIVED">Arrived</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Barangay</label>
              <select
                value={filters.barangay}
                onChange={(e) => setFilters({ ...filters, barangay: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="">All Barangays</option>
                {CITIES.flatMap(city => getBarangays(city.name).map(brgy => (
                  <option key={brgy} value={brgy}>{brgy}</option>
                )))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="">All Severities</option>
                <option value="MINOR">Minor</option>
                <option value="MODERATE">Moderate</option>
                <option value="SEVERE">Severe</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Analytics Display */}
        {!loading && analytics && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Incidents" value={analytics.summary.total_incidents} icon={<FileText />} color="blue" />
              <MetricCard title="Resolved" value={analytics.summary.resolved} icon={<CheckCircle />} color="green" />
              <MetricCard title="Resolution Rate" value={`${analytics.summary.resolution_rate.toFixed(1)}%`} icon={<TrendingUp />} color="green" />
              <MetricCard title="Avg Response Time" value={`${analytics.summary.response_time.average} min`} icon={<Clock />} color="orange" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Incidents by Type</h3>
                {typeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={typeChartData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                        {typeChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data</p>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Top Barangays</h3>
                {barangayChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barangayChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data</p>
                )}
              </div>
            </div>

            {/* Hourly Pattern */}
            {hourlyData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Incidents by Hour</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="incidents" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Detailed Tables */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">By Type Details</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Resolved</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Pending</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Avg Response (min)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(analytics.by_type).map(([type, data]: [string, any]) => (
                      <tr key={type}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{data.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{data.resolved}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">{data.pending}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{data.avg_response_time.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function MetricCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
        </div>
        <div className={`text-${color}-500`}>{icon}</div>
      </div>
    </div>
  )
}


