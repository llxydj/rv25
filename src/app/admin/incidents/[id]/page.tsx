"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import {
  getIncidentById,
  assignIncident,
  updateIncidentStatus,
  getIncidentUpdates,
  subscribeToIncidents,
} from "@/lib/incidents"
import { getAllVolunteers } from "@/lib/volunteers"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { AlertTriangle, CheckCircle, User } from "lucide-react"
import { IncidentCallActions } from "@/components/incident-call-actions"
import { ImageLightbox } from "@/components/ui/image-lightbox"

export default function IncidentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [incident, setIncident] = useState<any>(null)
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updates, setUpdates] = useState<any[]>([])
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState("")

  // Helper function to safely set updates
  const safelySetUpdates = (data: any[] | undefined) => {
    setUpdates(data || []);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !id) return

      try {
        setLoading(true)
        // Fetch incident details
        const incidentResult = await getIncidentById(id as string)
        console.log("Incident fetch result:", incidentResult); // Debug log
        if (incidentResult.success) {
          console.log("Incident data:", incidentResult.data); // Debug log
          console.log("Reporter data:", incidentResult.data?.reporter); // Debug log
          setIncident(incidentResult.data)
        } else {
          setError(incidentResult.message || "Failed to fetch incident details")
        }

        // Fetch incident updates
        const updatesResult = await getIncidentUpdates(id as string)
        if (updatesResult.success) {
          safelySetUpdates(updatesResult.data)
        }

        // Fetch volunteers for assignment
        if (user.role === "admin") {
          const volunteersResult = await getAllVolunteers()
          if (volunteersResult.success) {
            console.log("Admin - Fetched volunteers:", {
              count: volunteersResult.data.length,
              sample: volunteersResult.data.length > 0 ? {
                id: volunteersResult.data[0].id,
                name: `${volunteersResult.data[0].first_name} ${volunteersResult.data[0].last_name}`,
                profile: volunteersResult.data[0].volunteer_profiles
              } : null
            })
            
            // Filter for active and available volunteers only
            const availableVolunteers = volunteersResult.data.filter((volunteer: any) => {
              // Get the profile (handle both single object and array cases)
              const profile = Array.isArray(volunteer.volunteer_profiles)
                ? volunteer.volunteer_profiles[0] 
                : volunteer.volunteer_profiles
              
              // Debug log
              console.log("Checking volunteer:", volunteer.first_name, {
                hasProfile: !!profile,
                status: profile?.status,
                isAvailable: profile?.is_available,
                typeOfIsAvailable: profile?.is_available !== undefined ? typeof profile.is_available : 'undefined',
                skills: profile?.skills
              })
              
              // Include volunteers that either:
              // 1. Have an ACTIVE profile and are available
              // 2. Have a newly created profile that hasn't been set to INACTIVE explicitly
              return (profile && 
                     (profile.status === "ACTIVE" && 
                     (profile.is_available === true || profile.is_available === 'true' || profile.is_available === 1))) || 
                     // Include newly created volunteers who don't have full profiles yet
                     (!profile || profile.status === null || profile.status === undefined)
            })
            
            // Sort volunteers by skills and last active time
            const sortedVolunteers = availableVolunteers.sort((a: any, b: any) => {
              const aProfile = Array.isArray(a.volunteer_profiles)
                ? a.volunteer_profiles[0]
                : a.volunteer_profiles
              const bProfile = Array.isArray(b.volunteer_profiles)
                ? b.volunteer_profiles[0]
                : b.volunteer_profiles
              
              // Prioritize volunteers with more relevant skills
              const aSkills = aProfile?.skills?.length || 0
              const bSkills = bProfile?.skills?.length || 0
              
              if (aSkills !== bSkills) {
                return bSkills - aSkills // More skills first
              }
              
              // Then sort by last active time (most recently active first)
              const aLastActive = new Date(aProfile?.last_active || 0).getTime()
              const bLastActive = new Date(bProfile?.last_active || 0).getTime()
              return bLastActive - aLastActive
            })
            
            // Debug log
            console.log("Volunteer filtering results:", {
              total: volunteersResult.data.length,
              available: availableVolunteers.length,
              sorted: sortedVolunteers.length,
              firstVolunteer: sortedVolunteers[0] ? {
                name: `${sortedVolunteers[0].first_name} ${sortedVolunteers[0].last_name}`,
                profile: sortedVolunteers[0].volunteer_profiles
              } : null
            })
            
            setVolunteers(sortedVolunteers)
          } else {
            console.error("Error fetching volunteers:", volunteersResult.message)
          }
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Subscribe to real-time updates for this incident
    let subscription: any = null
    try {
      subscription = subscribeToIncidents((payload) => {
        try {
          if (payload?.new && payload.new.id === id) {
            // Update incident data
            setIncident(payload.new)

            // Show notification
            setNotificationMessage("Incident has been updated")
            setShowNotification(true)

            // Hide notification after 3 seconds
            setTimeout(() => {
              setShowNotification(false)
            }, 3000)

            // Refresh incident updates
            getIncidentUpdates(id as string).then((result) => {
              if (result.success) {
                safelySetUpdates(result.data)
              }
            }).catch((err) => {
              console.error("Error refreshing incident updates:", err)
            })
          }
        } catch (err) {
          console.error("Error in subscription callback:", err)
        }
      })
    } catch (err) {
      console.error("Error setting up subscription:", err)
    }

    return () => {
      // Unsubscribe when component unmounts
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe()
        }
      } catch (err) {
        console.error("Error unsubscribing:", err)
      }
    }
  }, [id, user])

  const handleAssign = async () => {
    if (!user || !incident || !selectedVolunteer) return

    try {
      setAssigning(true)
      const result = await assignIncident(incident.id, selectedVolunteer, user.id)
      if (result.success) {
        // Update the incident state
        setIncident({
          ...incident,
          assigned_to: volunteers.find((v) => v.id === selectedVolunteer),
          status: "ASSIGNED",
        })

        // Refresh incident updates
        const updatesResult = await getIncidentUpdates(id as string)
        if (updatesResult.success) {
          safelySetUpdates(updatesResult.data)
        }
      } else {
        setError(result.message || "Failed to assign volunteer")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setAssigning(false)
    }
  }

  const handleUpdateStatus = async (newStatus: "RESPONDING" | "RESOLVED" | "CANCELLED") => {
    if (!user || !incident) return

    try {
      setUpdatingStatus(true)
      const result = await updateIncidentStatus(
        incident.id, 
        user.id, 
        newStatus as any,
        resolutionNotes
      )
      
      if (result.success) {
        // Update the incident state
        setIncident({
          ...incident,
          status: newStatus,
          resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : incident.resolved_at,
          resolution_notes: newStatus === "RESOLVED" ? resolutionNotes : incident.resolution_notes,
        })

        // Refresh incident updates
        const updatesResult = await getIncidentUpdates(id as string)
        if (updatesResult.success) {
          safelySetUpdates(updatesResult.data)
        }

        // Clear resolution notes
        setResolutionNotes("")
      } else {
        setError(result.message || `Failed to update incident status to ${newStatus}`)
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdatingStatus(false)
    }
  }

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

  const handleCallReporter = () => {
    console.log("handleCallReporter called with incident:", incident); // Debug log
    // Handle case where reporter might be an array from Supabase join
    const reporterData = incident?.reporter ? 
      (Array.isArray(incident.reporter) ? incident.reporter[0] : incident.reporter) 
      : null;
    
    if (reporterData?.phone_number) {
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user?.id || null,
            contact_id: incident.reporter_id,
            contact_name: `${reporterData.first_name} ${reporterData.last_name}`,
            contact_number: reporterData.phone_number,
            call_type: 'reporter',
            incident_id: incident.id,
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch { void 0 }
      window.location.href = `tel:${reporterData.phone_number}`
    } else {
      console.log("Reporter phone number not available"); // Debug log
    }
  }

  const handleCallVolunteer = () => {
    // Handle case where assigned_to might be an array from Supabase join
    const assigneeData = incident?.assigned_to ? 
      (Array.isArray(incident.assigned_to) ? incident.assigned_to[0] : incident.assigned_to) 
      : null;
    
    if (assigneeData?.phone_number) {
      try {
        fetch('/api/call-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user?.id || null,
            contact_id: assigneeData.id,
            contact_name: `${assigneeData.first_name} ${assigneeData.last_name}`,
            contact_number: assigneeData.phone_number,
            call_type: 'volunteer',
            incident_id: incident.id,
            status: 'initiated',
          }),
          keepalive: true,
        }).catch(() => {})
      } catch {
        // Intentionally empty - error already handled by outer catch
      }
      window.location.href = `tel:${assigneeData.phone_number}`
    }
  }

  // Share helpers
  const mapsUrl = incident?.location_lat && incident?.location_lng
    ? `https://maps.google.com/?q=${incident.location_lat},${incident.location_lng}`
    : null

  const emailHref = () => {
    const subject = encodeURIComponent(`RVOIS Incident Handoff: ${incident?.incident_type || ''} (${incident?.barangay || ''})`)
    const body = encodeURIComponent([
      `Incident ID: ${incident?.id || ''}`,
      `Created: ${incident?.created_at ? new Date(incident.created_at).toLocaleString() : ''}`,
      `Type: ${incident?.incident_type || ''}`,
      `Severity: ${incident?.severity || ''}`,
      `Status: ${incident?.status || ''}`,
      `Barangay: ${incident?.barangay || ''}`,
      `Address: ${incident?.address || ''}`,
      `Location: ${incident?.location_lat || ''}, ${incident?.location_lng || ''}`,
      mapsUrl ? `Map: ${mapsUrl}` : null,
      '',
      'Description:',
      `${incident?.description || ''}`,
      '',
      `Photo: ${incident?.photo_url || 'None'}`,
      '',
      '— Generated via RVOIS',
    ].filter(Boolean as any).join('\n'))
    return `mailto:?subject=${subject}&body=${body}`
  }

  const smsHref = () => {
    const text = encodeURIComponent(
      `RVOIS: ${incident?.incident_type || ''} (${incident?.severity || ''}) in ${incident?.barangay || ''}\n` +
      `ID:${incident?.id || ''} Loc:${incident?.location_lat || ''},${incident?.location_lng || ''}\n` +
      (mapsUrl ? `Map: ${mapsUrl}` : '')
    )
    return `sms:?&body=${text}`
  }

  const copyDetails = async () => {
    try {
      const text = [
        `Incident ID: ${incident?.id || ''}`,
        `Created: ${incident?.created_at ? new Date(incident.created_at).toLocaleString() : ''}`,
        `Type: ${incident?.incident_type || ''}`,
        `Severity: ${incident?.severity || ''}`,
        `Status: ${incident?.status || ''}`,
        `Barangay: ${incident?.barangay || ''}`,
        `Address: ${incident?.address || ''}`,
        `Location: ${incident?.location_lat || ''}, ${incident?.location_lng || ''}`,
        mapsUrl ? `Map: ${mapsUrl}` : null,
        '',
        'Description:',
        `${incident?.description || ''}`,
      ].filter(Boolean as any).join('\n')
      await navigator.clipboard.writeText(text)
      setShowNotification(true)
      setNotificationMessage('Incident details copied to clipboard')
      setTimeout(()=> setShowNotification(false), 2000)
    } catch {
      setError('Failed to copy details')
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading incident details..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
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
      </AdminLayout>
    )
  }

  if (!incident) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Incident not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      {/* Real-time notification */}
      {showNotification && (
        <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 shadow-md flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>{notificationMessage}</span>
          <button onClick={() => setShowNotification(false)} className="ml-4 text-green-700 hover:text-green-900">
            <span className="text-sm font-bold">✕</span>
          </button>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Incident Details</h1>
            <p className="text-gray-600 mt-1">
              Reported on {formatDate(incident.created_at)} • ID: {incident.id}
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-2">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-900"
              onClick={() => router.back()}
            >
              Back to List
            </button>
            <button
              className="inline-flex items-center px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-900"
              onClick={() => router.push(`/admin/incidents/${incident.id}/brief`)}
              title="Open printable brief"
            >
              <span className="mr-2">↗</span> Share
            </button>
            <a
              href={emailHref()}
              className="inline-flex items-center px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-900"
              title="Email summary"
            >Email</a>
            <a
              href={smsHref()}
              className="inline-flex items-center px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-900"
              title="SMS summary"
            >SMS</a>
            <button
              onClick={copyDetails}
              className="inline-flex items-center px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-900"
              title="Copy details"
            >Copy</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{incident.incident_type}</h2>
                    {incident.severity && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        incident.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        incident.severity === 'SEVERE' ? 'bg-orange-100 text-orange-800' :
                        incident.severity === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {incident.severity}
                      </span>
                    )}
                  </div>
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
                  {updates.map((update, index) => (
                    <div key={index} className="flex items-start">
                      <div className="flex-shrink-0">
                        <div
                          className={`flex items-center justify-center h-8 w-8 rounded-full ${
                            update.new_status === "PENDING"
                              ? "bg-yellow-100 text-yellow-600"
                              : update.new_status === "ASSIGNED"
                                ? "bg-blue-100 text-blue-600"
                                : update.new_status === "RESPONDING"
                                  ? "bg-orange-100 text-orange-600"
                                  : update.new_status === "RESOLVED"
                                    ? "bg-green-100 text-green-600"
                                    : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {update.new_status === "PENDING" ? (
                            <AlertTriangle className="h-5 w-5" />
                          ) : update.new_status === "ASSIGNED" ? (
                            <User className="h-5 w-5" />
                          ) : update.new_status === "RESPONDING" ? (
                            <span className="text-orange-600">⏱</span>
                          ) : update.new_status === "RESOLVED" ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <span className="text-gray-500">✕</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">
                          {update.new_status === "PENDING"
                            ? "Incident Reported"
                            : update.new_status === "ASSIGNED"
                              ? "Volunteer Assigned"
                              : update.new_status === "RESPONDING"
                                ? "Volunteer Responding"
                                : update.new_status === "RESOLVED"
                                  ? "Incident Resolved"
                                  : "Incident Cancelled"}
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

                  {updates.length === 0 && <p className="text-sm text-gray-500">No updates available</p>}
                </div>
              </div>
            </div>

            {incident.photo_url && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Photo Evidence</h3>
                <ImageLightbox
                  src={incident.photo_url || "/placeholder.svg"}
                  alt="Incident photo"
                  className="w-full h-auto max-h-96 object-contain rounded-md"
                />
              </div>
            )}

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
                showBoundary={true}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Reporter Information</h3>
              {incident.reporter ? (
                (() => {
                  // Handle case where reporter might be an array from Supabase join
                  const reporterData = Array.isArray(incident.reporter) 
                    ? incident.reporter[0] 
                    : incident.reporter;
                  
                  // Debug logging
                  console.log("Processing reporter data:", reporterData);
                  
                  return (
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        {reporterData.first_name && reporterData.last_name
                          ? `${reporterData.first_name} ${reporterData.last_name}`
                          : reporterData.first_name || reporterData.last_name
                          ? (reporterData.first_name || reporterData.last_name)
                          : reporterData.email || "Anonymous Reporter"}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{reporterData.email || "No email provided"}</p>
                      {reporterData.phone_number && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">{reporterData.phone_number}</p>
                          <button
                            onClick={handleCallReporter}
                            className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                          >
                            <User className="h-4 w-4 mr-1" />
                            Call Reporter
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div>
                  <p className="text-sm text-gray-500">Reporter information not available</p>
                  {/* Debug information */}
                  <p className="text-xs text-gray-400 mt-2">Reporter prop: {JSON.stringify(incident.reporter)}</p>
                </div>
              )}
            </div>

            {/* Enhanced Call Actions */}
            <IncidentCallActions 
              incident={incident}
              userRole={(user?.role === 'barangay' ? 'admin' : (user?.role || 'admin')) as 'admin' | 'volunteer' | 'resident'}
              onCallComplete={(callLog) => {
                console.log('Call completed:', callLog)
                // You can add additional logic here if needed
              }}
            />

            {incident.status === "PENDING" && user?.role === "admin" ? (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Assign Volunteer</h3>
                {volunteers && volunteers.length > 0 ? (
                  <div>
                    <select
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 sm:text-sm rounded-md text-gray-900"
                      value={selectedVolunteer}
                      onChange={(e) => setSelectedVolunteer(e.target.value)}
                      disabled={assigning}
                    >
                      <option value="">Select a volunteer</option>
                      {volunteers.map((volunteer) => {
                        const profile = volunteer.volunteer_profiles;
                        const needsActivation = !profile || profile.status === null || profile.status === undefined || profile.status === "INACTIVE";
                        const statusLabel = needsActivation ? " (Needs Activation)" : "";
                        
                        return (
                          <option 
                            key={volunteer.id} 
                            value={volunteer.id} 
                            className={`text-gray-900 ${needsActivation ? "font-bold text-yellow-700" : ""}`}
                          >
                            {volunteer.first_name} {volunteer.last_name} - {volunteer.barangay || "Unknown location"}
                            {statusLabel}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Note: Volunteers shown with "(Needs Activation)" will need to be activated before they can respond.
                    </p>
                    <button
                      onClick={handleAssign}
                      disabled={!selectedVolunteer || assigning}
                      className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 disabled:opacity-50"
                    >
                      {assigning ? <LoadingSpinner size="sm" color="text-white" /> : "Assign Volunteer"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">No active and available volunteers at the moment</p>
                    <p className="text-xs text-gray-400 mt-2">Volunteers must be active and have set their availability to be assigned.</p>
                  </div>
                )}
              </div>
            ) : incident.assigned_to ? (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Assigned Volunteer</h3>
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {incident.assigned_to.first_name} {incident.assigned_to.last_name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{incident.assigned_to.email}</p>
                  {incident.assigned_to.phone_number && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">{incident.assigned_to.phone_number}</p>
                      <button
                        onClick={handleCallVolunteer}
                        className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                      >
                        <User className="h-4 w-4 mr-1" />
                        Call Volunteer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Admin actions */}
            {user?.role === "admin" && incident.status !== "RESOLVED" && incident.status !== "CANCELLED" && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Admin Actions</h3>

                {incident.status === "ASSIGNED" || incident.status === "RESPONDING" ? (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="resolutionNotes" className="block text-sm font-medium text-gray-700 mb-1">
                        Resolution Notes
                      </label>
                      <textarea
                        id="resolutionNotes"
                        rows={3}
                        className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 sm:text-sm"
                        placeholder="Enter resolution details..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        disabled={updatingStatus}
                      ></textarea>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateStatus("RESOLVED")}
                        disabled={updatingStatus}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 disabled:opacity-50"
                      >
                        {updatingStatus ? (
                          <LoadingSpinner size="sm" color="text-white" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Resolved
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleUpdateStatus("CANCELLED")}
                        disabled={updatingStatus}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500 disabled:opacity-50"
                      >
                        {updatingStatus ? (
                          <LoadingSpinner size="sm" color="text-white" />
                        ) : (
                          <>
                            <span className="mr-1">✕</span>
                            Cancel Incident
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {incident.status === "PENDING"
                      ? "Assign a volunteer to this incident first."
                      : "This incident has been resolved or cancelled."}
                  </p>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
