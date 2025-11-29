"use client"

import { useEffect, useState, useMemo } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/lib/auth"
import { getAllVolunteers } from "@/lib/volunteers"
import { 
  BarChart3, User, Calendar, CheckCircle, XCircle, TrendingUp, FileText, Award, 
  Clock, MapPin, AlertTriangle, Activity, Target, Zap, Download, Lightbulb,
  TrendingDown, AlertCircle, Star, Award as AwardIcon, Brain, ArrowUp, ArrowDown, Minus
} from "lucide-react"
import { toast } from "sonner"
import { VolunteerInsightsCard } from "@/components/admin/volunteer-insights-card"
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
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658']

export default function VolunteerAnalyticsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    const fetchVolunteers = async () => {
      try {
        const result = await getAllVolunteers()
        if (result.success) {
          setVolunteers(result.data || [])
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load volunteers")
      }
    }
    fetchVolunteers()
  }, [])

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!selectedVolunteer) {
        setAnalytics(null)
        return
      }

      try {
        setLoading(true)
        const params = new URLSearchParams({
          volunteer_id: selectedVolunteer,
          ...(dateRange.start_date && { start_date: dateRange.start_date }),
          ...(dateRange.end_date && { end_date: dateRange.end_date })
        })

        const res = await fetch(`/api/admin/volunteers/analytics?${params}`)
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

    fetchAnalytics()
  }, [selectedVolunteer, dateRange])

  const selectedVolunteerData = volunteers.find(v => v.id === selectedVolunteer)

  // Prepare chart data
  const incidentsByTypeData = analytics?.incidents?.by_type 
    ? Object.entries(analytics.incidents.by_type).map(([name, value]) => ({ name, value }))
    : []

  const incidentsBySeverityData = analytics?.incidents?.by_severity
    ? Object.entries(analytics.incidents.by_severity).map(([name, value]) => ({ name, value }))
    : []

  const incidentsByBarangayData = analytics?.incidents?.by_barangay
    ? Object.entries(analytics.incidents.by_barangay)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    : []

  const dailyTrendData = analytics?.incidents?.daily_trend || []
  const weeklyTrendData = analytics?.incidents?.weekly_trend || []
  const hourlyPatternData = analytics?.incidents?.hourly_pattern || []

  const statusDistributionData = analytics?.incidents
    ? [
        { name: 'Resolved', value: analytics.incidents.resolved || 0, color: '#10b981' },
        { name: 'Pending', value: analytics.incidents.pending || 0, color: '#f59e0b' },
        { name: 'Responding', value: analytics.incidents.responding || 0, color: '#3b82f6' }
      ].filter(item => item.value > 0)
    : []

  // Calculate trend direction
  const trendDirection = useMemo(() => {
    if (dailyTrendData.length < 2) return null
    const recent = dailyTrendData.slice(-7).reduce((sum: number, d: any) => sum + d.count, 0)
    const earlier = dailyTrendData.slice(0, 7).reduce((sum: number, d: any) => sum + d.count, 0)
    if (recent > earlier * 1.1) return 'increasing'
    if (recent < earlier * 0.9) return 'decreasing'
    return 'stable'
  }, [dailyTrendData])

  // Performance score color
  const getPerformanceColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400'
    if (score >= 70) return 'text-blue-600 dark:text-blue-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getPerformanceBgColor = (score: number) => {
    if (score >= 85) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    if (score >= 70) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    if (score >= 60) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Volunteer Analytics
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Systematic data analysis with actionable insights and performance patterns
            </p>
          </div>
        </div>

        {/* Enhanced Insights Card - Shows aggregate insights */}
        <VolunteerInsightsCard />

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Volunteer
              </label>
              <select
                value={selectedVolunteer || ""}
                onChange={(e) => setSelectedVolunteer(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">-- Select a volunteer --</option>
                {volunteers.map((volunteer) => (
                  <option key={volunteer.id} value={volunteer.id}>
                    {volunteer.first_name} {volunteer.last_name} ({volunteer.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && selectedVolunteer && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Analytics Display */}
        {!loading && selectedVolunteer && analytics && (
          <div className="space-y-6">
            {/* Performance Score & Overview */}
            {analytics.performance && (
              <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-2 ${getPerformanceBgColor(analytics.performance.score)}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${getPerformanceBgColor(analytics.performance.score)}`}>
                      <Star className={`h-6 w-6 ${getPerformanceColor(analytics.performance.score)}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Overall Performance</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Comprehensive performance assessment</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-bold ${getPerformanceColor(analytics.performance.score)}`}>
                      {analytics.performance.score}/100
                    </div>
                    <div className={`text-sm font-medium ${getPerformanceColor(analytics.performance.score)}`}>
                      {analytics.performance.level}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      analytics.performance.score >= 85 ? 'bg-green-500' :
                      analytics.performance.score >= 70 ? 'bg-blue-500' :
                      analytics.performance.score >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${analytics.performance.score}%` }}
                  />
                </div>
              </div>
            )}

            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="h-8 w-8 opacity-80" />
                  {trendDirection === 'increasing' && <ArrowUp className="h-5 w-5 opacity-80" />}
                  {trendDirection === 'decreasing' && <ArrowDown className="h-5 w-5 opacity-80" />}
                  {trendDirection === 'stable' && <Minus className="h-5 w-5 opacity-80" />}
                </div>
                <div className="text-3xl font-bold mb-1">{analytics.incidents.total}</div>
                <div className="text-sm opacity-90">Total Incidents</div>
                {analytics.incidents.resolution_rate && (
                  <div className="text-xs mt-2 opacity-75">
                    {analytics.incidents.resolution_rate}% Resolution Rate
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="h-8 w-8 opacity-80" />
                  <Target className="h-5 w-5 opacity-80" />
                </div>
                <div className="text-3xl font-bold mb-1">{analytics.incidents.resolved}</div>
                <div className="text-sm opacity-90">Resolved Incidents</div>
                {analytics.incidents.response_time?.average && (
                  <div className="text-xs mt-2 opacity-75">
                    Avg: {analytics.incidents.response_time.average} min
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="h-8 w-8 opacity-80" />
                  <Activity className="h-5 w-5 opacity-80" />
                </div>
                <div className="text-3xl font-bold mb-1">{analytics.schedules.total}</div>
                <div className="text-sm opacity-90">Total Schedules</div>
                {analytics.schedules.acceptance_rate && (
                  <div className="text-xs mt-2 opacity-75">
                    {analytics.schedules.acceptance_rate}% Acceptance Rate
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Award className="h-8 w-8 opacity-80" />
                  <Zap className="h-5 w-5 opacity-80" />
                </div>
                <div className="text-3xl font-bold mb-1">{analytics.trainings.total}</div>
                <div className="text-sm opacity-90">Trainings Completed</div>
                {analytics.trainings.avg_performance_rating && parseFloat(analytics.trainings.avg_performance_rating) > 0 && (
                  <div className="text-xs mt-2 opacity-75">
                    Avg Rating: {analytics.trainings.avg_performance_rating}/5
                  </div>
                )}
              </div>
            </div>

            {/* Insights & Recommendations */}
            {(analytics.insights?.length > 0 || analytics.recommendations?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Data Insights */}
                {analytics.insights && analytics.insights.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-600" />
                      Data Insights & Patterns
                    </h3>
                    <div className="space-y-3">
                      {analytics.insights.map((insight: string, index: number) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700 dark:text-gray-300">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Recommendations */}
                {analytics.recommendations && analytics.recommendations.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" />
                      Actionable Recommendations
                    </h3>
                    <div className="space-y-3">
                      {analytics.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700 dark:text-gray-300">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Charts Row 1: Incident Trends and Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Trend Chart */}
              {dailyTrendData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Incident Trend Analysis
                    </h3>
                    {trendDirection && (
                      <div className={`flex items-center gap-1 text-sm font-medium ${
                        trendDirection === 'increasing' ? 'text-green-600' :
                        trendDirection === 'decreasing' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {trendDirection === 'increasing' && <ArrowUp className="h-4 w-4" />}
                        {trendDirection === 'decreasing' && <ArrowDown className="h-4 w-4" />}
                        {trendDirection === 'stable' && <Minus className="h-4 w-4" />}
                        {trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)} Trend
                      </div>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dailyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6b7280"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  {dailyTrendData.length > 0 && (
                    <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                      <strong>Pattern:</strong> {dailyTrendData.length} days analyzed. {
                        trendDirection === 'increasing' ? 'Activity is increasing over time.' :
                        trendDirection === 'decreasing' ? 'Activity is decreasing over time.' :
                        'Activity remains stable.'
                      }
                    </div>
                  )}
                </div>
              )}

              {/* Status Distribution Pie Chart */}
              {statusDistributionData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-green-600" />
                    Incident Status Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <strong>Conclusion:</strong> {
                      analytics.incidents.resolved > analytics.incidents.pending + analytics.incidents.responding
                        ? 'High resolution rate indicates effective incident management.'
                        : 'Pending incidents require attention to improve resolution efficiency.'
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Charts Row 2: Type, Severity, and Hourly Patterns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Incidents by Type */}
              {incidentsByTypeData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    Incidents by Type
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={incidentsByTypeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#6b7280"
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      />
                      <Bar dataKey="value" fill="#8884d8" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {analytics.patterns?.dominant_type && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <strong>Pattern:</strong> Specialized in {analytics.patterns.dominant_type} incidents
                    </div>
                  )}
                </div>
              )}

              {/* Incidents by Severity */}
              {incidentsBySeverityData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Incidents by Severity
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={incidentsBySeverityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#6b7280"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      />
                      <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Hourly Pattern */}
              {hourlyPatternData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Hourly Activity Pattern
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={hourlyPatternData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="hour" 
                        stroke="#6b7280"
                        tick={{ fontSize: 10 }}
                        label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        formatter={(value: any) => [`${value} incidents`, 'Count']}
                        labelFormatter={(label) => `Hour ${label}:00`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {hourlyPatternData.length > 0 && (() => {
                    const peakHour = hourlyPatternData.reduce((max, item) => 
                      item.count > max.count ? item : max, hourlyPatternData[0]
                    )
                    return (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        <strong>Peak Activity:</strong> {peakHour.hour}:00 ({peakHour.count} incidents)
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Response Time Metrics */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Response Time Analysis
                </h3>
                <div className="space-y-4">
                  {analytics.incidents.response_time?.average ? (
                    <>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Average</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {analytics.incidents.response_time.average} min
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {analytics.incidents.response_time.average <= 30 
                            ? 'Excellent response time' 
                            : analytics.incidents.response_time.average <= 60 
                            ? 'Good response time' 
                            : 'Needs improvement'}
                        </div>
                      </div>
                      {analytics.incidents.response_time.min && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-sm text-gray-600 dark:text-gray-400">Fastest</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {analytics.incidents.response_time.min} min
                          </div>
                        </div>
                      )}
                      {analytics.incidents.response_time.max && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="text-sm text-gray-600 dark:text-gray-400">Longest</div>
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {analytics.incidents.response_time.max} min
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No response time data available
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule Performance */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  Schedule Performance
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Acceptance Rate</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {analytics.schedules.acceptance_rate || '0.0'}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {parseFloat(analytics.schedules.acceptance_rate || '0') >= 80 
                        ? 'Excellent commitment' 
                        : parseFloat(analytics.schedules.acceptance_rate || '0') >= 50 
                        ? 'Good commitment' 
                        : 'Needs improvement'}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Attendance Rate</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {analytics.schedules.attendance_rate || '0.0'}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {parseFloat(analytics.schedules.attendance_rate || '0') >= 90 
                        ? 'Highly reliable' 
                        : parseFloat(analytics.schedules.attendance_rate || '0') >= 70 
                        ? 'Reliable' 
                        : 'Needs attention'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Barangays */}
              {incidentsByBarangayData.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-red-600" />
                    Geographic Distribution
                  </h3>
                  <div className="space-y-2">
                    {incidentsByBarangayData.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {analytics.patterns?.top_barangay && (
                    <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <strong>Pattern:</strong> Most active in {analytics.patterns.top_barangay}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-red-600" />
                    Geographic Distribution
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No geographic data available
                  </div>
                </div>
              )}
            </div>

            {/* Detailed Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Incidents */}
              {analytics.incidents.list && analytics.incidents.list.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Recent Incidents
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reference</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {analytics.incidents.list.slice(0, 10).map((incident: any) => (
                          <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-mono">
                              {incident.reference_id || incident.id.substring(0, 8)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{incident.incident_type}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                incident.status === 'RESOLVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                incident.status === 'RESPONDING' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                                incident.status === 'ASSIGNED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {incident.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              {new Date(incident.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Schedule List */}
              {analytics.schedules.list && analytics.schedules.list.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Schedules
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Title</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {analytics.schedules.list.slice(0, 10).map((schedule: any) => (
                          <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{schedule.title || 'Untitled'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                schedule.is_accepted ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {schedule.is_accepted ? 'Accepted' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                              {new Date(schedule.start_time).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !selectedVolunteer && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Select a Volunteer</h3>
            <p className="text-gray-600 dark:text-gray-400">Choose a volunteer from the dropdown above to view comprehensive analytics with insights and actionable recommendations</p>
          </div>
        )}

        {/* No Data State */}
        {!loading && selectedVolunteer && analytics && analytics.incidents.total === 0 && analytics.schedules.total === 0 && analytics.trainings.total === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Activity Data</h3>
            <p className="text-gray-600 dark:text-gray-400">
              This volunteer has no incidents, schedules, or training records for the selected date range.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
