"use client"

import React from "react"
import { UserWithVolunteerProfile } from "@/types/volunteer"
import { calculateProfileCompleteness } from "@/lib/profile-completeness"
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react"

interface MissingFieldsListProps {
  profile: UserWithVolunteerProfile | null
  onCompleteProfile?: () => void
}

export function MissingFieldsList({ profile, onCompleteProfile }: MissingFieldsListProps) {
  const completeness = calculateProfileCompleteness(profile)

  if (completeness.allMissing.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">Your profile is complete!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <h3 className="text-sm font-semibold text-gray-900">Complete Your Profile</h3>
        </div>
        {onCompleteProfile && (
          <button
            onClick={onCompleteProfile}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
          >
            Complete Now
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Critical Missing Fields */}
        {completeness.critical.missing.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-semibold text-red-700 uppercase">Critical (Required)</span>
            </div>
            <ul className="ml-6 space-y-1">
              {completeness.critical.missing.map((field) => (
                <li key={field} className="text-xs text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                  {field}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Important Missing Fields */}
        {completeness.important.missing.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700 uppercase">Important (Recommended)</span>
            </div>
            <ul className="ml-6 space-y-1">
              {completeness.important.missing.map((field) => (
                <li key={field} className="text-xs text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-600"></span>
                  {field}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Optional Missing Fields */}
        {completeness.optional.missing.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase">Optional</span>
            </div>
            <ul className="ml-6 space-y-1">
              {completeness.optional.missing.map((field) => (
                <li key={field} className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  {field}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

