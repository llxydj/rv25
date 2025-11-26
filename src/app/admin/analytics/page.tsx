"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/lib/auth"
import { getVolunteerMetrics, getVolunteerPerformance } from "@/lib/volunteers"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { 
  Users, 
  CheckCircle, 
  Calendar as CalendarIcon, 
  AlertTriangle 
} from "lucide-react"

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [perf, setPerf] = useState<any[]>([])
  const [filters, setFilters] = useState({ start: '', end: '', type: '', barangay: '' })

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        setLoading(true)
        const result = await getVolunteerMetrics(user.id)
        if (result.success) {
          setMetrics(result.data)
        } else {
          setError(result.message || "Failed to fetch metrics")
        }

        const perfRes = await getVolunteerPerformance()
        if (perfRes.success) setPerf(perfRes.data || [])
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  if (!user || user.role !== "admin") {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-red-500">You don't have permission to view this page.</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Volunteer & Incident Analytics</h1>
            <p className="text-gray-600 mt-1">Overview with filters, trends and export</p>
          </div>
          <div className="flex gap-2">
            <input className="border rounded px-2 py-1 text-sm text-gray-900" type="date" value={filters.start} onChange={(e)=>setFilters(f=>({...f,start:e.target.value}))} />
            <input className="border rounded px-2 py-1 text-sm text-gray-900" type="date" value={filters.end} onChange={(e)=>setFilters(f=>({...f,end:e.target.value}))} />
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              onClick={()=>{
                const params = new URLSearchParams()
                if (filters.start) params.set('start', filters.start)
                if (filters.end) params.set('end', filters.end)
                window.open(`/api/analytics/incidents/export?${params.toString()}`,'_blank')
              }}
            >Export CSV</button>
          </div>
        </div>

        {error && (
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
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Loading analytics..." />
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Active Volunteers Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Volunteers</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.active_volunteers}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Activities Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CalendarIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Activities</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.total_activities}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Completed Activities Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Completed Activities</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.completed_activities}
                        </div>
                        <div className="ml-2">
                          <span className="text-sm text-gray-500">
                            (
                            {metrics.total_activities > 0
                              ? Math.round((metrics.completed_activities / metrics.total_activities) * 100)
                              : 0}
                            %)
                          </span>
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Accepted Activities Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Accepted Activities</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.accepted_activities}
                        </div>
                        <div className="ml-2">
                          <span className="text-sm text-gray-500">
                            (
                            {metrics.scheduled_activities > 0
                              ? Math.round((metrics.accepted_activities / metrics.scheduled_activities) * 100)
                              : 0}
                            %)
                          </span>
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {perf.length > 0 && (
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold mb-3">Volunteer Performance (Top)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-gray-600">
                  <tr>
                    <th className="py-2 text-left">Volunteer</th>
                    <th className="py-2 text-left">Incidents Resolved</th>
                    <th className="py-2 text-left">Avg Respond (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.slice(0,10).map((r, idx)=>(
                    <tr key={idx} className="border-t">
                      <td className="py-2">{r.full_name || r.volunteer_id}</td>
                      <td className="py-2">{r.resolved_count || 0}</td>
                      <td className="py-2">{r.avg_minutes_to_respond ? r.avg_minutes_to_respond.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
} 