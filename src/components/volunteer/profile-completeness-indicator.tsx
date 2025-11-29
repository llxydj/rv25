"use client"

import React from "react"
import { UserWithVolunteerProfile } from "@/types/volunteer"
import { calculateProfileCompleteness, getCompletenessColor, getProgressBarColor } from "@/lib/profile-completeness"
import { CheckCircle, AlertCircle, Info } from "lucide-react"

interface ProfileCompletenessIndicatorProps {
  profile: UserWithVolunteerProfile | null
  showDetails?: boolean
  compact?: boolean
}

export function ProfileCompletenessIndicator({
  profile,
  showDetails = false,
  compact = false
}: ProfileCompletenessIndicatorProps) {
  const completeness = calculateProfileCompleteness(profile)
  const colorClass = getCompletenessColor(completeness.score)
  const progressColor = getProgressBarColor(completeness.score)

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass}`}>
        <div className="flex items-center gap-2">
          {completeness.score >= 80 ? (
            <CheckCircle className="h-4 w-4" />
          ) : completeness.score >= 50 ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <span className="text-sm font-semibold">{completeness.score}%</span>
        </div>
        <div className="h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-300`}
            style={{ width: `${completeness.score}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border p-4 ${showDetails ? 'border-gray-200' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Profile Completeness</h3>
          {completeness.score >= 80 ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : completeness.score >= 50 ? (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          ) : (
            <Info className="h-4 w-4 text-red-600" />
          )}
        </div>
        <span className={`text-lg font-bold ${colorClass.split(' ')[0]}`}>
          {completeness.score}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-300`}
            style={{ width: `${completeness.score}%` }}
          />
        </div>
      </div>

      {showDetails && (
        <div className="space-y-3 text-sm">
          {/* Critical Fields */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-700">Critical (Required)</span>
              <span className="text-gray-600">
                {completeness.critical.completed}/{completeness.critical.total}
              </span>
            </div>
            {completeness.critical.missing.length > 0 && (
              <p className="text-xs text-red-600 mt-1">
                Missing: {completeness.critical.missing.join(", ")}
              </p>
            )}
          </div>

          {/* Important Fields */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-700">Important (Recommended)</span>
              <span className="text-gray-600">
                {completeness.important.completed}/{completeness.important.total}
              </span>
            </div>
            {completeness.important.missing.length > 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                Missing: {completeness.important.missing.join(", ")}
              </p>
            )}
          </div>

          {/* Optional Fields */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-700">Optional</span>
              <span className="text-gray-600">
                {completeness.optional.completed}/{completeness.optional.total}
              </span>
            </div>
            {completeness.optional.missing.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Missing: {completeness.optional.missing.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

