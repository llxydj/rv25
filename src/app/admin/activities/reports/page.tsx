"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { BarChart3, Calendar, TrendingUp, Users, CheckCircle, XCircle, FileText } from "lucide-react"
import { toast } from "sonner"

export default function ActivityReportsPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<any>(null)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchReports()
  }, [dateRange])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        ...(dateRange.start_date && { start_date: dateRange.start_date }),
        ...(dateRange.end_date && { end_date: dateRange.end_date })
      })

      const res = await fetch(`/api/admin/activities/reports?${params}`)
      const json = await res.json()

      if (res.ok && json.success) {
        setReports(json.data)
      } else {
        throw new Error(json.message || "Failed to load reports")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load reports")
      setReports(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Activity Reports
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              View comprehensive activity and schedule reports
            </p>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Reports Display */}
        {!loading && reports && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Activities</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reports.summary.total_activities}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Participants</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reports.summary.total_participants}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Acceptance Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reports.summary.avg_acceptance_rate.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Attendance Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reports.summary.avg_attendance_rate.toFixed(1)}%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Schedules Report */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedules Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{reports.schedules.total}</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Accepted</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{reports.schedules.accepted}</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Declined</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{reports.schedules.declined}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{reports.schedules.pending_response}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Attendance Marked</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{reports.schedules.attendance_marked}</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Present</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{reports.schedules.present}</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Absent</div>
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">{reports.schedules.absent}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Acceptance Rate: </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{reports.schedules.acceptance_rate.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Attendance Rate: </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{reports.schedules.attendance_rate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trainings Report */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Trainings Overview
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reports.trainings.total}</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Scheduled</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{reports.trainings.scheduled}</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Ongoing</div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{reports.trainings.ongoing}</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{reports.trainings.completed}</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Cancelled</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{reports.trainings.cancelled}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !reports && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Reports Available</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting the date range to view reports</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

