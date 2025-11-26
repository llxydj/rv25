"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { supabase } from "@/lib/supabase"

interface ResidentStats {
  total: number
  active: number
  inactive: number
  barangayBreakdown: { name: string; count: number }[]
  activityBreakdown: { name: string; count: number }[]
}

export default function ResidentAnalyticsPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<ResidentStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch resident analytics data
  useEffect(() => {
    if (!user) return

    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        
        // Fetch all residents
        const { data: residents, error: residentsError } = await supabase
          .from("users")
          .select("*")
          .eq("role", "resident")
        
        if (residentsError) throw residentsError
        
        // Calculate total residents
        const total = residents.length
        
        // Calculate active/inactive residents
        const active = residents.filter(r => r.status !== "inactive").length
        const inactive = total - active
        
        // Calculate barangay breakdown
        const barangayMap: Record<string, number> = {}
        residents.forEach(resident => {
          const barangay = resident.barangay || "Unknown"
          barangayMap[barangay] = (barangayMap[barangay] || 0) + 1
        })
        
        const barangayBreakdown = Object.entries(barangayMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
        
        // Calculate activity breakdown (simplified)
        // In a real implementation, this would be based on actual incident reporting activity
        const activeResidents = residents.filter(r => r.status !== "inactive").length
        const inactiveResidents = total - activeResidents
        
        const activityBreakdown = [
          { name: "Active", count: activeResidents },
          { name: "Inactive", count: inactiveResidents }
        ]
        
        setStats({
          total,
          active,
          inactive,
          barangayBreakdown,
          activityBreakdown
        })
      } catch (error) {
        console.error("Error fetching analytics:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchAnalytics()
  }, [user])
  
  // Colors for charts
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]
  
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }
  
  if (!stats) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div>Error loading analytics</div>
        </div>
      </AdminLayout>
    )
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Resident Analytics</h1>
          <p className="text-muted-foreground">Insights and statistics about residents in the system</p>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Residents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Residents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
              <Badge variant="default" className="mt-2">
                {((stats.active / stats.total) * 100).toFixed(1)}%
              </Badge>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Residents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactive}</div>
              <Badge variant="destructive" className="mt-2">
                {((stats.inactive / stats.total) * 100).toFixed(1)}%
              </Badge>
            </CardContent>
          </Card>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Residents by Barangay */}
          <Card>
            <CardHeader>
              <CardTitle>Residents by Barangay</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.barangayBreakdown}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 40,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Residents" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Activity Level */}
          <Card>
            <CardHeader>
              <CardTitle>Resident Activity Level</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.activityBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.activityBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}