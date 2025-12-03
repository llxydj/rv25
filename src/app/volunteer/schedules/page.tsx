"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerSchedules } from "@/lib/schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertTriangle, Calendar, Filter } from "lucide-react"
import { ScheduleCard } from "@/components/volunteer/schedule-card"

export default function VolunteerSchedulesPage() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<any[]>([])
  const [filteredSchedules, setFilteredSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<string>("ALL")

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user) return

      try {
        setLoading(true)
        console.log("Fetching schedules for user:", user.id);
        
        const result = await getVolunteerSchedules(user.id)
        console.log("Schedule fetch result:", result);
        
        if (!result) {
          setError("Failed to get a response from the server")
          return
        }

        if (result.success) {
          console.log("Successfully fetched schedules:", result.data);
          setSchedules(result.data || [])
          setFilteredSchedules(result.data || [])
        } else {
          console.error("Error in schedule response:", result.message);
          setError(result.message || "Failed to fetch schedules")
        }
      } catch (err: any) {
        console.error("Error fetching schedules:", err);
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) {
      fetchSchedules()
    }
    
    // Add a timeout to prevent infinite loading state
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Loading timed out after 20 seconds");
        setLoading(false)
        setError("Loading timed out. Please refresh the page.")
      }
    }, 20000) // 20 seconds timeout
    
    return () => clearTimeout(loadingTimeout)
  }, [user])

  // Apply filters when schedules or dateFilter changes
  useEffect(() => {
    // Skip filtering if schedules aren't loaded yet
    if (!schedules.length) return;
    
    let filtered = [...schedules];
    
    if (dateFilter === "TODAY") {
      const today = new Date().toISOString().split("T")[0]
      filtered = filtered.filter((schedule) => schedule.start_time.startsWith(today))
    } else if (dateFilter === "UPCOMING") {
      const now = new Date().toISOString()
      filtered = filtered.filter((schedule) => schedule.start_time > now)
    } else if (dateFilter === "PAST") {
      const now = new Date().toISOString()
      filtered = filtered.filter((schedule) => schedule.end_time < now)
    }
    
    setFilteredSchedules(filtered)
  }, [schedules, dateFilter])

  const refreshSchedules = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const result = await getVolunteerSchedules(user.id)
      
      if (result.success) {
        setSchedules(result.data || [])
        setFilteredSchedules(result.data || [])
      }
    } catch (err: any) {
      console.error("Error refreshing schedules:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Your Schedules</h1>
            <p className="text-gray-600 mt-1">View your assigned schedules and activities</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm text-black"
              >
                <option value="ALL">All Schedules</option>
                <option value="TODAY">Today</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="PAST">Past</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Loading schedules..." />
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
        ) : filteredSchedules.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-6 text-center">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-black">No schedules found</h3>
              <p className="mt-1 text-sm text-gray-700">
                {dateFilter === "ALL"
                  ? "You don't have any schedules assigned to you yet."
                  : dateFilter === "TODAY"
                  ? "You don't have any schedules for today."
                  : dateFilter === "UPCOMING"
                  ? "You don't have any upcoming schedules."
                  : "You don't have any past schedules."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredSchedules.map((schedule) => (
              <ScheduleCard 
                key={schedule.id} 
                schedule={schedule}
                onResponse={refreshSchedules}
              />
            ))}
          </div>
        )}
      </div>
    </VolunteerLayout>
  )
} 