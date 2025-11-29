"use client"

import React, { useEffect, useState } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle, 
  Users, 
  Award,
  Target,
  Lightbulb,
  BarChart3,
  UserCheck,
  UserX
} from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface VolunteerInsights {
  totalVolunteers: number
  profileCompleteness: {
    average: number
    distribution: {
      low: number
      medium: number
      high: number
    }
  }
  performance: {
    averageResolutionRate: number
    totalResolved: number
    totalIncidents: number
  }
  volunteersWithBio: number
  volunteersWithCompleteProfiles: number
}

interface ActionableInsight {
  type: 'success' | 'warning' | 'info' | 'action'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  action?: string
  metric?: string
}

export function VolunteerInsightsCard() {
  const [insights, setInsights] = useState<VolunteerInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/admin/analytics/volunteers/enhanced?section=overview')
        const result = await response.json()

        if (result.success) {
          setInsights(result.data)
        } else {
          setError(result.message || 'Failed to load insights')
        }
      } catch (err: any) {
        console.error('Error fetching insights:', err)
        setError(err.message || 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [])

  // Generate actionable insights from data
  const generateInsights = (data: VolunteerInsights): ActionableInsight[] => {
    const insightsList: ActionableInsight[] = []

    // Profile Completeness Insights
    if (data.profileCompleteness.average < 50) {
      insightsList.push({
        type: 'warning',
        priority: 'high',
        title: 'Low Profile Completeness',
        description: `${Math.round((data.profileCompleteness.distribution.low / data.totalVolunteers) * 100)}% of volunteers have incomplete profiles (<50%)`,
        action: 'Encourage profile completion through notifications',
        metric: `Average: ${data.profileCompleteness.average.toFixed(1)}%`
      })
    } else if (data.profileCompleteness.average >= 80) {
      insightsList.push({
        type: 'success',
        priority: 'low',
        title: 'Excellent Profile Quality',
        description: `${data.volunteersWithCompleteProfiles} volunteers have complete profiles (80%+)`,
        action: 'Consider recognizing top volunteers',
        metric: `Average: ${data.profileCompleteness.average.toFixed(1)}%`
      })
    }

    // Performance Insights
    if (data.performance.averageResolutionRate > 85) {
      insightsList.push({
        type: 'success',
        priority: 'medium',
        title: 'High Resolution Rate',
        description: `Volunteers are resolving ${data.performance.averageResolutionRate.toFixed(1)}% of assigned incidents`,
        action: 'Consider promoting top performers',
        metric: `${data.performance.totalResolved} resolved out of ${data.performance.totalIncidents}`
      })
    } else if (data.performance.averageResolutionRate < 60) {
      insightsList.push({
        type: 'warning',
        priority: 'high',
        title: 'Low Resolution Rate',
        description: `Only ${data.performance.averageResolutionRate.toFixed(1)}% of incidents are being resolved`,
        action: 'Review training needs and support resources',
        metric: `${data.performance.totalResolved} resolved out of ${data.performance.totalIncidents}`
      })
    }

    // Bio Field Insights
    const bioPercentage = (data.volunteersWithBio / data.totalVolunteers) * 100
    if (bioPercentage < 30) {
      insightsList.push({
        type: 'info',
        priority: 'medium',
        title: 'Low Bio Completion',
        description: `Only ${data.volunteersWithBio} volunteers (${bioPercentage.toFixed(0)}%) have added their bio`,
        action: 'Send reminder to complete profile bios',
        metric: `${data.volunteersWithBio}/${data.totalVolunteers} volunteers`
      })
    }

    // Profile Distribution Insights
    if (data.profileCompleteness.distribution.high < data.totalVolunteers * 0.5) {
      insightsList.push({
        type: 'action',
        priority: 'medium',
        title: 'Profile Improvement Opportunity',
        description: `${data.profileCompleteness.distribution.medium} volunteers are at medium completeness (50-80%)`,
        action: 'Targeted outreach to improve to 80%+',
        metric: `${data.profileCompleteness.distribution.high} already at high completeness`
      })
    }

    return insightsList.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center py-4">
          <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Enhanced analytics unavailable. Regular analytics still working.
          </p>
        </div>
      </div>
    )
  }

  if (!insights) {
    return null
  }

  const actionableInsights = generateInsights(insights)

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'action':
        return <Target className="h-5 w-5 text-blue-600" />
      default:
        return <Lightbulb className="h-5 w-5 text-blue-600" />
    }
  }

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'action':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Volunteer Insights & Recommendations
          </h3>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Enhanced Analytics
        </span>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Volunteers</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {insights.totalVolunteers}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Avg. Completeness</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {insights.profileCompleteness.average.toFixed(1)}%
          </p>
          <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                insights.profileCompleteness.average >= 80
                  ? 'bg-green-500'
                  : insights.profileCompleteness.average >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${insights.profileCompleteness.average}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Resolution Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {insights.performance.averageResolutionRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {insights.performance.totalResolved} resolved
          </p>
        </div>
      </div>

      {/* Completeness Distribution */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Profile Completeness Distribution
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <UserX className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {insights.profileCompleteness.distribution.low}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Low (&lt;50%)</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
              {insights.profileCompleteness.distribution.medium}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Medium (50-80%)</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {insights.profileCompleteness.distribution.high}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">High (80%+)</p>
          </div>
        </div>
      </div>

      {/* Actionable Insights */}
      {actionableInsights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-600" />
            Actionable Insights
          </h4>
          <div className="space-y-3">
            {actionableInsights.map((insight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getInsightBgColor(insight.type)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {insight.title}
                      </h5>
                      {insight.priority === 'high' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                          High Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {insight.description}
                    </p>
                    {insight.action && (
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                        💡 {insight.action}
                      </p>
                    )}
                    {insight.metric && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        📊 {insight.metric}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">With Bio</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {insights.volunteersWithBio}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {((insights.volunteersWithBio / insights.totalVolunteers) * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Complete Profiles</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {insights.volunteersWithCompleteProfiles}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {((insights.volunteersWithCompleteProfiles / insights.totalVolunteers) * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

