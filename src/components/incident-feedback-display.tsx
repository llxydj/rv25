"use client"

import { useState, useEffect } from "react"
import { Star, MessageSquare, User, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"

interface FeedbackData {
  id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
  users?: {
    first_name: string
    last_name: string
    role: string
  }
}

interface IncidentFeedbackDisplayProps {
  incidentId: string
  showTitle?: boolean
}

export function IncidentFeedbackDisplay({ incidentId, showTitle = true }: IncidentFeedbackDisplayProps) {
  const [feedback, setFeedback] = useState<FeedbackData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!incidentId) return

      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/feedback?incident_id=${incidentId}`)
        const result = await response.json()

        if (result.success) {
          setFeedback(result.data || [])
        } else {
          setError(result.message || 'Failed to load feedback')
        }
      } catch (err: any) {
        console.error('Error fetching feedback:', err)
        setError('Failed to load feedback')
      } finally {
        setLoading(false)
      }
    }

    fetchFeedback()
  }, [incidentId])

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1: return "Poor"
      case 2: return "Fair"
      case 3: return "Good"
      case 4: return "Very Good"
      case 5: return "Excellent"
      default: return ""
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Resident Feedback
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Resident Feedback
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-sm text-red-600">{error}</div>
        </CardContent>
      </Card>
    )
  }

  if (feedback.length === 0) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Resident Feedback
            </CardTitle>
            <CardDescription>Feedback from residents about this incident</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No feedback submitted yet</p>
            <p className="text-xs text-gray-400 mt-1">Resident can submit feedback after incident is resolved</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate average rating
  const averageRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Resident Feedback
          </CardTitle>
          <CardDescription>
            {feedback.length} feedback{feedback.length !== 1 ? 's' : ''} • Average: {averageRating.toFixed(1)}/5.0
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* Average Rating Summary */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(averageRating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Based on {feedback.length} rating{feedback.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Feedback List */}
        <div className="space-y-4">
          {feedback.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= item.rating
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.rating}/5 - {getRatingLabel(item.rating)}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(item.created_at)}
                </div>
              </div>

              {/* User Info */}
              {item.users && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span>
                    {item.users.first_name} {item.users.last_name}
                    {item.users.role && (
                      <span className="text-gray-400 ml-1">({item.users.role})</span>
                    )}
                  </span>
                </div>
              )}

              {/* Comment */}
              {item.comment && (
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                  <p className="whitespace-pre-wrap">{item.comment}</p>
                </div>
              )}

              {/* Updated indicator */}
              {item.updated_at !== item.created_at && (
                <div className="text-xs text-gray-400 italic">
                  Updated {formatDate(item.updated_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

