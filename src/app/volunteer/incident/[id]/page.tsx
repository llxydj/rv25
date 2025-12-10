// src/app/volunteer/incident/[id]/page.tsx

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { getIncidentById, updateIncidentStatus, getIncidentUpdates } from "@/lib/incidents"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { AlertTriangle, CheckCircle, Clock, Phone, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { IncidentCallActions } from "@/components/incident-call-actions"
import IncidentOTWButton from "@/components/incident-otw-button"
import IncidentStatusDropdown from "@/components/incident-status-dropdown"
import IncidentSeverityUpdater from "@/components/incident-severity-updater"
import { IncidentFeedbackDisplay } from "@/components/incident-feedback-display"
import { AudioPlayer } from "@/components/audio-player"
import { IncidentTimeline } from "@/components/incident-timeline"

export default function VolunteerIncidentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [incident, setIncident] = useState<any>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [updates, setUpdates] = useState<any[]>([])
  const [timelineEvents, setTimelineEvents] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  
  // Use refs to prevent re-render loops
  const isMountedRef = useRef(true)
  const hasLoadedRef = useRef(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize the fetch function to prevent re-creation
  const fetchIncidentData = useCallback(async (incidentId: string, userId: string, userRole: string) => {
    try {
      console.log(`Fetching incident details for ID: ${incidentId}`)
      
      // Validate UUID format
      if (!incidentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error("Invalid incident ID format:", incidentId)
        throw new Error("Invalid incident ID format")
      }
      
      // Fetch incident details
      const incidentResult = await getIncidentById(incidentId)
      console.log("Incident fetch result:", incidentResult)
      
      if (!isMountedRef.current) return null
      
      if (incidentResult.success && incidentResult.data) {
        // Check if current user is assigned to this incident (allow admins to view any)
        const assignedUserId = incidentResult.data.assigned_to || 
                              (incidentResult.data.assignee && incidentResult.data.assignee.id) || 
                              null
        
        if (userRole !== 'admin' && assignedUserId !== userId) {
          throw new Error("You are not assigned to this incident")
        }
        
        return incidentResult.data
      } else {
        throw new Error(incidentResult.message || "Failed to fetch incident details")
      }
    } catch (err: any) {
      console.error("Error fetching incident details:", err)
      throw err
    }
  }, []) // Empty deps - this function doesn't depend on any props/state

  useEffect(() => {
    // Reset mounted ref on mount
    isMountedRef.current = true
    
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    
    const loadData = async () => {
      // Prevent multiple loads
      if (hasLoadedRef.current) {
        console.log("Data already loaded, skipping...")
        return
      }
      
      // Wait for auth to finish loading
      if (authLoading) {
        console.log("Waiting for auth...")
        return
      }
      
      // Check authentication
      if (!user) {
        console.log("No authenticated user found, redirecting to login")
        router.push('/login')
        return
      }
      
      // Extract and validate incident ID
      const incidentId = params?.id
      if (!incidentId) {
        console.log("No incident ID found in URL params")
        setError("No incident ID provided")
        setLoading(false)
        return
      }
      
      // Convert to string if it's an array
      const idToUse = Array.isArray(incidentId) ? incidentId[0] : String(incidentId)
      
      // Mark as loading started
      hasLoadedRef.current = true
      setLoading(true)
      setError(null)
      
      // Set up timeout for loading (30 seconds)
      loadingTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && loading) {
          console.error("Loading timed out after 30 seconds")
          setLoading(false)
          setError("Loading timed out. Please refresh the page or check your connection.")
        }
      }, 30000)
      
      try {
        const incidentData = await fetchIncidentData(idToUse, user?.id || '', user?.role || '')
        
        if (isMountedRef.current && incidentData) {
          setIncident(incidentData)
          setError(null)
          
          // Fetch incident updates
          const updatesResult = await getIncidentUpdates(idToUse)
          if (updatesResult.success) {
            setUpdates(updatesResult.data || [])
          }

          // Fetch timeline events
          setLoadingTimeline(true)
          try {
            const timelineRes = await fetch(`/api/incidents/${idToUse}/timeline`)
            const timelineData = await timelineRes.json()
            if (timelineData.success && timelineData.data) {
              setTimelineEvents(timelineData.data)
            }
          } catch (err) {
            console.error("Error fetching timeline:", err)
          } finally {
            setLoadingTimeline(false)
          }
        }
      } catch (err: any) {
        console.error("Error in loadData:", err)
        if (isMountedRef.current) {
          setError(err.message || "An unexpected error occurred")
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
          // Clear timeout on successful load
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current)
            loadingTimeoutRef.current = null
          }
        }
      }
    }
    
    loadData()
    
    // Cleanup function
    return () => {
      isMountedRef.current = false
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [params?.id, user?.id, user?.role, authLoading, fetchIncidentData, router]) // Only essential dependencies

  const handleUpdateStatus = async (newStatus: "RESPONDING" | "RESOLVED" | "ARRIVED") => {
    if (!user || !incident) return

    try {
      setUpdating(true)
      setError(null)
      
      // Validate inputs
      if (newStatus === "RESOLVED" && !resolutionNotes.trim()) {
        setError("Resolution notes are required when resolving an incident")
        setUpdating(false)
        return
      }
      
      // Validate incident ID format
      if (!incident.id || typeof incident.id !== 'string') {
        console.error("Missing incident ID:", incident)
        setError("Invalid incident: missing ID")
        setUpdating(false)
        return
      }
      
      // Validate UUID format
      if (!incident.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error("Invalid incident ID format:", incident.id)
        setError("Invalid incident ID format")
        setUpdating(false)
        return
      }
      
      console.log("Updating incident status:", {
        volunteerId: user.id,
        incidentId: incident.id,
        current_status: incident.status,
        newStatus,
        hasNotes: !!resolutionNotes
      })
      
      try {
        // Direct SQL update for RESOLVED status
        if (newStatus === "RESOLVED") {
          try {
            console.log("Attempting direct update for RESOLVED status")
            
            let updateSucceeded = false
            
            // Attempt 1: Filter-based update
            try {
              console.log("Attempt 1: Filter-based update")
              
              const { error } = await (supabase as any)
                .from('incidents')
                .update({ 
                  status: 'RESOLVED' as const,
                  resolved_at: new Date().toISOString(),
                  resolution_notes: resolutionNotes || null
                })
                .eq('id', incident.id)
                
              if (error) {
                console.error("Filter update failed:", error)
                throw error
              }
              
              console.log("Filter update succeeded!")
              updateSucceeded = true
              
            } catch (filterError) {
              console.error("Attempt 1 failed:", filterError)
              
              // Attempt 2: Minimal update
              try {
                console.log("Attempt 2: Minimal update")
                
                const { error } = await (supabase as any)
                  .from('incidents')
                  .update({ status: 'RESOLVED' as const })
                  .eq('id', incident.id)
                  
                if (error) {
                  console.error("Minimal update failed:", error)
                  throw error
                }
                
                console.log("Minimal update succeeded!")
                updateSucceeded = true
                
              } catch (minError) {
                console.error("Attempt 2 failed:", minError)
                throw minError
              }
            }
            
            // Update volunteer profile if incident update succeeded
            if (updateSucceeded) {
              try {
                console.log("Updating volunteer profile")
                
                const { data: profileData } = await supabase
                  .from('volunteer_profiles')
                  .select('total_incidents_resolved')
                  .eq('volunteer_user_id', user.id)
                  .single()
                  
                const currentCount = (profileData as any)?.total_incidents_resolved || 0
                const newCount = currentCount + 1
                
                const { error: profileError } = await (supabase as any)
                  .from('volunteer_profiles')
                  .update({ 
                    total_incidents_resolved: newCount,
                    is_available: true 
                  })
                  .eq('volunteer_user_id', user.id)
                  
                if (profileError) {
                  console.error("Profile update failed (non-critical):", profileError)
                } else {
                  console.log(`Profile updated to ${newCount} resolved incidents`)
                }

                // Update local state and show success message
                setIncident({
                  ...incident,
                  status: 'RESOLVED',
                  resolved_at: new Date().toISOString(),
                  resolution_notes: resolutionNotes
                })
                
                setSuccessMessage("✅ Incident resolved successfully! Admins and the reporter have been notified.")
                return // Skip the standard update function
                
              } catch (profileErr) {
                console.error("Error in profile update (non-critical):", profileErr)
                
                setIncident({
                  ...incident,
                  status: 'RESOLVED'
                })
                
                setSuccessMessage("✅ Incident marked as resolved! Admins and the reporter have been notified.")
                return
              }
            }
            
          } catch (error) {
            console.error("All update approaches failed:", error)
            // Fall through to standard update
          }
        }
        
        // Standard update approach as fallback
        const result = await updateIncidentStatus(
          user.id,
          incident.id,
          newStatus,
          newStatus === "RESOLVED" ? resolutionNotes : undefined
        )
        
        console.log("Status update result:", result)
        
        if (result.success) {
          // Update the incident state
          setIncident({
            ...incident,
            status: newStatus,
            responding_at: newStatus === "RESPONDING" ? new Date().toISOString() : incident.responding_at,
            resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : incident.resolved_at,
            resolution_notes: newStatus === "RESOLVED" ? resolutionNotes : incident.resolution_notes,
          })
          
          // Show success message
          if (newStatus === "RESOLVED") {
            setSuccessMessage("✅ Incident resolved successfully! Admins and the reporter have been notified.")
          } else if (newStatus === "RESPONDING") {
            setSuccessMessage("🚀 Status updated to responding! Admins and the reporter have been notified.")
          } else if (newStatus === "ARRIVED") {
            setSuccessMessage("📍 Status updated to arrived! Admins and the reporter have been notified.")
          }
        } else {
          console.error("Failed to update status:", result)
          
          if (result.error?.message) {
            const errorMsg = result.error.message
            console.error(`Database error details: ${errorMsg}`)
            
            if (errorMsg.includes("column") && errorMsg.includes("does not exist")) {
              const columnMatch = errorMsg.match(/column ["']([^"']+)["']/)
              const columnName = columnMatch ? columnMatch[1] : "unknown"
              setError(`Database error: Column '${columnName}' does not exist. Please contact support.`)
            } else {
              setError(result.message || `Failed to update status to ${newStatus}`)
            }
          } else {
            setError(result.message || `Failed to update status to ${newStatus}`)
          }
        }
      } catch (updateErr: any) {
        console.error("Exception during update:", updateErr)
        setError(updateErr.message || `Error during update: ${updateErr}`)
      }
    } catch (err: any) {
      console.error("Error in handleUpdateStatus:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
      case "ASSIGNED":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
      case "RESPONDING":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
      case "RESOLVED":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
      case "CANCELLED":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  // Helper function to get reporter display name
  const getReporterDisplayName = (reporter: any): string => {
    if (!reporter) return "Anonymous Reporter";
    
    // Handle array case (Supabase sometimes returns arrays for joins)
    const reporterData = Array.isArray(reporter) ? reporter[0] : reporter;
    
    if (!reporterData) return "Anonymous Reporter";
    
    // Build name with proper fallbacks
    const firstName = reporterData.first_name || '';
    const lastName = reporterData.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    
    // Return full name, or email, or fallback
    return fullName || reporterData.email || "Anonymous Reporter";
  }

  const handleCallReporter = () => {
    const reporterData = Array.isArray(incident?.reporter) 
      ? incident.reporter[0] 
      : incident?.reporter;
    
    if (reporterData?.phone_number) {
      window.location.href = `tel:${reporterData.phone_number}`
    }
  }

  const getDirections = () => {
    if (incident?.location_lat && incident?.location_lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${incident.location_lat},${incident.location_lng}`
      window.open(url, "_blank")
    }
  }

  if (loading) {
    return (
      <VolunteerLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading incident details..." />
        </div>
      </VolunteerLayout>
    )
  }

  if (error) {
    return (
      <VolunteerLayout>
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
      </VolunteerLayout>
    )
  }

  if (!incident) {
    return (
      <VolunteerLayout>
        <div className="text-center py-12">
          <p className="text-gray-900 dark:text-white">Incident not found</p>
          <button
            className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </VolunteerLayout>
    )
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Incident Details</h1>
            <p className="text-gray-600 mt-1">
              Reported on {formatDate(incident.created_at)} • ID: {incident.id}
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              onClick={() => router.back()}
            >
              Back to List
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{incident.incident_type}</h2>
                  <span
                    className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                      incident.status,
                    )}`}
                  >
                    {incident.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-700">Priority</p>
                  <div className="flex items-center mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full mx-0.5 ${
                          i < incident.priority ? "bg-red-500" : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700">Description</h3>
                <p className="mt-1 text-gray-900 dark:text-white">{incident.description}</p>
                {incident.voice_url && (
                  <div className="mt-4">
                    <AudioPlayer voiceUrl={incident.voice_url} incidentId={incident.id} />
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Location</h3>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {incident.address}, {incident.barangay}, {incident.city}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Reported By</h3>
                  {incident.reporter ? (
                    <div className="mt-1 flex items-center">
                      <User className="h-4 w-4 text-gray-500 mr-1" />
                      <p className="text-gray-900 dark:text-white">
                        {getReporterDisplayName(incident.reporter)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-700">Anonymous Reporter</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {incident.reporter?.phone_number && (
                  <button
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                    onClick={handleCallReporter}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Reporter
                  </button>
                )}
                <button
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                  onClick={getDirections}
                >
                  Get Directions
                </button>
              </div>
            </div>

            {/* Enhanced Call Actions */}
            <IncidentCallActions 
              incident={incident}
              userRole="volunteer"
              onCallComplete={(callLog) => {
                console.log('Call completed:', callLog)
              }}
            />

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Location</h2>
              <div className="h-64 rounded-md overflow-hidden">
                {incident.location_lat && incident.location_lng && (
                  <MapComponent
                    center={[incident.location_lat, incident.location_lng]}
                    zoom={15}
                    markers={[
                      {
                        id: incident.id,
                        position: [incident.location_lat, incident.location_lng],
                        title: incident.incident_type,
                        status: incident.status,
                      },
                    ]}
                    showBoundary={true}
                  />
                )}
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
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Photo Evidence</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {photoGallery.map((photo: string, idx: number) => (
                      <div key={`${photo}-${idx}`} className="rounded-md overflow-hidden">
                        <img
                          src={photo}
                          alt={`Photo of ${incident.incident_type} reported on ${new Date(
                            incident.created_at
                          ).toLocaleDateString()}`}
                          className="w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Update</h2>
              
              <div className="space-y-4">
                <p className="text-gray-700">
                  {incident.status === "ASSIGNED" && "You are assigned to this incident. Mark as responding when you're on your way."}
                  {incident.status === "RESPONDING" && "You are responding to this incident. Update status as you progress."}
                  {incident.status === "ARRIVED" && "You have arrived at the incident location. Mark as resolved when completed."}
                  {incident.status === "RESOLVED" && "This incident has been resolved."}
                </p>
                
                {user && (
                  <IncidentStatusDropdown
                    incidentId={incident.id}
                    currentStatus={incident.status}
                    volunteerId={user.id}
                    onStatusUpdate={(newStatus) => {
                      console.log('Parent received status update:', newStatus)
                      
                      // Force immediate state update
                      setIncident((prevIncident: any) => ({
                        ...prevIncident,
                        status: newStatus,
                        responding_at: newStatus === "RESPONDING" ? new Date().toISOString() : prevIncident.responding_at,
                        arrived_at: newStatus === "ARRIVED" ? new Date().toISOString() : prevIncident.arrived_at,
                        resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : prevIncident.resolved_at,
                      }))
                      
                      let message = ""
                      switch (newStatus) {
                        case "RESPONDING":
                          message = "🚀 Status updated to On The Way (OTW)! Resident and admins have been notified."
                          break
                        case "ARRIVED":
                          message = "📍 Status updated to Arrived! Resident and admins have been notified."
                          break
                        case "RESOLVED":
                          message = "✅ Incident resolved successfully! Admins and the reporter have been notified."
                          break
                        default:
                          message = `Status updated to ${newStatus}. Resident and admins have been notified.`
                      }
                      setSuccessMessage(message)
                    }}
                  />
                )}
                
                {/* Severity Update - Only when ARRIVED */}
                {incident.status === "ARRIVED" && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Assess Severity Level</h3>
                    <IncidentSeverityUpdater
                      currentSeverity={incident.severity}
                      incidentId={incident.id}
                      incidentStatus={incident.status}
                      onSeverityUpdate={(newSeverity) => {
                        setIncident({
                          ...incident,
                          severity: newSeverity
                        })
                        setSuccessMessage(`Severity updated to ${newSeverity}`)
                        
                        // Refresh updates to show the new severity update
                        // Refresh timeline
                        fetch(`/api/incidents/${incident.id}/timeline`)
                          .then(res => res.json())
                          .then(data => {
                            if (data.success && data.data) {
                              setTimelineEvents(data.data)
                            }
                          })
                          .catch(err => console.error("Error refreshing timeline:", err))
                        
                        getIncidentUpdates(incident.id).then((result) => {
                          if (result.success) {
                            setUpdates(result.data || [])
                          }
                        })
                      }}
                    />
                  </div>
                )}

                {incident.status === "RESPONDING" || incident.status === "ARRIVED" ? (
                  <div className="mt-4">
                    <label htmlFor="resolutionNotes" className="block text-sm font-medium text-gray-700">
                      Resolution Notes
                    </label>
                    <textarea
                      id="resolutionNotes"
                      name="resolutionNotes"
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      placeholder="Describe how the incident was resolved..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      disabled={updating}
                    />
                    <button
                      className="mt-2 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleUpdateStatus("RESOLVED")}
                      disabled={updating || !resolutionNotes.trim()}
                    >
                      {updating ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Resolved
                    </button>
                  </div>
                ) : null}
              </div>
              
              {incident.status === "RESOLVED" && (
                <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <p className="font-medium">Resolved</p>
                  </div>
                  <p className="text-sm text-gray-700">
                    Resolved on {incident.resolved_at ? formatDate(incident.resolved_at) : "N/A"}
                  </p>
                  {incident.resolution_notes && (
                    <div className="mt-2">
                      <h3 className="text-sm font-medium text-gray-700">Resolution Notes</h3>
                      <p className="mt-1 text-gray-900 dark:text-white">{incident.resolution_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-black mb-4">Timeline</h2>
              <div className="space-y-4">
                {/* Static initial report entry */}
                <div className="flex">
                  <div className="mr-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">Incident Reported</p>
                    <p className="text-xs text-gray-700">{formatDate(incident.created_at)}</p>
                  </div>
                </div>

                {/* Dynamic updates from incident_updates table */}
                {updates.map((update: any, index: number) => (
                  <div key={index} className="flex">
                    <div className="mr-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          update.previous_status === "SEVERITY_UPDATE" && update.new_status === "SEVERITY_UPDATE"
                            ? "bg-purple-100"
                            : update.new_status === "PENDING"
                              ? "bg-gray-200"
                              : update.new_status === "ASSIGNED"
                                ? "bg-blue-100"
                                : update.new_status === "RESPONDING"
                                  ? "bg-orange-100"
                                  : update.new_status === "ARRIVED"
                                    ? "bg-purple-100"
                                    : update.new_status === "RESOLVED"
                                      ? "bg-green-100"
                                      : "bg-gray-200"
                        }`}
                      >
                        {update.previous_status === "SEVERITY_UPDATE" && update.new_status === "SEVERITY_UPDATE" ? (
                          <span className="text-purple-600">⚠</span>
                        ) : update.new_status === "PENDING" ? (
                          <AlertTriangle className="h-4 w-4 text-gray-600" />
                        ) : update.new_status === "ASSIGNED" ? (
                          <User className="h-4 w-4 text-blue-600" />
                        ) : update.new_status === "RESPONDING" ? (
                          <Clock className="h-4 w-4 text-orange-600" />
                        ) : update.new_status === "ARRIVED" ? (
                          <span className="text-purple-600">📍</span>
                        ) : update.new_status === "RESOLVED" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-gray-600">✕</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">
                        {update.previous_status === "SEVERITY_UPDATE" && update.new_status === "SEVERITY_UPDATE"
                          ? "Severity Updated"
                          : update.new_status === "PENDING"
                            ? "Incident Reported"
                            : update.new_status === "ASSIGNED"
                              ? "Assigned to You"
                              : update.new_status === "RESPONDING"
                                ? "On The Way (OTW)"
                                : update.new_status === "ARRIVED"
                                  ? "Arrived at Scene"
                                  : update.new_status === "RESOLVED"
                                    ? "Resolved"
                                    : "Incident Update"}
                      </p>
                      <p className="text-xs text-gray-700">{formatDate(update.created_at)}</p>
                      {update.notes && <p className="text-xs text-gray-700 mt-1">{update.notes}</p>}
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
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">Assigned to You</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.assigned_at)}</p>
                    </div>
                  </div>
                )}

                {incident.responding_at && !updates.some(u => u.new_status === "RESPONDING") && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-orange-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">On The Way (OTW)</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.responding_at)}</p>
                    </div>
                  </div>
                )}

                {incident.resolved_at && !updates.some(u => u.new_status === "RESOLVED") && (
                  <div className="flex">
                    <div className="mr-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">Resolved</p>
                      <p className="text-xs text-gray-700">{formatDate(incident.resolved_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Resident Feedback Section - Show for resolved incidents */}
            {incident.status === "RESOLVED" && (
              <div className="mt-6">
                <IncidentFeedbackDisplay incidentId={incident.id} />
              </div>
            )}
          </div>
        </div>

        {/* Show error if any */}
        {error && (
          <div className="mt-4 p-4 border border-gray-300 bg-red-50 rounded-md text-red-700">
            <p className="flex items-center">
              <AlertTriangle size={20} className="mr-2" />
              {error}
            </p>
          </div>
        )}
        
        {/* Show success message */}
        {successMessage && (
          <div className="mt-4 p-4 border border-gray-300 bg-green-50 rounded-md text-green-700">
            <div className="flex flex-col">
              <p className="flex items-center">
                <CheckCircle size={20} className="mr-2" />
                {successMessage}
              </p>
              <div className="mt-3">
                <button
                  onClick={() => router.push('/volunteer/dashboard')}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </VolunteerLayout>
  )
}