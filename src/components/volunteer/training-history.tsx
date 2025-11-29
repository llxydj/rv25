"use client"

import React, { useEffect, useState } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Calendar, MapPin, CheckCircle, XCircle, Clock, Star } from "lucide-react"
import { format } from "date-fns"

interface TrainingHistoryProps {
  volunteerId: string
  compact?: boolean
}

interface Training {
  enrollmentId: string
  enrolledAt: string
  attended: boolean
  training: {
    id: number
    title: string
    description?: string
    startAt: string
    endAt?: string
    location?: string
    status: string
  }
  userEvaluation?: {
    rating: number
    comments?: string
    createdAt: string
  }
  adminEvaluation?: {
    performanceRating: number
    skillsAssessment?: any
    comments?: string
    evaluatedBy: string
    createdAt: string
  }
}

export function TrainingHistory({ volunteerId, compact = false }: TrainingHistoryProps) {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/volunteers/${volunteerId}/trainings`)
        const result = await response.json()

        if (result.success) {
          setTrainings(result.data || [])
        } else {
          setError(result.message || "Failed to load training history")
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (volunteerId) {
      fetchTrainings()
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

  if (trainings.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">No training history found</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {trainings.slice(0, 5).map((training) => (
          <div
            key={training.enrollmentId}
            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {training.training.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {format(new Date(training.training.startAt), "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {training.attended ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {trainings.map((training) => (
        <div
          key={training.enrollmentId}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="text-base font-semibold text-gray-900">
                {training.training.title}
              </h4>
              {training.training.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {training.training.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              {training.attended ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Attended
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Attended
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(training.training.startAt), "MMM d, yyyy")}
                {training.training.endAt &&
                  ` - ${format(new Date(training.training.endAt), "MMM d, yyyy")}`}
              </span>
            </div>
            {training.training.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{training.training.location}</span>
              </div>
            )}
          </div>

          {(training.userEvaluation || training.adminEvaluation) && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              {training.userEvaluation && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs font-medium text-gray-700">Your Rating:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {training.userEvaluation.rating}/5
                    </span>
                  </div>
                  {training.userEvaluation.comments && (
                    <p className="text-xs text-gray-600 ml-6">
                      {training.userEvaluation.comments}
                    </p>
                  )}
                </div>
              )}
              {training.adminEvaluation && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-gray-700">Performance Rating:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {training.adminEvaluation.performanceRating}/5
                    </span>
                  </div>
                  {training.adminEvaluation.comments && (
                    <p className="text-xs text-gray-600 ml-6">
                      {training.adminEvaluation.comments}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

