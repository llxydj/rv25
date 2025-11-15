"use client"

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Card, LoadingSpinner, ErrorState, SuccessState } from '@/components/ui/enhanced-components'

interface FeedbackFormProps {
  incidentId: string
  incidentTitle?: string
  onSubmit?: (feedback: any) => void
  onCancel?: () => void
}

interface FeedbackData {
  rating: number
  comment?: string
  incident_id: string
  user_id: string
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  incidentId,
  incidentTitle,
  onSubmit,
  onCancel
}) => {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0) {
      setError('Please select a rating')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      const feedbackData: FeedbackData = {
        rating,
        comment: comment.trim() || null,
        incident_id: incidentId,
        user_id: user.id
      }

      // Check if feedback already exists for this incident and user
      const { data: existingFeedback } = await supabase
        .from('incident_feedback')
        .select('id')
        .eq('incident_id', incidentId)
        .eq('user_id', user.id)
        .single()

      let result
      if (existingFeedback) {
        // Update existing feedback
        result = await supabase
          .from('incident_feedback')
          .update({
            rating,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFeedback.id)
          .select()
          .single()
      } else {
        // Create new feedback
        result = await supabase
          .from('incident_feedback')
          .insert({
            ...feedbackData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()
      }

      if (result.error) throw result.error

      setSuccess('Feedback submitted successfully!')
      
      // Call onSubmit callback if provided
      if (onSubmit) {
        onSubmit(result.data)
      }

      // Reset form
      setRating(0)
      setComment('')

    } catch (err: any) {
      console.error('Error submitting feedback:', err)
      setError(err.message || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const StarRating: React.FC<{ rating: number; onRatingChange: (rating: number) => void }> = ({
    rating,
    onRatingChange
  }) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className={`text-2xl transition-colors duration-200 ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            } hover:text-yellow-400`}
          >
            ★
          </button>
        ))}
      </div>
    )
  }

  return (
    <Card variant="elevated" padding="lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Provide Feedback
        {incidentTitle && (
          <span className="block text-sm font-normal text-gray-600 mt-1">
            for: {incidentTitle}
          </span>
        )}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center space-x-4">
            <StarRating rating={rating} onRatingChange={setRating} />
            <span className="text-sm text-gray-600">
              {rating === 0 ? 'Select a rating' : 
               rating === 1 ? 'Poor' :
               rating === 2 ? 'Fair' :
               rating === 3 ? 'Good' :
               rating === 4 ? 'Very Good' : 'Excellent'}
            </span>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comment (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience or suggestions..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            {comment.length}/500 characters
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}
          
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={submitting || rating === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

// Feedback Display Component
interface FeedbackDisplayProps {
  incidentId: string
  showForm?: boolean
}

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  incidentId,
  showForm = false
}) => {
  const [feedback, setFeedback] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFeedbackForm, setShowFeedbackForm] = useState(showForm)

  React.useEffect(() => {
    loadFeedback()
  }, [incidentId])

  const loadFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from('incident_feedback')
        .select(`
          id,
          rating,
          comment,
          created_at,
          updated_at,
          users!incident_feedback_user_id_fkey (
            first_name,
            last_name,
            role
          )
        `)
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFeedback(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  const handleFeedbackSubmit = (newFeedback: any) => {
    setFeedback(prev => [newFeedback, ...prev])
    setShowFeedbackForm(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner size="md" text="Loading feedback..." />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load feedback"
        message={error}
        onRetry={loadFeedback}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Feedback Form Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Feedback ({feedback.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFeedbackForm(!showFeedbackForm)}
        >
          {showFeedbackForm ? 'Hide Form' : 'Add Feedback'}
        </Button>
      </div>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <FeedbackForm
          incidentId={incidentId}
          onSubmit={handleFeedbackSubmit}
          onCancel={() => setShowFeedbackForm(false)}
        />
      )}

      {/* Feedback List */}
      {feedback.length === 0 ? (
        <Card variant="outlined" padding="md">
          <div className="text-center py-8">
            <p className="text-gray-500">No feedback submitted yet.</p>
            {!showFeedbackForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFeedbackForm(true)}
                className="mt-2"
              >
                Be the first to provide feedback
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <Card key={item.id} variant="outlined" padding="md">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${
                            star <= item.rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">
                      {item.users?.first_name} {item.users?.last_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({item.users?.role})
                    </span>
                  </div>
                  
                  {item.comment && (
                    <p className="text-sm text-gray-700 mb-2">{item.comment}</p>
                  )}
                  
                  <p className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()} at{' '}
                    {new Date(item.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
