'use client';

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Bell, Trash2, AlertTriangle, CheckCircle, Clock, Star, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

// Define user types
type UserRole = "admin" | "volunteer" | "resident" | "barangay"

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  barangay: string | null
  phone_number: string | null
  address: string | null
  created_at: string
  status: "active" | "inactive"
}

interface Incident {
  id: string
  incident_type: string
  description: string
  location_lat: number
  location_lng: number
  address: string | null
  barangay: string
  status: string | null
  priority: number | null
  created_at: string | null
  resolved_at: string | null
}

export default function UserDetailsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [userData, setUserData] = useState<User | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

  // Fetch user data and incidents
  useEffect(() => {
    if (!user || !params.id) return

    const fetchUserData = async () => {
      try {
        setLoading(true)
        
        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", params.id)
          .single()
        
        if (userError) throw userError
        
        // Fix TypeScript issues by explicitly typing the userData
        const typedUserData: any = userData;
        
        const userObj: User = {
          id: typedUserData.id,
          email: typedUserData.email,
          first_name: typedUserData.first_name,
          last_name: typedUserData.last_name,
          role: typedUserData.role,
          barangay: typedUserData.barangay,
          phone_number: typedUserData.phone_number,
          address: typedUserData.address,
          created_at: typedUserData.created_at,
          status: typedUserData.status || "active"
        }
        
        setUserData(userObj)
        
        // Fetch incidents based on role
        if (userObj.role === "resident") {
          const { data: incidentsData, error: incidentsError } = await supabase
            .from("incidents")
            .select("*")
            .eq("reporter_id", params.id)
            .order("created_at", { ascending: false })
          
          if (incidentsError) throw incidentsError
          
          setIncidents((incidentsData || []).map(incident => ({
            ...incident,
            status: incident.status ?? 'PENDING',
            priority: incident.priority ?? 3,
            created_at: incident.created_at ?? new Date().toISOString()
          })))
        } else if (userObj.role === "volunteer") {
          const { data: incidentsData, error: incidentsError } = await supabase
            .from("incidents")
            .select("*")
            .eq("assigned_to", params.id)
            .order("created_at", { ascending: false })
          
          if (incidentsError) throw incidentsError
          
          setIncidents((incidentsData || []).map(incident => ({
            ...incident,
            status: incident.status ?? 'PENDING',
            priority: incident.priority ?? 3,
            created_at: incident.created_at ?? new Date().toISOString()
          })))
        }

        // Fetch statistics
        const statsData: any = {
          totalIncidents: 0,
          resolvedIncidents: 0,
          pendingIncidents: 0,
          averageResponseTime: null,
          feedbackCount: 0,
          averageRating: null
        }

        if (userObj.role === "resident") {
          const { data: incidentsData } = await supabase
            .from("incidents")
            .select("id, status, created_at, assigned_at, resolved_at")
            .eq("reporter_id", params.id)

          if (incidentsData) {
            statsData.totalIncidents = incidentsData.length
            statsData.resolvedIncidents = incidentsData.filter((i: any) => i.status === "RESOLVED").length
            statsData.pendingIncidents = incidentsData.filter((i: any) => i.status === "PENDING" || i.status === "ASSIGNED").length

            // Calculate average response time (time from creation to assignment)
            const responseTimes = incidentsData
              .filter((i: any) => i.assigned_at && i.created_at)
              .map((i: any) => new Date(i.assigned_at).getTime() - new Date(i.created_at).getTime())
            
            if (responseTimes.length > 0) {
              const avgMs = responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
              statsData.averageResponseTime = Math.round(avgMs / 1000 / 60) // minutes
            }

            // Fetch feedback count
            const { data: feedbackData } = await supabase
              .from("incident_feedback")
              .select("rating")
              .in("incident_id", incidentsData.map((i: any) => i.id))

            if (feedbackData) {
              statsData.feedbackCount = feedbackData.length
              if (feedbackData.length > 0) {
                const avgRating = feedbackData.reduce((sum: number, f: any) => sum + f.rating, 0) / feedbackData.length
                statsData.averageRating = avgRating.toFixed(1)
              }
            }
          }
        } else if (userObj.role === "volunteer") {
          const { data: incidentsData } = await supabase
            .from("incidents")
            .select("id, status, created_at, assigned_at, resolved_at, responding_at")
            .eq("assigned_to", params.id)

          if (incidentsData) {
            statsData.totalIncidents = incidentsData.length
            statsData.resolvedIncidents = incidentsData.filter((i: any) => i.status === "RESOLVED").length
            statsData.pendingIncidents = incidentsData.filter((i: any) => i.status === "PENDING" || i.status === "ASSIGNED" || i.status === "RESPONDING").length

            // Calculate average response time (time from assignment to responding)
            const responseTimes = incidentsData
              .filter((i: any) => i.responding_at && i.assigned_at)
              .map((i: any) => new Date(i.responding_at).getTime() - new Date(i.assigned_at).getTime())
            
            if (responseTimes.length > 0) {
              const avgMs = responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
              statsData.averageResponseTime = Math.round(avgMs / 1000 / 60) // minutes
            }

            // Fetch feedback for incidents assigned to this volunteer
            const { data: feedbackData } = await supabase
              .from("incident_feedback")
              .select("rating")
              .in("incident_id", incidentsData.map((i: any) => i.id))

            if (feedbackData) {
              statsData.feedbackCount = feedbackData.length
              if (feedbackData.length > 0) {
                const avgRating = feedbackData.reduce((sum: number, f: any) => sum + f.rating, 0) / feedbackData.length
                statsData.averageRating = avgRating.toFixed(1)
              }
            }
          }
        }

        setStats(statsData)
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserData()
  }, [user, params.id])
  
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }
  
  if (!userData) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div>User not found</div>
        </div>
      </AdminLayout>
    )
  }
  
  // Handle deactivate user
  const handleDeactivateUser = async () => {
    if (!userData) return;
    
    if (window.confirm(`Are you sure you want to deactivate user ${userData.first_name} ${userData.last_name}? They will no longer be able to access the system.`)) {
      try {
        const response = await fetch("/api/admin/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: userData.id,
            action: "deactivate"
          })
        });
        
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        
        // Update local state
        setUserData({
          ...userData,
          status: "inactive"
        });
        
        // Show success message
        alert("User deactivated successfully");
      } catch (error: any) {
        console.error("Error deactivating user:", error);
        alert("Failed to deactivate user: " + (error.message || "Unknown error"));
      }
    }
  };
  
  // Handle activate user
  const handleActivateUser = async () => {
    if (!userData) return;
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: userData.id,
          action: "activate"
        })
      });
      
      const result = await response.json();
      
      if (!result.success) throw new Error(result.message);
      
      // Update local state
      setUserData({
        ...userData,
        status: "active"
      });
      
      // Show success message
      alert("User activated successfully");
    } catch (error: any) {
      console.error("Error activating user:", error);
      alert("Failed to activate user: " + (error.message || "Unknown error"));
    }
  };
  
  // Handle delete user
  const handleDeleteUser = async () => {
    if (!userData) return;
    
    if (window.confirm(`Are you sure you want to deactivate and anonymize user ${userData.first_name} ${userData.last_name}? This action cannot be undone.`)) {
      try {
        const response = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: userData.id
          })
        });
        
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        
        // Show success message and redirect
        alert("User deactivated and data anonymized successfully");
        router.push("/admin/users");
      } catch (error: any) {
        console.error("Error deleting user:", error);
        alert("Failed to delete user: " + (error.message || "Unknown error"));
      }
    }
  };
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-black">User Details</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center">
                  <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 flex items-center justify-center mb-4">
                    <User className="h-8 w-8 text-gray-500" />
                  </div>
                  <h2 className="text-xl font-semibold">
                    {userData.first_name} {userData.last_name}
                  </h2>
                  <Badge variant={
                    userData.role === "admin" ? "default" :
                    userData.role === "volunteer" ? "secondary" :
                    userData.role === "barangay" ? "outline" : "destructive"
                  }>
                    {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                  </Badge>
                  <Badge variant={userData.status === "active" ? "default" : "destructive"} className="mt-2">
                    {userData.status.charAt(0).toUpperCase() + userData.status.slice(1)}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">{userData.email}</span>
                  </div>
                  
                  {userData.phone_number && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">{userData.phone_number}</span>
                    </div>
                  )}
                  
                  {userData.address && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">{userData.address}</span>
                    </div>
                  )}
                  
                  {userData.barangay && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">{userData.barangay}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">
                      Joined {new Date(userData.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {userData.role === "resident" && (
                    <div className="flex items-center">
                      <Bell className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">
                        {incidents.length} incident{incidents.length !== 1 ? 's' : ''} reported
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Statistics Card */}
            {stats && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalIncidents}</div>
                      <div className="text-xs text-gray-600 mt-1">Total {userData.role === "resident" ? "Reported" : "Assigned"}</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{stats.resolvedIncidents}</div>
                      <div className="text-xs text-gray-600 mt-1">Resolved</div>
                    </div>
                    {stats.averageResponseTime !== null && (
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{stats.averageResponseTime}</div>
                        <div className="text-xs text-gray-600 mt-1">Avg Response (min)</div>
                      </div>
                    )}
                    {stats.feedbackCount > 0 && (
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{stats.feedbackCount}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Feedback {stats.averageRating && `(${stats.averageRating}★)`}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* User Actions Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>User Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  {userData.status === "active" ? (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleDeactivateUser}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Deactivate User
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleActivateUser}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Activate User
                    </Button>
                  )}
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={handleDeleteUser}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete User
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Incident History Card */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {userData.role === "resident" ? "Incident History" : "Activity Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userData.role === "resident" ? (
                  <div className="space-y-4">
                    {incidents.length > 0 ? (
                      <div className="space-y-3">
                        {incidents.map((incident) => (
                          <div key={incident.id} className="border rounded-lg p-4">
                            <div className="flex justify-between">
                              <h3 className="font-medium">{incident.incident_type}</h3>
                              <Badge variant={
                                incident.status === "RESOLVED" ? "default" :
                                incident.status === "ASSIGNED" ? "secondary" :
                                "outline"
                              }>
                                {incident.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {incident.description}
                            </p>
                            <div className="flex justify-between mt-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(incident.created_at).toLocaleString()}
                              </span>
                              {incident.barangay && (
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {incident.barangay}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No incidents reported
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {userData.role === "volunteer" 
                      ? "Volunteer activity history will be shown here" 
                      : "Activity summary will be shown here"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}