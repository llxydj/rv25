"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Activity } from "lucide-react"
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
  status: string
  priority: number
  created_at: string
  resolved_at: string | null
}

export default function UserDetailsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [userData, setUserData] = useState<User | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

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
        
        setUserData({
          id: userData.id,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
          barangay: userData.barangay,
          phone_number: userData.phone_number,
          address: userData.address,
          created_at: userData.created_at,
          status: userData.status || "active"
        })
        
        // Fetch incidents if user is resident
        if (userData.role === "resident") {
          const { data: incidentsData, error: incidentsError } = await supabase
            .from("incidents")
            .select("*")
            .eq("reporter_id", params.id)
            .order("created_at", { ascending: false })
          
          if (incidentsError) throw incidentsError
          
          setIncidents(incidentsData || [])
        }
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
                      <Activity className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">
                        {incidents.length} incident{incidents.length !== 1 ? 's' : ''} reported
                      </span>
                    </div>
                  )}
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