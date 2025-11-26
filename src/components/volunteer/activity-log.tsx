"use client"

import React, { useState, useEffect } from "react"
import { 
  Activity, 
  CheckCircle, 
  Upload, 
  Camera, 
  Award, 
  Bell, 
  FileText,
  Clock,
  User
} from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { VolunteerActivityLog, ActivityType } from "@/types/volunteer"

interface ActivityLogProps {
  volunteerId: string
  limit?: number
  showFilters?: boolean
}

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case 'profile_updated':
      return <User className="w-5 h-5" />
    case 'availability_changed':
      return <Clock className="w-5 h-5" />
    case 'incident_assigned':
      return <Bell className="w-5 h-5" />
    case 'incident_resolved':
      return <CheckCircle className="w-5 h-5" />
    case 'document_uploaded':
      return <FileText className="w-5 h-5" />
    case 'photo_uploaded':
      return <Camera className="w-5 h-5" />
    case 'skills_updated':
      return <Award className="w-5 h-5" />
    case 'status_changed':
      return <Activity className="w-5 h-5" />
    case 'training_completed':
      return <Award className="w-5 h-5" />
    default:
      return <Activity className="w-5 h-5" />
  }
}

const getActivityColor = (type: ActivityType) => {
  switch (type) {
    case 'incident_resolved':
      return 'text-green-600 bg-green-50'
    case 'incident_assigned':
      return 'text-blue-600 bg-blue-50'
    case 'availability_changed':
      return 'text-purple-600 bg-purple-50'
    case 'status_changed':
      return 'text-orange-600 bg-orange-50'
    case 'document_uploaded':
    case 'photo_uploaded':
      return 'text-cyan-600 bg-cyan-50'
    case 'skills_updated':
    case 'training_completed':
      return 'text-indigo-600 bg-indigo-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ 
  volunteerId, 
  limit = 50,
  showFilters = false 
}) => {
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<VolunteerActivityLog[]>([])
  const [filter, setFilter] = useState<ActivityType | 'all'>('all')

  useEffect(() => {
    fetchActivities()
  }, [volunteerId, filter])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        volunteer_id: volunteerId,
        limit: limit.toString(),
      })

      if (filter !== 'all') {
        params.append('activity_type', filter)
      }

      const response = await fetch(`/api/volunteer-activity-logs?${params}`)
      const result = await response.json()

      if (result.success) {
        setActivities(result.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMins = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMins < 1) return 'Just now'
    if (diffInMins < 60) return `${diffInMins}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" text="Loading activity log..." />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
          <p className="text-sm text-gray-500">Track your volunteer activities and updates</p>
        </div>
        {showFilters && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ActivityType | 'all')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Activities</option>
            <option value="profile_updated">Profile Updates</option>
            <option value="availability_changed">Availability</option>
            <option value="incident_assigned">Incidents</option>
            <option value="document_uploaded">Documents</option>
            <option value="skills_updated">Skills</option>
          </select>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Activity className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No activities recorded yet</p>
          <p className="text-xs text-gray-400 mt-1">Your volunteer activities will appear here</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
          
          {/* Activity items */}
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id} className="relative flex items-start space-x-4">
                {/* Icon */}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full ${getActivityColor(activity.activity_type)}`}>
                  {getActivityIcon(activity.activity_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                      {activity.description && (
                        <p className="mt-1 text-sm text-gray-600">{activity.description}</p>
                      )}
                      {activity.created_by_user && (
                        <p className="mt-1 text-xs text-gray-500">
                          by {activity.created_by_user.first_name} {activity.created_by_user.last_name}
                        </p>
                      )}
                    </div>
                    <span className="ml-2 flex-shrink-0 text-xs text-gray-500 whitespace-nowrap">
                      {formatTimeAgo(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
