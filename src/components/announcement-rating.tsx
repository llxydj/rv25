"use client"

import { useState, useEffect } from "react"
import { Star, MessageSquare, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface FeedbackStats {
  total: number
  average_rating: number
  rating_distribution: Array<{ star: number; count: number }>
}

interface UserFeedback {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

interface AnnouncementRatingProps {
  announcementId: string
  onFeedbackUpdate?: () => void
}

export function AnnouncementRating({ announcementId, onFeedbackUpdate }: AnnouncementRatingProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState("")
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [userFeedback, setUserFeedback] = useState<UserFeedback | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchFeedback = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/announcements/feedback?announcement_id=${announcementId}`)
      const json = await res.json()
      if (json.success) {
        setStats(json.data.statistics)
        setUserFeedback(json.data.user_feedback)
        if (json.data.user_feedback) {
          setRating(json.data.user_feedback.rating)
          setComment(json.data.user_feedback.comment || "")
        }
      }
    } catch (e) {
      console.error('Failed to fetch feedback:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
  }, [announcementId])

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please select a rating')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/announcements/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement_id: announcementId,
          rating,
          comment: showCommentForm ? comment : null
        })
      })
      const json = await res.json()
      if (json.success) {
        await fetchFeedback()
        setShowCommentForm(false)
        if (onFeedbackUpdate) onFeedbackUpdate()
      } else {
        alert(json.message || 'Failed to submit feedback')
      }
    } catch (e) {
      console.error('Failed to submit feedback:', e)
      alert('Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove your feedback?')) return

    try {
      setSubmitting(true)
      const res = await fetch(`/api/announcements/feedback?announcement_id=${announcementId}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      if (json.success) {
        setRating(0)
        setComment("")
        setUserFeedback(null)
        await fetchFeedback()
        if (onFeedbackUpdate) onFeedbackUpdate()
      }
    } catch (e) {
      console.error('Failed to remove feedback:', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-4 text-center text-gray-500">
        Loading feedback...
      </div>
    )
  }

  return (
    <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      {/* Statistics */}
      {stats && stats.total > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{stats.average_rating.toFixed(1)}</span>
            <span className="text-gray-500">({stats.total} {stats.total === 1 ? 'rating' : 'ratings'})</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => {
              const count = stats.rating_distribution.find(r => r.star === star)?.count || 0
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-1" title={`${count} ${star}-star ${count === 1 ? 'rating' : 'ratings'}`}>
                  <span className="text-xs text-gray-500">{star}</span>
                  <Star className="h-3 w-3 text-gray-300" />
                  <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rating Input */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {userFeedback ? 'Update your rating:' : 'Rate this announcement:'}
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  setRating(star)
                  if (!showCommentForm && !userFeedback) {
                    setShowCommentForm(true)
                  }
                }}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="focus:outline-none transition-transform hover:scale-110"
                disabled={submitting}
              >
                <Star
                  className={`h-6 w-6 ${
                    star <= (hoveredRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {userFeedback && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={submitting}
                className="ml-2 text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* Comment Form */}
        {(showCommentForm || userFeedback) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {userFeedback ? 'Update your comment (optional):' : 'Add a comment (optional):'}
              </label>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about this announcement..."
              rows={3}
              disabled={submitting}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4 mr-1" />
                {userFeedback ? 'Update' : 'Submit'} Feedback
              </Button>
              {!userFeedback && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCommentForm(false)
                    setComment("")
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* User's Current Feedback Display */}
        {userFeedback && !showCommentForm && (
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Rating:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= userFeedback.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {userFeedback.comment && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{userFeedback.comment}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCommentForm(true)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

