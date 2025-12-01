"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerIncidents } from "@/lib/incidents"
import { getVolunteerSchedules, getVolunteerUpcomingSchedules } from "@/lib/schedules"
import { 
  getVolunteerProfile, 
  updateVolunteerAvailability, 
  getVolunteerInformation, 
  getScheduledActivities,
  updateScheduledActivityResponse 
} from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MapComponent } from "@/components/ui/map-component"
import { supabase } from "@/lib/supabase"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { LocationTrackingToggle } from "@/components/volunteer/location-tracking-toggle"
import { PushNotificationToggle } from "@/components/push-notification-toggle"
import { PermissionRequestModal } from "@/components/permission-request-modal"

interface Schedule {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location: string;
  barangay: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';
  date?: string;
  time?: string;
  creator?: {
    first_name: string;
    last_name: string;
  };
}

interface Activity {
  id: string;
  title: string;
  date: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  description?: string;
}

// ✅ FIXED: Availability Toggle with Dark Mode Support
const AvailabilityToggle = ({ isAvailable, onToggle, disabled }: { isAvailable: boolean; onToggle: (checked: boolean) => void; disabled: boolean }) => {
  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => onToggle(!isAvailable)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900
          ${isAvailable ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
            ${isAvailable ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {isAvailable ? 'Available for Assignments' : 'Not Available'}
      </span>
    </div>
  )
}

export default function VolunteerDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [incidents, setIncidents] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)
  const [volunteerInfo, setVolunteerInfo] = useState<any>(null)

  // Handle availability toggle
  const handleAvailabilityToggle = async (checked: boolean) => {
    if (!user) return

    try {
      setUpdatingAvailability(true)
      const result = await updateVolunteerAvailability(user.id, checked)
      if (result.success) {
        setIsAvailable(checked)
        toast({
          title: checked ? "You are now available for assignments" : "You are now unavailable for assignments",
          variant: "default"
        })

        setProfile((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            volunteer_profiles: {
              ...(prev.volunteer_profiles || {}),
              is_available: checked
            }
          }
        })
      } else {
        throw new Error(result.message)
      }
    } catch (err: any) {
      console.error('Error updating availability:', err)
      toast({
        title: "Failed to update availability",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setUpdatingAvailability(false)
    }
  }

  // Handle scheduled activity response
  const handleActivityResponse = async (activityId: string, isAccepted: boolean) => {
    try {
      const result = await updateScheduledActivityResponse(activityId, isAccepted)
      if (result.success) {
        setSchedules(schedules.map(activity => 
          activity.activity_id === activityId 
            ? { ...activity, is_accepted: isAccepted, response_at: new Date().toISOString() }
            : activity
        ))
        toast({
          title: isAccepted ? "Activity accepted" : "Activity declined",
          description: isAccepted 
            ? "You have been scheduled for this activity" 
            : "You have declined this activity",
          variant: "default"
        })
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update response",
          variant: "destructive"
        })
      }
    } catch (err: any) {
      console.error('Error updating activity response:', err)
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  const forceRefreshData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('volunteer_profiles')
          .select('total_incidents_resolved')
          .eq('volunteer_user_id', user.id)
          .single();
        
        if (!profileError && profileData) {
          const resolvedCount = profileData?.total_incidents_resolved || 0;
          
          setProfile((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              volunteer_profiles: {
                ...(prev.volunteer_profiles || {}),
                total_incidents_resolved: resolvedCount
              }
            };
          });
        }
      } catch (profileError) {
        console.error("Profile query error:", profileError);
      }
      
      const incidentsResult = await getVolunteerIncidents(user.id);
      
      if (incidentsResult.success && incidentsResult.data) {
        const incidents = Array.isArray(incidentsResult.data) ? incidentsResult.data : [];
        setIncidents(incidents);
      }
      
      toast({
        title: "Dashboard refreshed",
        description: "Latest data loaded directly from database",
        variant: "default"
      });
    } catch (err) {
      console.error("Error in force refresh:", err);
      toast({
        title: "Error refreshing data",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      
      const quickLoad = async () => {
        try {
          const { data: basicProfile } = await supabase
            .from('users')
            .select('first_name, last_name, email')
            .eq('id', user.id)
            .single();
            
          if (basicProfile) {
            setProfile((prev: any) => ({
              ...prev,
              ...basicProfile
            }));
          }
        } catch (err) {
          console.error("Error in quick load:", err);
        } finally {
          setTimeout(() => {
            forceRefreshData();
          }, 100);
        }
      };
      
      quickLoad();
    }
  }, [user]);

  const handleRefreshClick = () => {
    forceRefreshData();
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const profileResult = await getVolunteerProfile(user.id)
        
        if (!profileResult.success) {
          if (profileResult.message?.includes("duplicate key") || 
              profileResult.message?.includes("volunteer_profiles_pkey")) {
            setError("Profile Setup Required: Your account has been created but needs to be activated by an administrator. Please wait for admin approval.")
          } else {
            setError(profileResult.message || "Failed to load profile")
          }
          setLoading(false)
          return
        }

        if (profileResult.data) {
          setProfile(profileResult.data)
          
          if (profileResult.data.volunteer_profiles?.status === "INACTIVE") {
            setError("Your account is pending activation. Please wait for an administrator to approve your account.")
            setLoading(false)
            return
          }
          
          setIsAvailable(profileResult.data.volunteer_profiles?.is_available || false)

          if (profileResult.data.volunteer_profiles) {
            await supabase
              .from('volunteer_profiles')
              .update({ last_active: new Date().toISOString() })
              .eq('volunteer_user_id', user.id)

            const incidentsResult = await getVolunteerIncidents(user.id)
            if (incidentsResult.success) {
              setIncidents(incidentsResult.data || [])
            } else {
              setIncidents([])
            }

            const infoResult = await getVolunteerInformation(user.id)
            if (infoResult.success) {
              setVolunteerInfo(infoResult.data)
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading volunteer dashboard:', err)
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  useEffect(() => {
    const fetchLatestData = async () => {
      if (!user) return
      
      try {
        if (typeof window !== 'undefined') {
          const { data, error } = await supabase
            .from('volunteer_profiles')
            .select('total_incidents_resolved, is_available')
            .eq('volunteer_user_id', user.id)
            .single()
            
          if (!error && data) {
            setProfile((prev: any) => {
              if (!prev) return null
              return {
                ...prev,
                volunteer_profiles: {
                  ...(prev.volunteer_profiles || {}),
                  total_incidents_resolved: data.total_incidents_resolved,
                  is_available: data.is_available
                }
              }
            })
          }
        }
        
        const incidentsResult = await getVolunteerIncidents(user.id)
        if (incidentsResult.success && incidentsResult.data) {
          setIncidents(Array.isArray(incidentsResult.data) ? incidentsResult.data : [])
        }
      } catch (err) {
        console.error("Error refreshing dashboard data:", err)
      }
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLatestData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', fetchLatestData)
    
    fetchLatestData()
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', fetchLatestData)
    }
  }, [user])

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user) return

      try {
        setLoading(true)
        const result = await getVolunteerUpcomingSchedules(user.id)
        
        if (!result.success) {
          throw new Error(result.message)
        }

        setSchedules(result.data || [])
      } catch (err: any) {
        setError(err.message || "Failed to fetch schedules")
      } finally {
        setLoading(false)
      }
    }

    fetchSchedules()
  }, [user])

  const mapMarkers = incidents
    .filter((incident) => incident.location_lat && incident.location_lng)
    .map((incident) => ({
      id: incident.id,
      position: [incident.location_lat, incident.location_lng] as [number, number],
      status: incident.status,
      title: incident.incident_type,
      description: incident.description,
    }))

  const assignedCount = incidents.filter((i) => i.status === "ASSIGNED").length
  const respondingCount = incidents.filter((i) => i.status === "RESPONDING").length
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length

  const today = new Date().toISOString().split("T")[0]
  const todaySchedules = schedules.filter((s) => s.start_time && s.start_time.startsWith(today))

  const ActivityStatus = () => {
    if (!profile?.volunteer_profiles?.last_active) return null;

    const lastActive = new Date(profile.volunteer_profiles.last_active);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    let statusColor = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    let statusText = 'Active';

    if (diffDays > 30) {
      statusColor = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      statusText = 'Inactive';
    } else if (diffDays > 7) {
      statusColor = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      statusText = 'Away';
    }

    return (
      <div className="flex items-center space-x-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {statusText}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Last active: {formatTimeAgo(lastActive)}
        </span>
      </div>
    );
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <VolunteerLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </VolunteerLayout>
    )
  }

  if (error) {
    return (
      <VolunteerLayout>
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 my-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400 dark:text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Profile Setup Required
              </h3>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                <p>{error}</p>
                <p className="mt-2">
                  Please wait for an administrator to activate your account. Once activated,
                  you will be able to access the volunteer dashboard and start accepting assignments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </VolunteerLayout>
    )
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        {/* ✅ FIXED: Header with Dark Mode */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1">Welcome back, {profile?.first_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <Link
              href="/volunteer/report"
              className="px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded transition-colors"
            >
              Report Incident
            </Link>
            <button 
              onClick={handleRefreshClick}
              className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded transition-colors"
            >
              Refresh Data
            </button>
            <AvailabilityToggle
              isAvailable={isAvailable}
              onToggle={handleAvailabilityToggle}
              disabled={updatingAvailability}
            />
          </div>
        </div>

        {/* ✅ FIXED: Scheduled Activities with Dark Mode */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Scheduled Activities</h2>
          {schedules.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No scheduled activities</p>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule: Schedule) => (
                <div 
                  key={schedule.id} 
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{schedule.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {schedule.date ? new Date(schedule.date).toLocaleDateString() : 
                         new Date(schedule.start_time).toLocaleDateString()}
                        {schedule.time && ` at ${schedule.time}`}
                      </p>
                      {schedule.location && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Location: {schedule.location}
                        </p>
                      )}
                    </div>
                    <span 
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        schedule.status === 'PENDING'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                          : schedule.status === 'ACCEPTED'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : schedule.status === 'DECLINED'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      }`}
                    >
                      {schedule.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Loading dashboard data..." />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 dark:border-red-600 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Location Tracking & Push Notifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <LocationTrackingToggle />
              <PushNotificationToggle />
            </div>

            {/* ✅ FIXED: Stats Cards with Dark Mode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Assigned Incidents</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assignedCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <div className="h-6 w-6">🔔</div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Responding</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{respondingCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {profile?.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                    {process.env.NODE_ENV !== 'production' && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Count from DB: {profile?.volunteer_profiles?.total_incidents_resolved || '0'} 
                        <br />Local count: {resolvedCount || '0'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ FIXED: Incidents and Activities Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Assigned Incidents</h2>
                {incidents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">You don't have any assigned incidents at the moment.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                      {incidents.slice(0, 5).map((incident) => (
                        <div
                          key={incident.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors touch-manipulation"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{incident.incident_type}</h3>
                            </div>
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full flex-shrink-0 ml-2 ${
                                incident.status === "ASSIGNED"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                  : incident.status === "RESPONDING"
                                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                                    : incident.status === "RESOLVED"
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                      : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                              }`}
                            >
                              {incident.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            <div>Date: {new Date(incident.created_at).toLocaleDateString()}</div>
                            <div>Location: {incident.barangay}</div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <Link
                              href={`/volunteer/incident/${incident.id}`}
                              className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 touch-manipulation inline-block"
                            >
                              View Details →
                            </Link>
                          </div>
                        </div>
                      ))}
                      {incidents.length > 5 && (
                        <div className="text-center pt-2">
                          <Link
                            href="/volunteer/incidents"
                            className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300"
                          >
                            View all {incidents.length} incidents →
                          </Link>
                        </div>
                      )}
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th
                              scope="col"
                              className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Type
                            </th>
                            <th
                              scope="col"
                              className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Date
                            </th>
                            <th
                              scope="col"
                              className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Status
                            </th>
                            <th
                              scope="col"
                              className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              Location
                            </th>
                            <th scope="col" className="relative px-4 lg:px-6 py-3">
                              <span className="sr-only">View</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {incidents.slice(0, 5).map((incident) => (
                            <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{incident.incident_type}</div>
                              </td>
                              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(incident.created_at).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    incident.status === "ASSIGNED"
                                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                      : incident.status === "RESPONDING"
                                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                                        : incident.status === "RESOLVED"
                                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                          : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                                  }`}
                                >
                                  {incident.status}
                                </span>
                              </td>
                              <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{incident.barangay}</td>
                              <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Link
                                  href={`/volunteer/incident/${incident.id}`}
                                  className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 touch-manipulation"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {incidents.length > 5 && (
                        <div className="mt-4 text-center">
                          <Link
                            href="/volunteer/incidents"
                            className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300"
                          >
                            View all {incidents.length} incidents
                          </Link>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Upcoming Activities</h2>
                </div>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" text="Loading activities..." />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 text-gray-500 dark:text-gray-400">📅</div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No upcoming activities</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      You don't have any activities scheduled at the moment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((schedule: Schedule) => (
                      <div
                        key={schedule.id}
                        className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{schedule.title}</h3>
                          {schedule.description && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{schedule.description}</p>
                          )}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <div className="mr-1.5 h-4 w-4">📅</div>
                              {new Date(schedule.start_time).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <div className="mr-1.5 h-4 w-4">🕒</div>
                              {new Date(schedule.start_time).toLocaleTimeString()} -{" "}
                              {new Date(schedule.end_time).toLocaleTimeString()}
                            </div>
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <div className="mr-1.5 h-4 w-4">📍</div>
                              {schedule.location}, {schedule.barangay}
                            </div>
                          </div>
                          {schedule.creator && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              Scheduled by: {schedule.creator.first_name} {schedule.creator.last_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Incident Map</h2>
              <MapComponent markers={mapMarkers} height="400px" showBoundary={true} />
            </div>
          </>
        )}
      </div>
      
      {/* Permission Request Modal - shows once per user */}
      <PermissionRequestModal />
    </VolunteerLayout>
  )
}