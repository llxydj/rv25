"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { BarChart3, TrendingUp, TrendingDown, AlertCircle, Download, FileText, MapPin, Clock, Target } from "lucide-react"
import { toast } from "sonner"
import { CITIES, getBarangays } from "@/lib/locations"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export default function ComprehensiveAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })
  const [compareRange, setCompareRange] = useState({
    compare_start_date: '',
    compare_end_date: ''
  })
  const [selectedBarangay, setSelectedBarangay] = useState<string>("")
  const [filters, setFilters] = useState({
    incident_type: '',
    status: '',
    severity: ''
  })

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange, compareRange, selectedBarangay, filters])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        ...(compareRange.compare_start_date && { compare_start_date: compareRange.compare_start_date }),
        ...(compareRange.compare_end_date && { compare_end_date: compareRange.compare_end_date }),
        ...(selectedBarangay && { barangay: selectedBarangay }),
        ...(filters.incident_type && { incident_type: filters.incident_type }),
        ...(filters.status && { status: filters.status }),
        ...(filters.severity && { severity: filters.severity })
      })

      const res = await fetch(`/api/admin/analytics/comprehensive?${params}`)
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

  const exportToPDF = async () => {
    if (!analytics) return
    toast.info('PDF export feature coming soon')
  }

  const exportToCSV = async () => {
    if (!analytics) return
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        ...(selectedBarangay && { barangay: selectedBarangay }),
        ...(filters.incident_type && { incident_type: filters.incident_type }),
        ...(filters.status && { status: filters.status }),
        ...(filters.severity && { severity: filters.severity })
      })
      
      const res = await fetch(`/api/admin/reports?${params.toString()}&export=csv`)
      if (!res.ok) throw new Error('Export failed')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${dateRange.start_date}-${dateRange.end_date}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('CSV exported successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to export CSV')
    }
  }

  // Prepare chart data
  const typeChartData = analytics ? Object.entries(analytics.summary.by_type || {}).map(([name, value]: [string, any]) => ({
    name,
    value
  })) : []

  const barangayChartData = analytics?.geographic?.hotspots?.slice(0, 10).map((h: any) => ({
    name: h.barangay,
    value: h.count,
    risk: h.risk_level
  })) || []

  const timePatternData = analytics?.time_patterns?.by_hour ? 
    Object.entries(analytics.time_patterns.by_hour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, count]: [string, any]) => ({
        hour: `${hour}:00`,
        incidents: count
      })) : []

  const monthlyTrendData = analytics?.time_patterns?.by_month ?
    Object.entries(analytics.time_patterns.by_month)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]: [string, any]) => ({
        month,
        incidents: count
      })) : []

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Analytics Dashboard
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive analytics with visualizations, insights, and policy recommendations for LGU decision-making
            </p>
          </div>
          {analytics && (
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={exportToPDF}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Date Range & Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Compare Start (Optional)</label>
                <input
                  type="date"
                  value={compareRange.compare_start_date}
                  onChange={(e) => setCompareRange({ ...compareRange, compare_start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Compare End (Optional)</label>
                <input
                  type="date"
                  value={compareRange.compare_end_date}
                  onChange={(e) => setCompareRange({ ...compareRange, compare_end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Advanced Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Barangay</label>
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Barangays</option>
                  {CITIES.flatMap(city => getBarangays(city.name).map(brgy => (
                    <option key={brgy} value={brgy}>{brgy}</option>
                  )))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Incident Type</label>
                <select
                  value={filters.incident_type}
                  onChange={(e) => setFilters({ ...filters, incident_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESPONDING">Responding</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Severity</label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
            {/* Key Metrics with Trends */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Incidents"
                value={analytics.summary.total_incidents}
                trend={analytics.comparisons?.incidents_change}
                icon={<FileText className="h-6 w-6" />}
                color="blue"
              />
              <MetricCard
                title="Resolution Rate"
                value={`${analytics.summary.resolution_rate.toFixed(1)}%`}
                trend={analytics.comparisons?.resolution_rate_change}
                icon={<Target className="h-6 w-6" />}
                color="green"
              />
              <MetricCard
                title="Avg Response Time"
                value={`${analytics.summary.avg_response_time_minutes} min`}
                trend={analytics.comparisons?.response_time_change}
                icon={<Clock className="h-6 w-6" />}
                color="orange"
                inverse
              />
              <MetricCard
                title="Active Volunteers"
                value={analytics.summary.total_volunteers}
                icon={<MapPin className="h-6 w-6" />}
                color="purple"
              />
            </div>

            {/* Insights & Recommendations */}
            {(analytics.insights?.insights?.length > 0 || analytics.insights?.recommendations?.length > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-yellow-500" />
                  Key Insights & Recommendations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Insights</h3>
                    <ul className="space-y-2">
                      {analytics.insights.insights.map((insight: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Policy Recommendations</h3>
                    <ul className="space-y-2">
                      {analytics.insights.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-green-500 mt-1">→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Incidents by Type - Pie Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Incidents by Type</h3>
                {typeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {typeChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>

              {/* Top Barangays - Bar Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Incident Areas (Barangays)</h3>
                {barangayChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barangayChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hourly Pattern */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Incidents by Hour of Day</h3>
                {timePatternData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timePatternData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="incidents" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>

              {/* Monthly Trend */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Monthly Trend</h3>
                {monthlyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="incidents" stroke="#82ca9d" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            {/* Geographic Hotspots */}
            {analytics.geographic?.hotspots?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Geographic Risk Assessment</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Barangay</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Incident Count</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {analytics.geographic.hotspots.map((hotspot: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{hotspot.barangay}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{hotspot.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              hotspot.risk_level === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                              hotspot.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                              'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            }`}>
                              {hotspot.risk_level}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function MetricCard({ title, value, trend, icon, color, inverse }: {
  title: string
  value: string | number
  trend?: number
  icon: React.ReactNode
  color: string
  inverse?: boolean
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    orange: 'text-orange-500',
    purple: 'text-purple-500'
  }

  const trendColor = trend !== undefined && trend !== null
    ? (inverse ? (trend < 0 ? 'text-green-500' : trend > 0 ? 'text-red-500' : 'text-gray-500') :
       (trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'))
    : 'text-gray-500'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {trend !== undefined && trend !== null && (
            <div className="flex items-center gap-1 mt-2">
              {trend > 0 ? <TrendingUp className={`h-4 w-4 ${trendColor}`} /> :
               trend < 0 ? <TrendingDown className={`h-4 w-4 ${trendColor}`} /> : null}
              <span className={`text-sm ${trendColor}`}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <div className={colorClasses[color]}>
          {icon}
        </div>
      </div>
    </div>
  )
}

