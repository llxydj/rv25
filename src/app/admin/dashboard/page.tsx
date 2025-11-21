"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { AlertTriangle, BellRing, CalendarDays, User, Users, BarChart3, MapPin, Clock } from "lucide-react"
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
import { BackupMonitor } from "@/components/admin/backup-monitor"

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
    resolved_today_count: number
  } | null>(null)
  const [statistics, setStatistics] = useState<{
    totalCalls: number
    callsByType: Record<string, number>
    recentCalls: number
    averageDuration: number
  } | null>(null)
  // New state for admin metrics
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const router = useRouter()

  // Memoize the click handler to keep it stable
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

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time subscription for incidents
  useEffect(() => {
    if (!user) return

    const subscription = subscribeToIncidents((payload) => {
      console.log('Real-time incident update:', payload.eventType)
      // Refresh data when incidents change
      fetchData()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [user, fetchData])

  // Format incidents for map markers
  // FIXED: Removed router from dependencies, use memoized click handler instead
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

  // Defer map mount to next tick after client mount to avoid dev double-mount race
  useEffect(() => {
    const t = setTimeout(() => setShowMap(true), 0)
    return () => clearTimeout(t)
  }, [])

  // Get status counts
  const pendingCount = incidents.filter((i) => i.status === "PENDING").length
  const assignedCount = incidents.filter((i) => i.status === "ASSIGNED").length
  const respondingCount = incidents.filter((i) => i.status === "RESPONDING").length
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length

  // Get active volunteers count
  const activeVolunteers = volunteers.filter(
    (v) => v.volunteer_profiles && v.volunteer_profiles.status === "ACTIVE",
  ).length

  // Get today's schedules
  const today = new Date().toISOString().split("T")[0]
  const todaySchedules = schedules.filter((s) => s.start_time && s.start_time.startsWith(today)).length

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Monitor incidents, volunteers, and system performance</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
            <Link
              href="/admin/volunteers/new"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <User className="mr-2 h-5 w-5" />
              New Volunteer
            </Link>
            <Link
              href="/admin/reports"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <CalendarDays className="mr-2 h-5 w-5" />
              Reports
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Loading dashboard data..." />
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Existing Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200 hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Pending Incidents</p>
                    <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
                    <p className="text-xs text-gray-500 mt-1">Requires attention</p>
                  </div>
                  <div className="p-4 rounded-full bg-yellow-100 text-yellow-600">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    href="/admin/incidents?status=PENDING"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200 hover:underline"
                  >
                    View all pending incidents →
                  </Link>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Active Incidents</p>
                    <p className="text-3xl font-bold text-blue-600">{assignedCount + respondingCount}</p>
                    <p className="text-xs text-gray-500 mt-1">In progress</p>
                  </div>
                  <div className="p-4 rounded-full bg-blue-100 text-blue-600">
                    <BellRing className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    href="/admin/incidents?status=ACTIVE"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
                  >
                    View all active incidents →
                  </Link>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Active Volunteers</p>
                    <p className="text-3xl font-bold text-green-600">{activeVolunteers}</p>
                    <p className="text-xs text-gray-500 mt-1">Available for response</p>
                  </div>
                  <div className="p-4 rounded-full bg-green-100 text-green-600">
                    <User className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link href="/admin/volunteers" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200">
                    View all volunteers →
                  </Link>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Today's Schedules</p>
                    <p className="text-3xl font-bold text-purple-600">{todaySchedules}</p>
                    <p className="text-xs text-gray-500 mt-1">Planned activities</p>
                  </div>
                  <div className="p-4 rounded-full bg-purple-100 text-purple-600">
                    <CalendarDays className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link href="/admin/schedules" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200">
                    View all schedules →
                  </Link>
                </div>
              </div>
            </div>

            {/* New Admin Metrics Section */}
            {metricsLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" text="Loading metrics..." />
              </div>
            ) : adminMetrics && (
              <div className="space-y-6">
                {/* System-wide Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    title="Active Volunteers"
                    value={adminMetrics.systemMetrics.activeVolunteers}
                    description="Available for incidents"
                    icon={<User className="h-4 w-4" />}
                  />
                  <StatWidget
                    title="Total Incidents"
                    value={adminMetrics.systemMetrics.totalIncidents}
                    description="All reported incidents"
                    icon={<BellRing className="h-4 w-4" />}
                  />
                </div>

                {/* Volunteer Response Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Incidents by Barangay Chart */}
                  <MetricsChart
                    title="Incidents by Barangay"
                    data={adminMetrics.incidentsByBarangay}
                    type="bar"
                    dataKey="count"
                    nameKey="barangay"
                  />

                  {/* Users by Role Chart */}
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

                {/* Barangay-level Percentage Analytics */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Barangay Incident Distribution</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {adminMetrics.incidentsByBarangay.slice(0, 6).map((item: any, index: number) => (
                      <div key={item.barangay} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{item.barangay}</h3>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{item.count}</p>
                          </div>
                          <div className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                            {item.percentage}%
                          </div>
                        </div>
                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">of total incidents</p>
                      </div>
                    ))}
                  </div>
                  {adminMetrics.incidentsByBarangay.length > 6 && (
                    <div className="mt-4 text-center">
                      <Link href="/admin/analytics" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View all barangay analytics →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Push Notification Settings */}
            <div className="max-w-2xl">
              <PushNotificationToggle />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Incidents</h2>
                  <Link 
                    href="/admin/incidents" 
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
                  >
                    View all →
                  </Link>
                </div>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {incidents.slice(0, 5).map((incident) => (
                    <div
                      key={incident.id}
                      className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation"
                      onClick={() => router.push(`/admin/incidents/${incident.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{incident.incident_type}</h3>
                          <IncidentReferenceId 
                            incidentId={incident.id} 
                            size="sm" 
                            variant="inline"
                            showLabel={false}
                            showCopyButton={false}
                          />
                        </div>
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full flex-shrink-0 ml-2 ${
                            incident.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : incident.status === "ASSIGNED"
                                ? "bg-blue-100 text-blue-800"
                                : incident.status === "RESPONDING"
                                  ? "bg-orange-100 text-orange-800"
                                  : incident.status === "RESOLVED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Date: {new Date(incident.created_at).toLocaleDateString()}</div>
                        <div>
                          Reporter: {incident.reporter && incident.reporter.first_name && incident.reporter.last_name
                            ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                            : incident.reporter && (incident.reporter.first_name || incident.reporter.last_name)
                            ? (incident.reporter.first_name || incident.reporter.last_name)
                            : "Anonymous"}
                        </div>
                        <div>
                          Contact:{" "}
                          {incident.reporter && incident.reporter.phone_number
                            ? incident.reporter.phone_number
                            : "Not provided"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {incidents.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-gray-500 text-sm">No incidents found</div>
                    </div>
                  )}
                </div>
                
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Type
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Date
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Reporter
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Contact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {incidents.slice(0, 5).map((incident) => (
                        <tr 
                          key={incident.id}
                          className="cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                          onClick={() => router.push(`/admin/incidents/${incident.id}`)}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{incident.incident_type}</div>
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
                            <div className="text-sm text-gray-500">
                              {new Date(incident.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                incident.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : incident.status === "ASSIGNED"
                                    ? "bg-blue-100 text-blue-800"
                                    : incident.status === "RESPONDING"
                                      ? "bg-orange-100 text-orange-800"
                                      : incident.status === "RESOLVED"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {incident.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {incident.reporter && incident.reporter.first_name && incident.reporter.last_name
                              ? `${incident.reporter.first_name} ${incident.reporter.last_name}`
                              : incident.reporter && (incident.reporter.first_name || incident.reporter.last_name)
                              ? (incident.reporter.first_name || incident.reporter.last_name)
                              : "Anonymous Reporter"}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {incident.reporter && incident.reporter.phone_number
                              ? incident.reporter.phone_number
                              : "Not provided"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {incidents.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-gray-500 text-sm">No incidents found</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Incident Map</h2>
                  <div className="text-sm text-gray-500">
                    {mapMarkers.length} incidents
                  </div>
                </div>
                {showMap ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <MapComponent 
                      markers={mapMarkers} 
                      height="300px" 
                      showVolunteerLocations={true}
                    />
                  </div>
                ) : (
                  <div style={{ height: "300px" }} className="rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-2 text-gray-600 text-sm">Loading map...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Hotspots (Last 30 Days)</h2>
                  <div className="text-sm text-gray-500">Top areas</div>
                </div>
                <HotspotsList />
              </div>
            </div>

            {/* Call Analytics Dashboard - Only show if there's data */}
            {statistics && statistics.totalCalls > 0 && (
              <CallAnalyticsDashboard className="mt-6" />
            )}

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mt-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Response Times (Last 30 Days)</h2>
                <div className="text-sm text-gray-500">Performance metrics</div>
              </div>
              <ResponseTimesCard />
            </div>

            {/* Backup Monitor */}
            <div className="mt-6">
              <BackupMonitor />
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

  if (loading) return <div className="text-sm text-gray-600">Loading...</div>
  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (!items.length) return <div className="text-sm text-gray-500">No data</div>

  return (
    <div className="space-y-3">
      {items.slice(0, 10).map((row, index) => (
        <div key={row.barangay} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-semibold">
              {index + 1}
            </div>
            <div className="text-sm font-medium text-gray-800">{row.barangay}</div>
          </div>
          <div className="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
            {row.count} incidents
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-sm">No hotspot data available</div>
        </div>
      )}
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

  if (loading) return <div className="text-sm text-gray-600">Loading...</div>
  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (!data) return <div className="text-sm text-gray-500">No data</div>

  const item = (label: string, value: number | null, color: string) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className={`text-sm font-bold ${color}`}>
        {value !== null ? `${value.toFixed(1)} min` : '—'}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
        <span className="font-medium">Incidents analyzed:</span> {data.count}
      </div>
      <div className="grid grid-cols-1 gap-3">
        {item('Average Time to Assign', data.avg_minutes_to_assign, 'text-blue-600')}
        {item('Average Time to Respond', data.avg_minutes_to_respond, 'text-orange-600')}
        {item('Average Time to Resolve', data.avg_minutes_to_resolve, 'text-green-600')}
      </div>
    </div>
  )
}
