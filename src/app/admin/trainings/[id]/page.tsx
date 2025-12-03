"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, MapPin, Users, Clock, ArrowLeft, Star, MessageSquare, User, CheckCircle, AlertCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { LocationLinkDisplay } from "@/components/ui/location-link-display"
import Link from "next/link"

export default function AdminTrainingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const trainingId = params.id as string

  const [training, setTraining] = useState<any>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evaluatingUserId, setEvaluatingUserId] = useState<string | null>(null)
  const [evaluationForm, setEvaluationForm] = useState({
    performance_rating: 5,
    comments: "",
    skills_assessment: {} as Record<string, number>
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!trainingId) return

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

        // Fetch enrollments
        const enrollRes = await fetch(`/api/trainings/enrollments?training_id=${trainingId}`)
        const enrollJson = await enrollRes.json()
        if (enrollRes.ok && enrollJson.success) {
          setEnrollments(enrollJson.data || [])
        }

        // Fetch evaluations
        const evalRes = await fetch(`/api/trainings/evaluations/admin?training_id=${trainingId}`)
        const evalJson = await evalRes.json()
        if (evalRes.ok && evalJson.success) {
          setEvaluations(evalJson.data || [])
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load training details")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [trainingId])

  const handleEvaluate = async (userId: string) => {
    if (!training || training.status !== 'COMPLETED') {
      alert('Can only evaluate volunteers for completed trainings')
      return
    }

    setEvaluatingUserId(userId)
  }

  const submitEvaluation = async () => {
    if (!evaluatingUserId || !training) return

    try {
      const res = await fetch('/api/trainings/evaluations/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          training_id: parseInt(trainingId),
          user_id: evaluatingUserId,
          performance_rating: evaluationForm.performance_rating,
          skills_assessment: evaluationForm.skills_assessment,
          comments: evaluationForm.comments
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to save evaluation')

      // Refresh evaluations
      const evalRes = await fetch(`/api/trainings/evaluations/admin?training_id=${trainingId}`)
      const evalJson = await evalRes.json()
      if (evalRes.ok && evalJson.success) {
        setEvaluations(evalJson.data || [])
      }

      // Reset form
      setEvaluatingUserId(null)
      setEvaluationForm({
        performance_rating: 5,
        comments: "",
        skills_assessment: {}
      })
    } catch (e: any) {
      alert('Failed to save evaluation: ' + (e?.message || 'Unknown error'))
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

  const getEvaluationForUser = (userId: string) => {
    return evaluations.find(e => e.user_id === userId)
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading training details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error || !training) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700">{error || "Training not found"}</p>
            <Button onClick={() => router.push('/admin/trainings')} className="mt-4" variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Trainings
            </Button>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const startDate = new Date(training.start_at)
  const endDate = training.end_at ? new Date(training.end_at) : null
  const badge = getStatusBadge(training.status || 'SCHEDULED')

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/admin/trainings')} variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-black">{training.title}</h1>
              <p className="text-sm text-gray-600 mt-1">Training Details & Management</p>
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
                        <p className="text-sm text-gray-600">
                          {enrollments.length} / {training.capacity} participants
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle>Participants ({enrollments.length})</CardTitle>
                <CardDescription>Volunteers enrolled in this training</CardDescription>
              </CardHeader>
              <CardContent>
                {enrollments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No participants enrolled yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {enrollments.map((enrollment) => {
                      const user = enrollment.users || {}
                      const evaluation = getEvaluationForUser(user.id)
                      const isEvaluating = evaluatingUserId === user.id

                      return (
                        <div key={enrollment.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <User className="h-5 w-5 text-gray-400" />
                                <div>
                                  <h3 className="font-medium text-gray-900">
                                    {user.first_name} {user.last_name}
                                  </h3>
                                  <p className="text-sm text-gray-500">{user.email}</p>
                                </div>
                              </div>

                              {enrollment.attended && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 mt-2">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Attended
                                </Badge>
                              )}

                              {evaluation && (
                                <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                    <span className="text-sm font-medium">
                                      Performance: {evaluation.performance_rating}/5
                                    </span>
                                  </div>
                                  {evaluation.comments && (
                                    <p className="text-sm text-gray-600">{evaluation.comments}</p>
                                  )}
                                  <p className="text-xs text-gray-500 mt-2">
                                    Evaluated by {evaluation.evaluated_by_user?.first_name} {evaluation.evaluated_by_user?.last_name}
                                  </p>
                                </div>
                              )}

                              {isEvaluating && (
                                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <h4 className="text-sm font-medium mb-3">Evaluate Volunteer</h4>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Performance Rating (1-5)
                                      </label>
                                      <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((rating) => (
                                          <button
                                            key={rating}
                                            type="button"
                                            onClick={() => setEvaluationForm({ ...evaluationForm, performance_rating: rating })}
                                            className="focus:outline-none"
                                          >
                                            <Star
                                              className={`h-6 w-6 ${
                                                rating <= evaluationForm.performance_rating
                                                  ? 'text-yellow-400 fill-current'
                                                  : 'text-gray-300'
                                              }`}
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Comments
                                      </label>
                                      <Textarea
                                        value={evaluationForm.comments}
                                        onChange={(e) => setEvaluationForm({ ...evaluationForm, comments: e.target.value })}
                                        placeholder="Add evaluation comments..."
                                        rows={3}
                                      />
                                    </div>

                                    <div className="flex gap-2">
                                      <Button onClick={submitEvaluation} size="sm">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Save Evaluation
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEvaluatingUserId(null)
                                          setEvaluationForm({
                                            performance_rating: 5,
                                            comments: "",
                                            skills_assessment: {}
                                          })
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="ml-4 flex flex-col gap-2">
                              {training.status === 'COMPLETED' && !evaluation && !isEvaluating && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEvaluate(user.id)}
                                >
                                  <Star className="h-4 w-4 mr-2" />
                                  Evaluate
                                </Button>
                              )}
                              <Link href={`/admin/users/${user.id}`}>
                                <Button variant="outline" size="sm">
                                  <User className="h-4 w-4 mr-2" />
                                  View Profile
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{enrollments.length}</div>
                  <div className="text-sm text-gray-600 mt-1">Enrolled</div>
                </div>

                {training.capacity && (
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round((enrollments.length / training.capacity) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Capacity Filled</div>
                  </div>
                )}

                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {evaluations.length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Evaluated</div>
                </div>

                {evaluations.length > 0 && (
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {(evaluations.reduce((sum, e) => sum + e.performance_rating, 0) / evaluations.length).toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Avg Rating</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/admin/trainings`)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Trainings
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

