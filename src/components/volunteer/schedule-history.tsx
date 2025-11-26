"use client"

import { useEffect, useState } from "react"
import { getVolunteerSchedules, getVolunteerScheduleStats } from "@/lib/schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle, TrendingUp } from "lucide-react"

interface ScheduleHistoryProps {
  volunteerId: string
}

export function ScheduleHistory({ volunteerId }: ScheduleHistoryProps) {
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'completed' | 'upcoming' | 'pending'>('all')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch schedules
        const schedulesResult = await getVolunteerSchedules(volunteerId)
        if (schedulesResult.success) {
          setSchedules(schedulesResult.data || [])
        }

        // Fetch statistics
        const statsResult = await getVolunteerScheduleStats(volunteerId)
        if (statsResult.success) {
          setStats(statsResult.data)
        }
      } catch (error) {
        console.error('Error fetching schedule history:', error)
      } finally {
        setLoading(false)
      }
    }

    if (volunteerId) {
      fetchData()
    }
  }, [volunteerId])

  const getFilteredSchedules = () => {
    switch (filter) {
      case 'completed':
        return schedules.filter(s => s.status === 'COMPLETED')
      case 'upcoming':
        return schedules.filter(s => 
          s.status === 'SCHEDULED' && new Date(s.start_time) > new Date()
        )
      case 'pending':
        return schedules.filter(s => s.is_accepted === null)
      default:
        return schedules
    }
  }

  const filteredSchedules = getFilteredSchedules()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200'
      case 'ONGOING': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getAcceptanceColor = (isAccepted: boolean | null) => {
    if (isAccepted === true) return 'bg-green-50 text-green-700 border-green-200'
    if (isAccepted === false) return 'bg-red-50 text-red-700 border-red-200'
    return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" text="Loading schedule history..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Activities</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{stats?.total || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Completed</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{stats?.completed || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Upcoming</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">{stats?.scheduled || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600">Acceptance Rate</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {stats?.total > 0 
                  ? Math.round((stats.accepted / stats.total) * 100)
                  : 0}%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          All ({schedules.length})
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'upcoming'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Upcoming ({stats?.scheduled || 0})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'completed'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Completed ({stats?.completed || 0})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Pending Response ({stats?.pending || 0})
        </button>
      </div>

      {/* Schedule List */}
      <div className="space-y-4">
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No schedules found</h3>
            <p className="text-sm text-gray-500">
              {filter === 'all'
                ? "You don't have any scheduled activities yet"
                : filter === 'upcoming'
                ? "No upcoming activities scheduled"
                : filter === 'completed'
                ? "No completed activities yet"
                : "No pending responses"}
            </p>
          </div>
        ) : (
          filteredSchedules.map((schedule) => (
            <div
              key={schedule.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {schedule.title}
                      </h3>
                      {schedule.description && (
                        <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(schedule.status || 'SCHEDULED')}`}>
                        {schedule.status || 'SCHEDULED'}
                      </span>
                      {schedule.is_accepted !== null && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getAcceptanceColor(schedule.is_accepted)}`}>
                          {schedule.is_accepted ? '✓ Accepted' : '✗ Declined'}
                        </span>
                      )}
                      {schedule.is_accepted === null && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getAcceptanceColor(null)}`}>
                          ⏳ Pending
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center text-gray-700">
                      <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                      <span>{new Date(schedule.start_time).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}</span>
                    </div>

                    <div className="flex items-center text-gray-700">
                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                      <span>
                        {new Date(schedule.start_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} - {new Date(schedule.end_time).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {schedule.location && (
                      <div className="flex items-start text-gray-700">
                        <MapPin className="h-4 w-4 mr-2 text-gray-500 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{schedule.location}</span>
                      </div>
                    )}
                  </div>

                  {schedule.completed_at && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center text-sm text-green-700">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span>
                          Completed on {new Date(schedule.completed_at).toLocaleDateString()}
                        </span>
                        {schedule.attendance_marked && (
                          <span className="ml-2 text-green-600 font-medium">• Attendance marked</span>
                        )}
                      </div>
                    </div>
                  )}

                  {schedule.response_at && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center text-sm text-gray-600">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <span>
                          Response given on {new Date(schedule.response_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
