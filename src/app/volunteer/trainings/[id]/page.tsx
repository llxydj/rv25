"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Users, Clock, ArrowLeft, CheckCircle, X, AlertCircle, Star } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { StarRating } from "@/components/ui/star-rating"
import { LocationLinkDisplay } from "@/components/ui/location-link-display"
import { useAuth } from "@/lib/auth"

export default function VolunteerTrainingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const trainingId = params.id as string

  const [training, setTraining] = useState<any>(null)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingEvaluation, setExistingEvaluation] = useState<any>(null)
  const [evaluationRating, setEvaluationRating] = useState(5)
  const [evaluationComments, setEvaluationComments] = useState("")
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!trainingId || !user) return

      setLoading(true)
      try {
        // Fetch training
        const trainingRes = await fetch(`/api/trainings/${trainingId}`)
        const trainingJson = await trainingRes.json()
        if (trainingRes.ok && trainingJson.success) {
          setTraining(trainingJson.data)
        } else {
          throw new Error(trainingJson.message || "Failed to load training")
        }

        // Check enrollment
        if (user.id) {
          const enrollRes = await fetch(`/api/trainings/enrollments?user_id=${user.id}&training_id=${trainingId}`)
          const enrollJson = await enrollRes.json()
          if (enrollRes.ok && enrollJson.success) {
            setIsEnrolled((enrollJson.data || []).length > 0)
          }

          // Check if evaluation already exists
          const evalRes = await fetch(`/api/training-evaluations?training_id=${trainingId}`)
          const evalJson = await evalRes.json()
          if (evalRes.ok && evalJson.success && evalJson.data) {
            const userEval = evalJson.data.find((e: any) => e.user_id === user.id)
            if (userEval) {
              setExistingEvaluation(userEval)
            }
          }
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load training details")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [trainingId, user])

  const handleEnroll = async () => {
    setEnrolling(true)
    try {
      const res = await fetch("/api/trainings/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ training_id: parseInt(trainingId) }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to enroll")

      setIsEnrolled(true)
    } catch (e: any) {
      alert("Failed to enroll: " + (e?.message || "Unknown error"))
    } finally {
      setEnrolling(false)
    }
  }

  const handleUnenroll = async () => {
    if (!confirm("Are you sure you want to unenroll from this training?")) return

    setEnrolling(true)
    try {
      const res = await fetch(`/api/trainings/enroll?training_id=${trainingId}`, {
        method: "DELETE",
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to unenroll")

      setIsEnrolled(false)
    } catch (e: any) {
      alert("Failed to unenroll: " + (e?.message || "Unknown error"))
    } finally {
      setEnrolling(false)
    }
  }

  const handleSubmitEvaluation = async () => {
    if (!user || !trainingId || evaluationRating === 0) return

    setSubmittingEvaluation(true)
    try {
      const res = await fetch("/api/training-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_id: parseInt(trainingId),
          user_id: user.id,
          rating: evaluationRating,
          comments: evaluationComments.trim() || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to submit evaluation")

      setExistingEvaluation(json.data)
      setEvaluationComments("")
    } catch (e: any) {
      alert("Failed to submit evaluation: " + (e?.message || "Unknown error"))
    } finally {
      setSubmittingEvaluation(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      SCHEDULED: { variant: "default", label: "Scheduled" },
      ONGOING: { variant: "secondary", label: "Ongoing" },
      COMPLETED: { variant: "outline", label: "Completed" },
      CANCELLED: { variant: "destructive", label: "Cancelled" }
    }
    return variants[status] || { variant: "outline" as const, label: status }
  }

  if (loading) {
    return (
      <VolunteerLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading training details..." />
        </div>
      </VolunteerLayout>
    )
  }

  if (error || !training) {
    return (
      <VolunteerLayout>
        <div className="p-6">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700">{error || "Training not found"}</p>
            <Button onClick={() => router.push('/volunteer/trainings')} className="mt-4" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Trainings
            </Button>
          </div>
        </div>
      </VolunteerLayout>
    )
  }

  const startDate = new Date(training.start_at)
  const endDate = training.end_at ? new Date(training.end_at) : null
  const badge = getStatusBadge(training.status || 'SCHEDULED')
  const canEnroll = training.status === 'SCHEDULED' && !isEnrolled

  return (
    <VolunteerLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/volunteer/trainings')} variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-black">{training.title}</h1>
              <p className="text-sm text-gray-600 mt-1">Training Details</p>
            </div>
          </div>
          <Badge variant={badge.variant} className="text-lg px-4 py-2">
            {badge.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Training Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Training Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {training.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{training.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Start Date & Time</p>
                      <p className="text-sm text-gray-600">
                        {startDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {startDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  </div>

                  {endDate && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">End Date & Time</p>
                        <p className="text-sm text-gray-600">
                          {endDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-gray-600">
                          {endDate.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {training.location && (
                    <div className="md:col-span-2">
                      <LocationLinkDisplay
                        location={training.location}
                        className="w-full"
                      />
                    </div>
                  )}

                  {training.capacity && (
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Capacity</p>
                        <p className="text-sm text-gray-600">{training.capacity} participants</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Enrollment Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Enrollment</CardTitle>
              </CardHeader>
              <CardContent>
                {isEnrolled ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">You are enrolled</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleUnenroll}
                      disabled={enrolling}
                    >
                      {enrolling ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      Unenroll
                    </Button>
                  </div>
                ) : canEnroll ? (
                  <Button
                    className="w-full"
                    onClick={handleEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Enroll in Training
                  </Button>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">
                      {training.status === 'COMPLETED' 
                        ? 'This training has been completed'
                        : training.status === 'CANCELLED'
                        ? 'This training has been cancelled'
                        : 'Enrollment not available'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Training Evaluation */}
            {training.status === 'COMPLETED' && isEnrolled && (
              <Card>
                <CardHeader>
                  <CardTitle>Training Evaluation</CardTitle>
                </CardHeader>
                <CardContent>
                  {existingEvaluation ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Evaluation Submitted</span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <StarRating rating={existingEvaluation.rating} readonly size="sm" showLabel={false} />
                          <span className="text-sm text-gray-600">{existingEvaluation.rating}/5</span>
                        </div>
                        {existingEvaluation.comments && (
                          <p className="text-sm text-gray-700 mt-2">{existingEvaluation.comments}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Submitted on {new Date(existingEvaluation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Rating *
                        </label>
                        <StarRating
                          rating={evaluationRating}
                          onRatingChange={setEvaluationRating}
                          size="md"
                          showLabel={true}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Comments
                        </label>
                        <textarea
                          className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 uppercase"
                          rows={3}
                          placeholder="SHARE YOUR FEEDBACK..."
                          value={evaluationComments}
                          onChange={(e) => setEvaluationComments(e.target.value.toUpperCase())}
                        />
                      </div>
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleSubmitEvaluation}
                        disabled={submittingEvaluation || evaluationRating === 0}
                      >
                        {submittingEvaluation ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : (
                          <Star className="h-4 w-4 mr-2" />
                        )}
                        {submittingEvaluation ? "Submitting..." : "Submit Evaluation"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/volunteer/trainings')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Trainings
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </VolunteerLayout>
  )
}

