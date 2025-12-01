"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getScheduleStatistics, getSchedules } from "@/lib/schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { supabase } from "@/lib/supabase"
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  Users,
  TrendingUp,
  Activity
} from "lucide-react"
import Link from "next/link"

interface ScheduleStats {
  scheduled_count: number | null
  ongoing_count: number | null
  completed_count: number | null
  cancelled_count: number | null
  accepted_count: number | null
  declined_count: number | null
  pending_response_count: number | null
  upcoming_count: number | null
  active_count: number | null
  attendance_marked_count: number | null
  total_count: number | null
}

export default function ActivityDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ScheduleStats | null>(null)
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [upcomingActivities, setUpcomingActivities] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch statistics
        const statsResult = await getScheduleStatistics()
        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data)
        }

        // Fetch recent activities (last 5 completed)
        const recentResult = await getSchedules()
        if (recentResult.success) {
          const recent = recentResult.data
            .filter((s: any) => s.status === 'COMPLETED')
            .sort((a: any, b: any) => 
              new Date(b.completed_at || b.updated_at).getTime() - 
              new Date(a.completed_at || a.updated_at).getTime()
            )
            .slice(0, 5)
          setRecentActivities(recent)

          // Get upcoming activities
          const upcoming = recentResult.data
            .filter((s: any) => 
              s.status === 'SCHEDULED' && 
              new Date(s.start_time) > new Date()
            )
            .sort((a: any, b: any) => 
              new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            )
            .slice(0, 5)
          setUpcomingActivities(upcoming)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user])

  // Subscribe to real-time schedule updates
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('schedules_dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules'
        },
        async (payload) => {
          console.log('Schedule change detected:', payload.eventType)
          
          // Refetch statistics on any change
          const statsResult = await getScheduleStatistics()
          if (statsResult.success && statsResult.data) {
            setStats(statsResult.data)
          }

          // Refetch activities list
          const recentResult = await getSchedules()
          if (recentResult.success) {
            const recent = recentResult.data
              .filter((s: any) => s.status === 'COMPLETED')
              .sort((a: any, b: any) => 
                new Date(b.completed_at || b.updated_at).getTime() - 
                new Date(a.completed_at || a.updated_at).getTime()
              )
              .slice(0, 5)
            setRecentActivities(recent)

            const upcoming = recentResult.data
              .filter((s: any) => 
                s.status === 'SCHEDULED' && 
                new Date(s.start_time) > new Date()
              )
              .sort((a: any, b: any) => 
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              )
              .slice(0, 5)
            setUpcomingActivities(upcoming)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  if (!user || (user.role && user.role.toLowerCase() !== 'admin')) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-red-500">You don't have permission to view this page.</p>
        </div>
      </AdminLayout>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-screen">
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </AdminLayout>
    )
  }

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    bgColor,
    trend 
  }: { 
    title: string
    value: number
    icon: any
    color: string
    bgColor: string
    trend?: string
  }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <p className="text-xs text-gray-500 mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`${bgColor} p-4 rounded-full`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Dashboard</h1>
            <p className="text-gray-600 mt-1">Overview of volunteer activities and schedules</p>
          </div>
          <Link
            href="/admin/schedules"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Manage Schedules
          </Link>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Activities"
            value={stats?.total_count || 0}
            icon={Activity}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          
          <StatCard
            title="Upcoming"
            value={stats?.upcoming_count || 0}
            icon={Calendar}
            color="text-purple-600"
            bgColor="bg-purple-100"
            trend={`${stats?.scheduled_count || 0} scheduled`}
          />
          
          <StatCard
            title="Active Now"
            value={stats?.active_count || 0}
            icon={Clock}
            color="text-orange-600"
            bgColor="bg-orange-100"
          />
          
          <StatCard
            title="Completed"
            value={stats?.completed_count || 0}
            icon={CheckCircle}
            color="text-green-600"
            bgColor="bg-green-100"
          />
        </div>

        {/* Response Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Acceptance Rate</h3>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Accepted</span>
                <span className="font-semibold text-green-600">
                  {stats?.accepted_count || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Declined</span>
                <span className="font-semibold text-red-600">
                  {stats?.declined_count || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pending Response</span>
                <span className="font-semibold text-yellow-600">
                  {stats?.pending_response_count || 0}
                </span>
              </div>
            </div>
            {stats && stats.total_count > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round((stats.accepted_count / stats.total_count) * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">Overall acceptance</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Status Overview</h3>
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Scheduled</span>
                <span className="font-semibold text-blue-600">
                  {stats?.scheduled_count || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ongoing</span>
                <span className="font-semibold text-orange-600">
                  {stats?.ongoing_count || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cancelled</span>
                <span className="font-semibold text-gray-600">
                  {stats?.cancelled_count || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Attendance</h3>
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Attendance Marked</span>
                <span className="font-semibold text-purple-600">
                  {stats?.attendance_marked_count || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Completed Activities</span>
                <span className="font-semibold text-green-600">
                  {stats?.completed_count || 0}
                </span>
              </div>
            </div>
            {stats && stats.completed_count > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round((stats.attendance_marked_count / stats.completed_count) * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">Attendance tracking</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent & Upcoming Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Activities */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Activities</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {upcomingActivities.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p>No upcoming activities</p>
                </div>
              ) : (
                upcomingActivities.map((activity) => (
                  <div key={activity.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {activity.volunteer?.first_name} {activity.volunteer?.last_name}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(activity.start_time).toLocaleDateString()} at{' '}
                          {new Date(activity.start_time).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        activity.is_accepted === true 
                          ? 'bg-green-100 text-green-800'
                          : activity.is_accepted === false
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {activity.is_accepted === true 
                          ? 'Accepted'
                          : activity.is_accepted === false
                          ? 'Declined'
                          : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recently Completed */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recently Completed</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recentActivities.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <CheckCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  <p>No completed activities</p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {activity.volunteer?.first_name} {activity.volunteer?.last_name}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed {new Date(activity.completed_at || activity.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      {activity.attendance_marked && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Attendance ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Need Help?</h3>
              <p className="text-red-100 mt-1">
                Manage all activities, track attendance, and view detailed reports
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/admin/schedules"
                className="px-4 py-2 bg-white text-red-600 rounded-md hover:bg-red-50 transition-colors font-medium"
              >
                View All Schedules
              </Link>
              <Link
                href="/admin/volunteers"
                className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors font-medium"
              >
                Manage Volunteers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
