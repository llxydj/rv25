"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { AlertTriangle, BellRing, CalendarDays, User, Users, BarChart3, MapPin, Clock, MessageSquare, CheckCircle } from "lucide-react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getAllIncidents, subscribeToIncidents } from "@/lib/incidents"
import { getAllVolunteers } from "@/lib/volunteers"
import { getSchedules } from "@/lib/schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { IncidentReferenceId } from "@/components/ui/incident-reference-id"
import React from "react"
import { CallAnalyticsDashboard } from "@/components/call-analytics-dashboard"
import { useRouter } from "next/navigation"
import { PushNotificationToggle } from "@/components/push-notification-toggle"
import { MetricsChart } from "@/components/admin/metrics-chart"
import { StatWidget } from "@/components/admin/stat-widget"
import { AdminMetrics } from "@/types/admin-metrics"
import { VolunteerInsightsCard } from "@/components/admin/volunteer-insights-card"

export default function AdminDashboard() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [summary, setSummary] = useState<{
    total_incidents: number
    pending_count: number
    assigned_count: number
    responding_count: number
    arrived_count: number
    resolved_today_count: number
  } | null>(null)
  const [statistics, setStatistics] = useState<{
    totalCalls: number
    callsByType: Record<string, number>
    recentCalls: number
    averageDuration: number
  } | null>(null)
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const router = useRouter()

  const handleIncidentClick = useCallback((id: string) => {
    router.push(`/admin/incidents/${id}`)
  }, [router])

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      setMetricsLoading(true)
      const [incidentsResult, volunteersResult, schedulesResult, dashboardRes, metricsRes] = await Promise.all([
        getAllIncidents(),
        getAllVolunteers(),
        getSchedules(),
        fetch('/api/analytics/dashboard').then(r => r.json()).catch(() => null),
        fetch('/api/analytics/admin-metrics').then(r => r.json()).catch(() => null),
      ])

      if (incidentsResult?.success) setIncidents(incidentsResult.data || [])
      if (volunteersResult?.success) setVolunteers(volunteersResult.data || [])
      if (schedulesResult?.success) setSchedules(schedulesResult.data || [])
      if (dashboardRes && dashboardRes.success) setSummary(dashboardRes.data || null)
      if (metricsRes && metricsRes.success) setAdminMetrics(metricsRes.data || null)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
      setMetricsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!user) return
    const subscription = subscribeToIncidents((payload) => {
      console.log('Real-time incident update:', payload.eventType)
      fetchData()
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [user, fetchData])

  const mapMarkers = useMemo(() => incidents
    .filter((incident) => incident.location_lat && incident.location_lng)
    .map((incident) => ({
      id: incident.id,
      position: [incident.location_lat, incident.location_lng] as [number, number],
      status: incident.status,
      title: incident.incident_type,
      description: incident.description,
      onClick: handleIncidentClick
    })), [incidents, handleIncidentClick])

  useEffect(() => {
    const t = setTimeout(() => setShowMap(true), 0)
    return () => clearTimeout(t)
  }, [])

  // Use summary data from API for accurate counts, fallback to incidents array if summary not available
  const pendingCount = summary?.pending_count ?? incidents.filter((i) => i.status === "PENDING").length
  const assignedCount = summary?.assigned_count ?? incidents.filter((i) => i.status === "ASSIGNED").length
  const respondingCount = summary?.responding_count ?? incidents.filter((i) => i.status === "RESPONDING").length
  const arrivedCount = summary?.arrived_count ?? incidents.filter((i) => i.status === "ARRIVED").length
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length

  const activeVolunteers = volunteers.filter(
    (v) => v.volunteer_profiles && v.volunteer_profiles.status === "ACTIVE",
  ).length

  const today = new Date().toISOString().split("T")[0]
  const todaySchedules = schedules.filter((s) => s.start_time && s.start_time.startsWith(today)).length

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* HEADER - FIXED */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Admin Dashboard
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Monitor incidents, volunteers, and system performance
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <Link
              href="/admin/volunteers/new"
              className="inline-flex items-center px-3 py-2 md:px-4 text-sm md:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-900 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <User className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden sm:inline">New Volunteer</span>
              <span className="sm:hidden">New</span>
            </Link>
            <Link
              href="/admin/reports"
              className="inline-flex items-center px-3 py-2 md:px-4 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <CalendarDays className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Reports
            </Link>
            <Link
              href="/admin/sms"
              className="inline-flex items-center px-3 py-2 md:px-4 text-sm md:text-base bg-purple-600 text-white rounded-lg hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-900 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <MessageSquare className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              <span className="hidden sm:inline">SMS Management</span>
              <span className="sm:hidden">SMS</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Loading dashboard data..." />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 dark:border-red-600 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* STATS CARDS - FIXED */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">
                      Pending Incidents
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-yellow-600 dark:text-yellow-500">
                      {pendingCount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Requires attention
                    </p>
                  </div>
                  <div className="p-3 md:p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 flex-shrink-0 ml-2">
                    <AlertTriangle className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Link
                    href="/admin/incidents?status=PENDING"
                    className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors duration-200 hover:underline"
                  >
                    View all pending incidents →
                  </Link>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">
                      Active Incidents
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-500">
                      {assignedCount + respondingCount + arrivedCount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      In progress
                    </p>
                  </div>
                  <div className="p-3 md:p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 flex-shrink-0 ml-2">
                    <BellRing className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Link
                    href="/admin/incidents?status=ACTIVE"
                    className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors duration-200"
                  >
                    View all active incidents →
                  </Link>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">
                      Active Volunteers
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-500">
                      {activeVolunteers}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Available for response
                    </p>
                  </div>
                  <div className="p-3 md:p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 flex-shrink-0 ml-2">
                    <User className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Link 
                    href="/admin/volunteers" 
                    className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors duration-200"
                  >
                    View all volunteers →
                  </Link>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">
                      Today's Schedules
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-500">
                      {todaySchedules}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Planned activities
                    </p>
                  </div>
                  <div className="p-3 md:p-4 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-500 flex-shrink-0 ml-2">
                    <CalendarDays className="h-6 w-6 md:h-8 md:w-8" />
                  </div>
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Link 
                    href="/admin/schedules" 
                    className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors duration-200"
                  >
                    View all schedules →
                  </Link>
                </div>
              </div>
            </div>

            {/* ADMIN METRICS */}
            {metricsLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" text="Loading metrics..." />
              </div>
            ) : adminMetrics && (
              <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <StatWidget
                    title="Total Users"
                    value={Object.values(adminMetrics.usersByRole).reduce((a: any, b: any) => a + b, 0)}
                    description="All registered users"
                    icon={<Users className="h-4 w-4" />}
                  />
                  <StatWidget
                    title="Active Residents"
                    value={adminMetrics.systemMetrics.activeResidents}
                    description="Currently registered residents"
                    icon={<Users className="h-4 w-4" />}
                  />
                  <StatWidget
                    title="Resolved Today"
                    value={summary?.resolved_today_count ?? 0}
                    description="Incidents resolved today"
                    icon={<CheckCircle className="h-4 w-4" />}
                  />
                  <StatWidget
                    title="Total Incidents"
                    value={summary?.total_incidents ?? adminMetrics.systemMetrics.totalIncidents}
                    description="All reported incidents"
                    icon={<BellRing className="h-4 w-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <StatWidget
                    title="Avg. Assignment Time"
                    value={`${adminMetrics.volunteerResponseMetrics.avgAssignmentTime.toFixed(1)} min`}
                    description="Time to assign incidents"
                    icon={<Clock className="h-4 w-4" />}
                  />
                  <StatWidget
                    title="Avg. Resolution Time"
                    value={`${adminMetrics.volunteerResponseMetrics.avgResolutionTime.toFixed(1)} min`}
                    description="Time to resolve incidents"
                    icon={<Clock className="h-4 w-4" />}
                  />
                  <StatWidget
                    title="Total Resolved"
                    value={adminMetrics.volunteerResponseMetrics.totalResolved}
                    description="Incidents resolved"
                    icon={<BellRing className="h-4 w-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  <MetricsChart
                    title="Incidents by Barangay"
                    data={adminMetrics.incidentsByBarangay}
                    type="bar"
                    dataKey="count"
                    nameKey="barangay"
                  />
                  <MetricsChart
                    title="Users by Role"
                    data={Object.entries(adminMetrics.usersByRole).map(([role, count]) => ({
                      role,
                      count
                    }))}
                    type="pie"
                    dataKey="count"
                    nameKey="role"
                  />
                </div>

                {/* BARANGAY DISTRIBUTION */}
                <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Barangay Incident Distribution
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {adminMetrics.incidentsByBarangay.slice(0, 6).map((item: any) => (
                      <div 
                        key={item.barangay} 
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 md:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100 truncate">
                              {item.barangay}
                            </h3>
                            <p className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                              {item.count}
                            </p>
                          </div>
                          <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs md:text-sm font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                            {item.percentage}%
                          </div>
                        </div>
                        <div className="mt-2 md:mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          of total incidents
                        </p>
                      </div>
                    ))}
                  </div>
                  {adminMetrics.incidentsByBarangay.length > 6 && (
                    <div className="mt-4 text-center">
                      <Link 
                        href="/admin/analytics" 
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      >
                        View all barangay analytics →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PUSH NOTIFICATIONS */}
            <div className="max-w-full lg:max-w-2xl">
              <PushNotificationToggle />
            </div>

            {/* RECENT INCIDENTS & MAP */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Recent Incidents
                  </h2>
                  <Link 
                    href="/admin/incidents" 
                    className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors duration-200"
                  >
                    View all →
                  </Link>
                </div>
                
                {/* MOBILE CARDS */}
                <div className="md:hidden space-y-3">
                  {incidents.slice(0, 5).map((incident) => (
                    <div
                      key={incident.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer touch-manipulation active:scale-[0.98]"
                      onClick={() => router.push(`/admin/incidents/${incident.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {incident.incident_type}
                          </h3>
                          <IncidentReferenceId 
                            incidentId={incident.id} 
                            size="sm" 
                            variant="inline"
                            showLabel={false}
                            showCopyButton={false}
                          />
                        </div>
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full flex-shrink-0 ${
                            incident.status === "PENDING"
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                              : incident.status === "ASSIGNED"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                : incident.status === "RESPONDING"
                                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                                  : incident.status === "RESOLVED"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>Date: {new Date(incident.created_at).toLocaleDateString()}</div>
                        <div>
                          Reporter: {incident.reporter?.first_name && incident.reporter?.last_name
                            ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                            : incident.reporter?.first_name || incident.reporter?.last_name || "Anonymous"}
                        </div>
                        <div>
                          Contact: {incident.reporter?.phone_number || "Not provided"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {incidents.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400 text-sm">
                        No incidents found
                      </div>
                    </div>
                  )}
                </div>
                
                {/* DESKTOP TABLE */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Reporter
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Contact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {incidents.slice(0, 5).map((incident) => (
                        <tr 
                          key={incident.id}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                          onClick={() => router.push(`/admin/incidents/${incident.id}`)}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {incident.incident_type}
                            </div>
                            <div className="mt-1">
                              <IncidentReferenceId 
                                incidentId={incident.id} 
                                size="sm" 
                                variant="inline"
                                showLabel={false}
                                showCopyButton={false}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(incident.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                incident.status === "PENDING"
                                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                                  : incident.status === "ASSIGNED"
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                    : incident.status === "RESPONDING"
                                      ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                                      : incident.status === "RESOLVED"
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300"
                              }`}
                            >
                              {incident.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {incident.reporter?.first_name && incident.reporter?.last_name
                              ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                              : incident.reporter?.first_name || incident.reporter?.last_name || "Anonymous Reporter"}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {incident.reporter?.phone_number || "Not provided"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {incidents.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400 text-sm">
                        No incidents found
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* INCIDENT MAP */}
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Incident Map
                  </h2>
                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    {mapMarkers.length} incidents
                  </div>
                </div>
                {showMap ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <MapComponent 
                      markers={mapMarkers} 
                      height="300px" 
                      showVolunteerLocations={true}
                      showBoundary={true}
                    />
                  </div>
                ) : (
                  <div className="h-[300px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
                      <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                        Loading map...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* HOTSPOTS */}
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Hotspots (Last 30 Days)
                  </h2>
                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    Top areas
                  </div>
                </div>
                <HotspotsList />
              </div>
            </div>

            {/* VOLUNTEER INSIGHTS - Enhanced Analytics */}
            <div className="mt-4 md:mt-6">
              <VolunteerInsightsCard />
            </div>

            {/* CALL ANALYTICS */}
            {statistics && statistics.totalCalls > 0 && (
              <CallAnalyticsDashboard className="mt-4 md:mt-6" />
            )}

            {/* RESPONSE TIMES */}
            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Response Times (Last 30 Days)
                </h2>
                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                  Performance metrics
                </div>
              </div>
              <ResponseTimesCard />
            </div>

          </>
        )}
      </div>
    </AdminLayout>
  )
}

function HotspotsList() {
  const [items, setItems] = React.useState<{ barangay: string; count: number }[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/analytics/hotspots?days=30')
        const json = await res.json()
        if (!canceled) {
          if (res.ok && json.success) setItems(json.data || [])
          else setError(json.message || 'Failed to load hotspots')
        }
      } catch (e: any) {
        if (!canceled) setError(e?.message || 'Failed to load hotspots')
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [])

  if (loading) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
  }
  if (error) {
    return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
  }
  if (!items.length) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
  }

  return (
    <div className="space-y-2 md:space-y-3">
      {items.slice(0, 10).map((row, index) => (
        <div 
          key={`hotspot-${index}-${row.barangay}`} 
          className="flex items-center justify-between p-2 md:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {index + 1}
            </div>
            <div className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {row.barangay}
            </div>
          </div>
          <div className="text-xs md:text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 md:py-1 rounded-full whitespace-nowrap flex-shrink-0 ml-2">
            {row.count} incidents
          </div>
        </div>
      ))}
    </div>
  )
}

function ResponseTimesCard() {
  const [data, setData] = React.useState<{
    days: number
    count: number
    avg_minutes_to_assign: number | null
    avg_minutes_to_respond: number | null
    avg_minutes_to_resolve: number | null
  } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/analytics/response-times?days=30')
        const json = await res.json()
        if (!canceled) {
          if (res.ok && json.success) setData(json.data)
          else setError(json.message || 'Failed to load response times')
        }
      } catch (e: any) {
        if (!canceled) setError(e?.message || 'Failed to load response times')
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [])

  if (loading) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
  }
  if (error) {
    return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
  }
  if (!data) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No data</div>
  }

  const item = (label: string, value: number | null, color: string) => (
    <div className="flex items-center justify-between p-2 md:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </div>
      <div className={`text-xs md:text-sm font-bold ${color}`}>
        {value !== null ? `${value.toFixed(1)} min` : '—'}
      </div>
    </div>
  )

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/30 p-2 md:p-3 rounded-lg">
        <span className="font-medium">Incidents analyzed:</span> {data.count}
      </div>
      <div className="grid grid-cols-1 gap-2 md:gap-3">
        {item('Average Time to Assign', data.avg_minutes_to_assign, 'text-blue-600 dark:text-blue-400')}
        {item('Average Time to Respond', data.avg_minutes_to_respond, 'text-orange-600 dark:text-orange-400')}
        {item('Average Time to Resolve', data.avg_minutes_to_resolve, 'text-green-600 dark:text-green-400')}
      </div>
    </div>
  )
}