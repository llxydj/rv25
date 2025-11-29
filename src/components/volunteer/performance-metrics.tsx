"use client"

import React, { useEffect, useState } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Star, 
  Calendar,
  Activity,
  Award,
  Target
} from "lucide-react"

interface PerformanceMetricsProps {
  volunteerId: string
  compact?: boolean
}

interface Metrics {
  responseMetrics: {
    averageResponseTime: number
    fastestResponseTime: number
    totalResponseTime: number
  }
  resolutionMetrics: {
    totalResolved: number
    resolutionRate: number
    averageResolutionTime: number
  }
  activityMetrics: {
    totalHoursVolunteered: number
    activeDaysCount: number
    lastActivityDate: string | null
  }
  qualityMetrics: {
    averageFeedbackRating: number
    positiveFeedbackCount: number
    totalFeedbackCount: number
  }
}

export function PerformanceMetrics({ volunteerId, compact = false }: PerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/volunteers/${volunteerId}/metrics`)
        const result = await response.json()

        if (result.success) {
          setMetrics(result.data)
        } else {
          setError(result.message || "Failed to load performance metrics")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (volunteerId) {
      fetchMetrics()
    }
  }, [volunteerId])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">No metrics available</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-xs text-gray-600">Resolved</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metrics.resolutionMetrics.totalResolved}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-gray-600">Avg Response</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metrics.responseMetrics.averageResponseTime}m
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-purple-600" />
            <p className="text-xs text-gray-600">Hours</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {Math.round(metrics.activityMetrics.totalHoursVolunteered)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-4 w-4 text-yellow-600" />
            <p className="text-xs text-gray-600">Rating</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {metrics.qualityMetrics.averageFeedbackRating.toFixed(1)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Response Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Response Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Average Response Time</p>
            <p className="text-2xl font-bold text-blue-900">
              {metrics.responseMetrics.averageResponseTime} min
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700 mb-1">Fastest Response</p>
            <p className="text-2xl font-bold text-green-900">
              {metrics.responseMetrics.fastestResponseTime} min
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-700 mb-1">Total Response Time</p>
            <p className="text-2xl font-bold text-purple-900">
              {metrics.responseMetrics.totalResponseTime} min
            </p>
          </div>
        </div>
      </div>

      {/* Resolution Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="h-4 w-4" />
          Resolution Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700 mb-1">Total Resolved</p>
            <p className="text-2xl font-bold text-green-900">
              {metrics.resolutionMetrics.totalResolved}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Resolution Rate</p>
            <p className="text-2xl font-bold text-blue-900">
              {metrics.resolutionMetrics.resolutionRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-700 mb-1">Avg Resolution Time</p>
            <p className="text-2xl font-bold text-purple-900">
              {metrics.resolutionMetrics.averageResolutionTime} hrs
            </p>
          </div>
        </div>
      </div>

      {/* Activity Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-yellow-900">
              {Math.round(metrics.activityMetrics.totalHoursVolunteered)}
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-700 mb-1">Active Days</p>
            <p className="text-2xl font-bold text-orange-900">
              {metrics.activityMetrics.activeDaysCount}
            </p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-sm text-indigo-700 mb-1">Last Activity</p>
            <p className="text-lg font-bold text-indigo-900">
              {metrics.activityMetrics.lastActivityDate
                ? new Date(metrics.activityMetrics.lastActivityDate).toLocaleDateString()
                : "Never"}
            </p>
          </div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-4 w-4" />
          Quality Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-1">Average Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-yellow-900">
                {metrics.qualityMetrics.averageFeedbackRating.toFixed(1)}
              </p>
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700 mb-1">Positive Feedback</p>
            <p className="text-2xl font-bold text-green-900">
              {metrics.qualityMetrics.positiveFeedbackCount}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Total Feedback</p>
            <p className="text-2xl font-bold text-blue-900">
              {metrics.qualityMetrics.totalFeedbackCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

