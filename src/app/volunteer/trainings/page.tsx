"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Users, Clock, CheckCircle, X, AlertCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/lib/auth"

export default function VolunteerTrainingsPage() {
  // Trainings feature is enabled by default
  const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED !== 'false'
  const { user } = useAuth()

  const [trainings, setTrainings] = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState<number | null>(null)

  useEffect(() => {
    if (!FEATURE_ENABLED || !user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch all trainings
        const trainingsRes = await fetch("/api/trainings")
        const trainingsJson = await trainingsRes.json()
        if (trainingsRes.ok && trainingsJson.success) {
          setTrainings(trainingsJson.data || [])
        }

        // Fetch user enrollments
        if (user?.id) {
          const enrollRes = await fetch(`/api/trainings/enrollments?user_id=${user.id}`)
          const enrollJson = await enrollRes.json()
          if (enrollRes.ok && enrollJson.success) {
            setEnrollments(new Set((enrollJson.data || []).map((e: any) => e.training_id)))
          }
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load trainings")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [FEATURE_ENABLED, user])

  const handleEnroll = async (trainingId: number) => {
    setEnrolling(trainingId)
    try {
      const res = await fetch("/api/trainings/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ training_id: trainingId }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to enroll")

      setEnrollments(new Set([...enrollments, trainingId]))
    } catch (e: any) {
      alert("Failed to enroll: " + (e?.message || "Unknown error"))
    } finally {
      setEnrolling(null)
    }
  }

  const handleUnenroll = async (trainingId: number) => {
    if (!confirm("Are you sure you want to unenroll from this training?")) return

    setEnrolling(trainingId)
    try {
      const res = await fetch(`/api/trainings/enroll?training_id=${trainingId}`, {
        method: "DELETE",
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to unenroll")

      const newEnrollments = new Set(enrollments)
      newEnrollments.delete(trainingId)
      setEnrollments(newEnrollments)
    } catch (e: any) {
      alert("Failed to unenroll: " + (e?.message || "Unknown error"))
    } finally {
      setEnrolling(null)
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

  const availableTrainings = trainings.filter(t => t.status === "SCHEDULED")
  const enrolledTrainings = trainings.filter(t => enrollments.has(t.id))
  const completedTrainings = trainings.filter(t => t.status === "COMPLETED" && enrollments.has(t.id))

  if (!FEATURE_ENABLED) {
    return (
      <VolunteerLayout>
        <div className="p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800 font-medium">⚠️ Trainings feature is disabled</p>
          </div>
        </div>
      </VolunteerLayout>
    )
  }

  return (
    <VolunteerLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-black">Training Sessions</h1>
          <p className="text-sm text-gray-600 mt-1">Browse and enroll in available training sessions</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Available Trainings */}
        <Card>
          <CardHeader>
            <CardTitle>Available Trainings</CardTitle>
            <CardDescription>Enroll in upcoming training sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" text="Loading trainings..." />
              </div>
            ) : availableTrainings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-gray-500 font-medium">No trainings available</p>
                <p className="text-sm text-gray-400 mt-1">Check back later for new training sessions</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableTrainings.map((t) => {
                  const startDate = new Date(t.start_at)
                  const endDate = t.end_at ? new Date(t.end_at) : null
                  const isEnrolled = enrollments.has(t.id)
                  
                  return (
                    <div key={t.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Link href={`/volunteer/trainings/${t.id}`} className="hover:underline">
                              <h3 className="font-semibold text-gray-900 text-lg">{t.title}</h3>
                            </Link>
                            {isEnrolled && (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Enrolled
                              </Badge>
                            )}
                          </div>

                          {t.description && (
                            <p className="text-sm text-gray-600 mb-3">{t.description}</p>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {startDate.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })} at {startDate.toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </span>
                            </div>

                            {endDate && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>
                                  Ends: {endDate.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })} at {endDate.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                            )}

                            {t.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span>{t.location}</span>
                              </div>
                            )}

                            {t.capacity && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>Capacity: {t.capacity} participants</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-4">
                          {isEnrolled ? (
                            <Button
                              variant="outline"
                              onClick={() => handleUnenroll(t.id)}
                              disabled={enrolling === t.id}
                            >
                              {enrolling === t.id ? (
                                <LoadingSpinner size="sm" className="mr-2" />
                              ) : (
                                <X className="h-4 w-4 mr-2" />
                              )}
                              Unenroll
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleEnroll(t.id)}
                              disabled={enrolling === t.id}
                            >
                              {enrolling === t.id ? (
                                <LoadingSpinner size="sm" className="mr-2" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              )}
                              Enroll
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Enrolled Trainings */}
        {enrolledTrainings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>My Enrolled Trainings</CardTitle>
              <CardDescription>Trainings you've enrolled in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enrolledTrainings.map((t) => {
                  const startDate = new Date(t.start_at)
                  const badge = getStatusBadge(t.status || 'SCHEDULED')
                  
                  return (
                    <div key={t.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold">{t.title}</h3>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {startDate.toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })} at {startDate.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                          {t.location && (
                            <p className="text-sm text-gray-500 mt-1">{t.location}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </VolunteerLayout>
  )
}

