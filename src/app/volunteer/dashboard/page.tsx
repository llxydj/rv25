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
import { getVolunteerSchedules, getVolunteerUpcomingSchedules } from "@/src/lib/schedules"
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
import { PinPad } from "@/components/pin-pad"
import { useRouter } from "next/navigation"

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

// Add a new component for the availability toggle
const AvailabilityToggle = ({ isAvailable, onToggle, disabled }: { isAvailable: boolean; onToggle: (checked: boolean) => void; disabled: boolean }) => {
  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => onToggle(!isAvailable)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
          ${isAvailable ? 'bg-green-600' : 'bg-gray-200'}
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
      <span className="text-sm font-medium text-gray-900">
        {isAvailable ? 'Available for Assignments' : 'Not Available'}
      </span>
    </div>
  )
}

export default function VolunteerDashboard() {
  const { user, requiresPin, pinVerified, verifyPin, checkHasPin } = useAuth()
  const { toast } = useToast()
  const [incidents, setIncidents] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)
  const [volunteerInfo, setVolunteerInfo] = useState<any>(null)
  const [pinError, setPinError] = useState("")
  const [pinAttempts, setPinAttempts] = useState(0)
  const router = useRouter()

  // Check if user needs to set up or verify PIN
  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // If user doesn't require PIN (shouldn't happen for volunteer), redirect appropriately
    if (!requiresPin) {
      // This shouldn't happen for volunteer users, but just in case
      router.push('/')
      return
    }

    // Check if user has a PIN
    const initializePinCheck = async () => {
      const hasPin = await checkHasPin()
      if (!hasPin) {
        // Redirect to PIN setup if no PIN is set
        router.push('/pin-setup')
      }
    }

    initializePinCheck()
  }, [user, requiresPin, router, checkHasPin])

  // Handle PIN verification
  const handlePinVerify = async (pin: string) => {
    if (!user) return
    
    setPinError("")
    
    try {
      const isValid = await verifyPin(pin)
      if (!isValid) {
        const newAttempts = pinAttempts + 1
        setPinAttempts(newAttempts)
        
        if (newAttempts >= 3) {
          // Sign out user after 3 failed attempts
          alert('Too many failed attempts. You have been logged out.')
          router.push('/login')
        } else {
          setPinError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`)
        }
      }
    } catch (err) {
      setPinError('An error occurred. Please try again.')
    }
  }

  const clearPinError = () => {
    setPinError("")
  }

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

        // Update profile state with null check
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
        // Update local state
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

  // Add a more aggressive reload function that bypasses all caches
  const forceRefreshData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get the current count from volunteer_profiles
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('volunteer_profiles')
          .select('total_incidents_resolved')
          .eq('volunteer_user_id', user.id)
          .single();
        
        console.log("Profile query result:", profileData);
        
        if (!profileError && profileData) {
          const resolvedCount = profileData?.total_incidents_resolved || 0;
          
          console.log("Setting resolved count from database:", resolvedCount);
          
          // Update profile state with database result
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
      } catch (profileQueryError) {
        console.error("Error querying profile:", profileQueryError);
      }

      // Refresh all data
      const [incidentsResult, schedulesResult, profileResult, infoResult] = await Promise.all([
        getVolunteerIncidents(user.id),
        getVolunteerSchedules(user.id),
        getVolunteerProfile(user.id),
        getVolunteerInformation(user.id)
      ]);

      if (incidentsResult?.success) {
        setIncidents(incidentsResult.data || []);
      }
      
      if (schedulesResult?.success) {
        setSchedules(schedulesResult.data || []);
      }
      
      if (profileResult?.success) {
        setProfile(profileResult.data);
        setIsAvailable(profileResult.data?.volunteer_profiles?.is_available ?? false);
      }
      
      if (infoResult?.success) {
        setVolunteerInfo(infoResult.data);
      }
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    // Only fetch data if PIN is verified
    if (pinVerified) {
      forceRefreshData();
    }
  }, [pinVerified]);

  // Real-time subscription for incidents
  useEffect(() => {
    if (!user || !pinVerified) return;

    const subscription = supabase
      .channel('incidents')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents',
        },
        (payload) => {
          console.log('New incident:', payload.new);
          // Refresh incidents when a new one is added
          forceRefreshData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incidents',
        },
        (payload) => {
          console.log('Incident updated:', payload.new);
          // Refresh incidents when one is updated
          forceRefreshData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, pinVerified]);

  // Show PIN verification if required and not yet verified
  if (requiresPin && !pinVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Volunteer Dashboard</h1>
            <p className="text-gray-600 mt-2">Enter your PIN to access the dashboard</p>
          </div>
          
          <PinPad 
            onPinComplete={handlePinVerify} 
            title="Enter Volunteer PIN"
            error={pinError}
            clearError={clearPinError}
          />
          
          <div className="mt-6 text-center">
            <button 
              onClick={() => router.push('/login')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Use Different Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Add button click handler
  const handleRefreshClick = () => {
    forceRefreshData();
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        // Fetch volunteer profile first
        const profileResult = await getVolunteerProfile(user.id)
        
        if (!profileResult.success) {
          if (profileResult.message?.includes("duplicate key") || 
              profileResult.message?.includes("volunteer_profiles_pkey")) {
            // This is the specific error we're handling
            setError("Profile Setup Required: Your account has been created but needs to be activated by an administrator. Please wait for admin approval.")
          } else {
            setError(profileResult.message || "Failed to load profile")
          }
          setLoading(false)
          return
        }

        if (profileResult.data) {
          setProfile(profileResult.data)
          
          // Check if profile status is inactive
          if (profileResult.data.volunteer_profiles?.status === "INACTIVE") {
            setError("Your account is pending activation. Please wait for an administrator to approve your account.")
            setLoading(false)
            return
          }
          
          setIsAvailable(profileResult.data.volunteer_profiles?.is_available || false)

          // Only fetch other data if we have a valid profile
          if (profileResult.data.volunteer_profiles) {
            // Update last_active timestamp
            await supabase
              .from('volunteer_profiles')
              .update({ last_active: new Date().toISOString() })
              .eq('volunteer_user_id', user.id)

            // Fetch assigned incidents
            const incidentsResult = await getVolunteerIncidents(user.id)
            console.log("Volunteer incidents result:", {
              success: incidentsResult.success,
              count: incidentsResult.data?.length || 0
            })
            if (incidentsResult.success) {
              setIncidents(incidentsResult.data || [])
            } else {
              console.error("Failed to fetch incidents:", incidentsResult.message)
              // Don't fail completely, just set empty incidents
              setIncidents([])
            }

            // Fetch volunteer information
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

  // Add a new useEffect to refresh data when component is focused or remounted
  useEffect(() => {
    const fetchLatestData = async () => {
      if (!user) return
      
      try {
        console.log("Refreshing dashboard data for user:", user.id)
        
        // Force a direct database query for the most up-to-date profile data
        if (typeof window !== 'undefined') {
          // Only run on client side
          console.log("Fetching fresh profile data from database...")
          
          // Get the latest total_incidents_resolved directly from the database
          const { data, error } = await supabase
            .from('volunteer_profiles')
            .select('total_incidents_resolved, is_available')
            .eq('volunteer_user_id', user.id)
            .single()
            
          if (error) {
            console.error("Error fetching volunteer profile:", error)
          } else {
            console.log("Fresh profile data:", data)
            // Update the profile with the latest data
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
        
        // Also refresh incidents to get latest statuses
        const incidentsResult = await getVolunteerIncidents(user.id)
        if (incidentsResult.success) {
          console.log("Updated incidents:", incidentsResult.data)
          setIncidents(incidentsResult.data || [])
        }
      } catch (err) {
        console.error("Error refreshing dashboard data:", err)
      }
    }
    
    // Add event listener for when the page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLatestData()
      }
    }
    
    // Set up listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', fetchLatestData)
    
    // Call once on mount to ensure fresh data
    fetchLatestData()
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', fetchLatestData)
    }
  }, [user]) // Only depends on user

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

  // Format incidents for map markers
  const mapMarkers = incidents.map((incident) => ({
    id: incident.id,
    position: [incident.location_lat, incident.location_lng] as [number, number],
    status: incident.status,
    title: incident.incident_type,
    description: incident.description,
  }))

  // Get status counts
  const assignedCount = incidents.filter((i) => i.status === "ASSIGNED").length
  const respondingCount = incidents.filter((i) => i.status === "RESPONDING").length
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length
  
  // Debug status counts
  console.log("Incident stats:", {
    total: incidents.length,
    assigned: assignedCount,
    responding: respondingCount,
    resolved: resolvedCount,
    profileResolved: profile?.volunteer_profiles?.total_incidents_resolved || 0
  })

  // Get today's schedules
  const today = new Date().toISOString().split("T")[0]
  const todaySchedules = schedules.filter((s) => s.start_time.startsWith(today))

  // Add activity status indicator component
  const ActivityStatus = () => {
    if (!profile?.volunteer_profiles?.last_active) return null;

    const lastActive = new Date(profile.volunteer_profiles.last_active);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    let statusColor = 'bg-green-100 text-green-800';
    let statusText = 'Active';

    if (diffDays > 30) {
      statusColor = 'bg-red-100 text-red-800';
      statusText = 'Inactive';
    } else if (diffDays > 7) {
      statusColor = 'bg-yellow-100 text-yellow-800';
      statusText = 'Away';
    }

    return (
      <div className="flex items-center space-x-2">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {statusText}
        </span>
        <span className="text-sm text-gray-500">
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
        <div className="rounded-md bg-red-50 p-4 my-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-900">
                Profile Setup Required
              </h3>
              <div className="mt-2 text-sm text-gray-700">
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-700 mt-1">Welcome back, {profile?.first_name}</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-4">
            <Link
              href="/volunteer/report"
              className="px-3 py-2 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Report Incident
            </Link>
            <button 
              onClick={handleRefreshClick}
              className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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

        {/* Scheduled Activities Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Scheduled Activities</h2>
          {schedules.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No scheduled activities</p>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule: Schedule) => (
                <div 
                  key={schedule.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium">{schedule.title}</h3>
                      <p className="text-sm text-gray-500">
                        {schedule.date ? new Date(schedule.date).toLocaleDateString() : 
                         new Date(schedule.start_time).toLocaleDateString()}
                        {schedule.time && ` at ${schedule.time}`}
                      </p>
                      {schedule.location && (
                        <p className="text-sm text-gray-500">
                          Location: {schedule.location}
                        </p>
                      )}
                    </div>
                    <span 
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        schedule.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : schedule.status === 'ACCEPTED'
                          ? 'bg-green-100 text-green-800'
                          : schedule.status === 'DECLINED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
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
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Assigned Incidents</p>
                    <p className="text-2xl font-bold text-black">{assignedCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <div className="h-6 w-6">🔔</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Responding</p>
                    <p className="text-2xl font-bold text-black">{respondingCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Resolved</p>
                    <p className="text-2xl font-bold text-black">
                      {profile?.volunteer_profiles?.total_incidents_resolved || 0}
                    </p>
                    {/* Debug information - helps show the actual value */}
                    {process.env.NODE_ENV !== 'production' && (
                      <p className="text-xs text-gray-400">
                        Count from DB: {profile?.volunteer_profiles?.total_incidents_resolved || '0'} 
                        <br />Local count: {resolvedCount || '0'}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-full bg-green-100 text-green-600">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-4">Assigned Incidents</h2>
                {incidents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">You don't have any assigned incidents at the moment.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Type
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Date
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Status
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Location
                          </th>
                          <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">View</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {incidents.slice(0, 5).map((incident) => (
                          <tr key={incident.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{incident.incident_type}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {new Date(incident.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  incident.status === "ASSIGNED"
                                    ? "bg-blue-100 text-blue-800"
                                    : incident.status === "RESPONDING"
                                      ? "bg-orange-100 text-orange-800"
                                      : incident.status === "RESOLVED"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {incident.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{incident.barangay}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link
                                href={`/volunteer/incident/${incident.id}`}
                                className="text-green-600 hover:text-green-900"
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
                          className="text-sm font-medium text-green-600 hover:text-green-500"
                        >
                          View all {incidents.length} incidents
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Your Upcoming Activities</h2>
                </div>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" text="Loading activities..." />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 text-gray-400">📅</div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming activities</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      You don't have any activities scheduled at the moment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((schedule: Schedule) => (
                      <div
                        key={schedule.id}
                        className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{schedule.title}</h3>
                          {schedule.description && (
                            <p className="mt-1 text-sm text-gray-500">{schedule.description}</p>
                          )}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center text-sm text-gray-500">
                              <div className="mr-1.5 h-4 w-4">📅</div>
                              {new Date(schedule.start_time).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <div className="mr-1.5 h-4 w-4">🕒</div>
                              {new Date(schedule.start_time).toLocaleTimeString()} -{" "}
                              {new Date(schedule.end_time).toLocaleTimeString()}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <div className="mr-1.5 h-4 w-4">📍</div>
                              {schedule.location}, {schedule.barangay}
                            </div>
                          </div>
                          {schedule.creator && (
                            <p className="mt-2 text-sm text-gray-500">
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

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">Incident Map</h2>
              <MapComponent markers={mapMarkers} height="400px" />
            </div>
          </>
        )}
      </div>
    </VolunteerLayout>
  )
}
