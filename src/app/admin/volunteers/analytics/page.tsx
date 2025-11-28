"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/lib/auth"
import { getAllVolunteers } from "@/lib/volunteers"
import { BarChart3, User, Calendar, CheckCircle, XCircle, TrendingUp, FileText, Award } from "lucide-react"
import { toast } from "sonner"

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

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Volunteer Analytics
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              View detailed analytics and performance metrics for volunteers
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
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
            {/* Volunteer Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <User className="h-6 w-6" />
                {selectedVolunteerData?.first_name} {selectedVolunteerData?.last_name}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.incidents.total}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Incidents</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.incidents.resolved}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Resolved</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analytics.schedules.total}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Schedules</div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{analytics.trainings.total}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Trainings</div>
                </div>
              </div>
            </div>

            {/* Incidents Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Incidents
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.incidents.total}</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Resolved</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.incidents.resolved}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{analytics.incidents.pending}</div>
                </div>
              </div>
              {analytics.incidents.list.length > 0 && (
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
                        <tr key={incident.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{incident.reference_id || incident.id.substring(0, 8)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{incident.incident_type}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              incident.status === 'RESOLVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                              incident.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
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
              )}
            </div>

            {/* Schedules Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedules & Attendance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.schedules.total}</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Accepted</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.schedules.accepted}</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Present</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.schedules.present}</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Absent</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.schedules.absent}</div>
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Acceptance Rate: <span className="font-semibold">{analytics.schedules.total > 0 ? ((analytics.schedules.accepted / analytics.schedules.total) * 100).toFixed(1) : 0}%</span>
                {" | "}
                Attendance Rate: <span className="font-semibold">{analytics.schedules.accepted > 0 ? ((analytics.schedules.present / analytics.schedules.accepted) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>

            {/* Trainings Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Award className="h-5 w-5" />
                Training Performance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Trainings</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.trainings.total}</div>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Evaluations</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analytics.trainings.evaluations}</div>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Rating</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {analytics.trainings.avg_performance_rating > 0 ? analytics.trainings.avg_performance_rating.toFixed(1) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !selectedVolunteer && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Select a Volunteer</h3>
            <p className="text-gray-600 dark:text-gray-400">Choose a volunteer from the dropdown above to view their analytics</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
