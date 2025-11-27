"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import ResidentLayout from "@/components/layout/resident-layout"
import { getIncidentById, getIncidentUpdates } from "@/lib/incidents"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { AlertTriangle, CheckCircle, Clock, Phone, User } from "lucide-react"
import FeedbackRating from "@/components/feedback-rating"
import { AudioPlayer } from "@/components/audio-player"

export default function ResidentIncidentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [incident, setIncident] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updates, setUpdates] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        // Fetch incident details
        const incidentResult = await getIncidentById(id as string)
        if (incidentResult.success) {
          setIncident(incidentResult.data)
        } else {
          setError(incidentResult.message || "Failed to fetch incident details")
        }

        // Fetch incident updates
        const updatesResult = await getIncidentUpdates(id as string)
        if (updatesResult.success) {
          setUpdates(updatesResult.data || [])
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, user])

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800"
      case "RESPONDING":
        return "bg-orange-100 text-orange-800"
      case "RESOLVED":
        return "bg-green-100 text-green-800"
      case "CANCELLED":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const handleCallVolunteer = () => {
    if (incident?.assigned_to?.phone_number) {
      window.location.href = `tel:${incident.assigned_to.phone_number}`
    }
  }

  if (loading) {
    return (
      <ResidentLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading incident details..." />
        </div>
      </ResidentLayout>
    )
  }

  if (error) {
    return (
      <ResidentLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
                onClick={() => router.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </ResidentLayout>
    )
  }

  if (!incident) {
    return (
      <ResidentLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Incident not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </ResidentLayout>
    )
  }

  return (
    <ResidentLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Incident Details</h1>
            <p className="text-gray-600 mt-1">
              Reported on {formatDate(incident.created_at)} • ID: {incident.id}
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              Back to History
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{incident.incident_type}</h2>
                  <span
                    className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                      incident.status,
                    )}`}
                  >
                    {incident.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Priority</p>
                  <div className="flex items-center mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full mx-0.5 ${
                          i < incident.priority ? "bg-red-500" : "bg-gray-200"
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-2 text-gray-700">{incident.description}</p>
                {incident.voice_url && (
                  <div className="mt-4">
                    <AudioPlayer voiceUrl={incident.voice_url} incidentId={incident.id} />
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500">Location</h3>
                <p className="mt-2 text-gray-700">
                  {incident.address}, {incident.barangay}, {incident.city}, {incident.province}
                </p>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500">Timeline</h3>
                <div className="mt-2 space-y-4">
                  {/* Static initial report entry */}
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Incident Reported</p>
                      <p className="text-sm text-gray-500">{formatDate(incident.created_at)}</p>
                    </div>
                  </div>

                  {/* Dynamic updates from incident_updates table */}
                  {updates.map((update: any, index: number) => (
                    <div key={index} className="flex items-start">
                      <div className="flex-shrink-0">
                        <div
                          className={`flex items-center justify-center h-8 w-8 rounded-full ${
                            update.previous_status === "SEVERITY_UPDATE" && update.new_status === "SEVERITY_UPDATE"
                              ? "bg-purple-100 text-purple-600"
                              : update.new_status === "PENDING"
                                ? "bg-yellow-100 text-yellow-600"
                                : update.new_status === "ASSIGNED"
                                  ? "bg-blue-100 text-blue-600"
                                  : update.new_status === "RESPONDING"
                                    ? "bg-orange-100 text-orange-600"
                                    : update.new_status === "ARRIVED"
                                      ? "bg-purple-100 text-purple-600"
                                      : update.new_status === "RESOLVED"
                                        ? "bg-green-100 text-green-600"
                                        : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {update.previous_status === "SEVERITY_UPDATE" && update.new_status === "SEVERITY_UPDATE" ? (
                            <span className="text-purple-600">⚠</span>
                          ) : update.new_status === "PENDING" ? (
                            <AlertTriangle className="h-5 w-5" />
                          ) : update.new_status === "ASSIGNED" ? (
                            <User className="h-5 w-5" />
                          ) : update.new_status === "RESPONDING" ? (
                            <Clock className="h-5 w-5" />
                          ) : update.new_status === "ARRIVED" ? (
                            <span className="text-purple-600">📍</span>
                          ) : update.new_status === "RESOLVED" ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <span className="text-gray-500">✕</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">
                          {update.previous_status === "SEVERITY_UPDATE" && update.new_status === "SEVERITY_UPDATE"
                            ? "Severity Updated"
                            : update.new_status === "PENDING"
                              ? "Incident Reported"
                              : update.new_status === "ASSIGNED"
                                ? "Volunteer Assigned"
                                : update.new_status === "RESPONDING"
                                  ? "Volunteer Responding"
                                  : update.new_status === "ARRIVED"
                                    ? "Volunteer Arrived"
                                    : update.new_status === "RESOLVED"
                                      ? "Incident Resolved"
                                      : "Incident Update"}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(update.created_at)}</p>
                        {update.notes && <p className="mt-1 text-sm text-gray-700">{update.notes}</p>}
                        {update.updated_by && update.updated_by.first_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            By: {update.updated_by.first_name} {update.updated_by.last_name} ({update.updated_by.role})
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Original static entries for backward compatibility */}
                  {incident.assigned_at && !updates.some(u => u.new_status === "ASSIGNED") && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600">
                          <User className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">Volunteer Assigned</p>
                        <p className="text-sm text-gray-500">{formatDate(incident.assigned_at)}</p>
                      </div>
                    </div>
                  )}

                  {incident.status === "RESPONDING" && !updates.some(u => u.new_status === "RESPONDING") && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-orange-100 text-orange-600">
                          <Clock className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">Volunteer On The Way (OTW)</p>
                        <p className="text-sm text-gray-500">A volunteer is on the way to your location</p>
                        {incident.responding_at && (
                          <p className="text-xs text-gray-500 mt-1">Confirmed at {formatDate(incident.responding_at)}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {incident.resolved_at && !updates.some(u => u.new_status === "RESOLVED") && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">Incident Resolved</p>
                        <p className="text-sm text-gray-500">{formatDate(incident.resolved_at)}</p>
                        {incident.resolution_notes && (
                          <p className="mt-1 text-sm text-gray-700">{incident.resolution_notes}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(() => {
              const photoGallery =
                Array.isArray(incident.photo_urls) && incident.photo_urls.length > 0
                  ? incident.photo_urls
                  : incident.photo_url
                    ? [incident.photo_url]
                    : []
              if (!photoGallery.length) return null
              return (
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-sm font-medium text-gray-500 mb-4">Photo Evidence</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {photoGallery.map((photo: string, idx: number) => (
                      <img
                        key={`${photo}-${idx}`}
                        src={photo}
                        alt={`Incident photo ${idx + 1}`}
                        className="w-full h-auto max-h-72 object-contain rounded-md"
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Incident Location</h3>
              <MapComponent
                center={[incident.location_lat, incident.location_lng]}
                zoom={15}
                markers={[
                  {
                    id: incident.id,
                    position: [incident.location_lat, incident.location_lng],
                    status: incident.status,
                    title: incident.incident_type,
                    description: incident.description,
                  },
                ]}
                height="300px"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Status Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Current Status</p>
                  <p
                    className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                      incident.status,
                    )}`}
                  >
                    {incident.status}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Reported On</p>
                  <p className="mt-1 text-sm text-gray-500">{formatDate(incident.created_at)}</p>
                </div>

                {incident.assigned_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Assigned On</p>
                    <p className="mt-1 text-sm text-gray-500">{formatDate(incident.assigned_at)}</p>
                  </div>
                )}

                {incident.resolved_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Resolved On</p>
                    <p className="mt-1 text-sm text-gray-500">{formatDate(incident.resolved_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {incident.assigned_to && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Assigned Volunteer</h3>
                <div>
                  <p className="font-medium">
                    {incident.assigned_to.first_name} {incident.assigned_to.last_name}
                  </p>
                  {incident.assigned_to.phone_number && (
                    <button
                      onClick={handleCallVolunteer}
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Call Volunteer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Feedback Section - Only show for resolved incidents */}
            {incident.status === 'RESOLVED' && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Rate Your Experience</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Help us improve our emergency response by rating your experience with this incident.
                </p>
                <FeedbackRating 
                  incidentId={incident.id}
                  onFeedbackSubmit={(feedback) => {
                    console.log('Feedback submitted:', feedback)
                    // You can add a success message here
                  }}
                />
              </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-4">
                If you need immediate assistance or have questions about this incident, please contact emergency
                services.
              </p>
              <button
                onClick={() => (window.location.href = "tel:09998064555")}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
              >
                <Phone className="mr-2 h-5 w-5" />
                Emergency Call
              </button>
            </div>
          </div>
        </div>
      </div>
    </ResidentLayout>
  )
}