"use client"

import { useEffect, useState } from "react"
import ResidentLayout from "@/components/layout/resident-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StarRating } from "@/components/ui/star-rating"
import { useAuth } from "@/hooks/use-auth"
import { CheckCircle, Calendar, Clock, MapPin, Users } from "lucide-react"

// Trainings feature is enabled by default
const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED !== 'false'

export default function TrainingEvaluationPage() {
  const { user } = useAuth()
  const [trainingId, setTrainingId] = useState("")
  const [trainings, setTrainings] = useState<any[]>([])
  const [rating, setRating] = useState(5)
  const [comments, setComments] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!FEATURE_ENABLED) return
    ;(async () => {
      try {
        const res = await fetch('/api/trainings')
        const json = await res.json()
        if (res.ok && json.success) setTrainings(json.data)
      } catch {}
    })()
  }, [])

  const submit = async () => {
    if (!user || !trainingId || !rating) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/training-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ training_id: trainingId, user_id: user.id, rating, comments }),
      })
      const json = await res.json()
      if (res.ok && json.success) setMessage('Submitted!')
      else setMessage(json.message || 'Failed to submit')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (!FEATURE_ENABLED) {
    return (
      <ResidentLayout>
        <div className="p-6"><p className="text-gray-600">Training evaluations are disabled.</p></div>
      </ResidentLayout>
    )
  }

  const selectedTraining = trainings.find(t => t.id === trainingId)

  return (
    <ResidentLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training Evaluation</h1>
          <p className="text-gray-600">Share your feedback to help us improve our training programs</p>
        </div>

        {/* Success Message */}
        {message && (
          <Card className={`p-4 ${
            message.includes('Submitted') || message.includes('Success')
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              {message.includes('Submitted') && <CheckCircle className="h-5 w-5 text-green-600" />}
              <p className={`text-sm font-medium ${
                message.includes('Submitted') ? 'text-green-800' : 'text-red-800'
              }`}>
                {message}
              </p>
            </div>
          </Card>
        )}

        {/* Main Form */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* Training Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select Training *
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={trainingId}
                onChange={(e) => setTrainingId(e.target.value)}
              >
                <option value="">Choose a training to evaluate...</option>
                {trainings.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} • {new Date(t.start_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select the training session you want to evaluate
              </p>
            </div>

            {/* Training Details Preview */}
            {selectedTraining && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3">{selectedTraining.title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {selectedTraining.start_at && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span>{new Date(selectedTraining.start_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedTraining.start_at && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>{new Date(selectedTraining.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                  {selectedTraining.location && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <span>{selectedTraining.location}</span>
                    </div>
                  )}
                  {selectedTraining.instructor && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>Instructor: {selectedTraining.instructor}</span>
                    </div>
                  )}
                </div>
                {selectedTraining.description && (
                  <p className="mt-3 text-sm text-gray-600 border-t border-blue-200 pt-3">
                    {selectedTraining.description}
                  </p>
                )}
              </Card>
            )}

            {/* Star Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Overall Rating *
              </label>
              <StarRating
                rating={rating}
                onRatingChange={setRating}
                size="lg"
                showLabel={true}
              />
              <p className="mt-2 text-xs text-gray-500">
                Rate your experience from 1 (Poor) to 5 (Excellent)
              </p>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Comments & Feedback
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="Share your thoughts about the training... What did you like? What could be improved?"
                rows={5}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Help us improve by sharing specific feedback
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={submit}
                disabled={submitting || !trainingId || rating === 0}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Evaluation'
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Help Text */}
        <Card className="p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Why Your Feedback Matters</h4>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
            <li>Help us improve training quality and content</li>
            <li>Guide future training program development</li>
            <li>Ensure trainings meet volunteer needs</li>
            <li>Recognize excellent instructors and facilitators</li>
          </ul>
        </Card>
      </div>
    </ResidentLayout>
  )
}


