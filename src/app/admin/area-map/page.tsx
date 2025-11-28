"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { AdminLayout } from "@/components/layout/admin-layout"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, MapPin, Filter } from "lucide-react"
import type { AreaData } from "./area-map-internal"

// Dynamically import the map component with SSR disabled to avoid "window is not defined" error
const AreaMapInternal = dynamic(() => import("./area-map-internal"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  )
})

interface AreaMapResponse {
  success: boolean
  message?: string
  data: {
    areas: AreaData[]
    total_incidents: number
    period_days: number
    total_areas: number
  }
}

const RISK_COLORS = {
  LOW: '#10b981',      // green
  MEDIUM: '#f59e0b',   // yellow/amber
  HIGH: '#ef4444',     // red
  CRITICAL: '#7c2d12'  // dark red
}

const RISK_LABELS = {
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
  CRITICAL: 'Critical Risk'
}

export default function AreaMapPage() {
  const [data, setData] = useState<AreaMapResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/admin/area-map?days=${days}`)
      const json: AreaMapResponse = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed to fetch data')
      setData(json.data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load area map data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [days])

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
              Area Map - Incident Hotspots
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Visual representation of incident density across Talisay City
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
                <option value={180}>Last 6 months</option>
                <option value={365}>Last year</option>
              </select>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.total_incidents}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">in {data.period_days} days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Areas Affected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.total_areas}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">barangays</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Highest Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.areas[0]?.count || 0}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{data.areas[0]?.barangay || 'N/A'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.areas.filter(a => a.risk_level === 'CRITICAL').length}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">need attention</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Map and List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Talisay City - Incident Hotspots</CardTitle>
                <CardDescription>
                  Circle size and color indicate incident density. Larger and darker circles = more incidents.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="h-[600px] flex items-center justify-center">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : data && data.areas.length > 0 ? (
                  <AreaMapInternal areas={data.areas} />
                ) : (
                  <div className="h-[600px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>No incident data available for the selected period</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Area List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Areas by Incident Count</CardTitle>
                <CardDescription>Sorted by highest to lowest</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : data && data.areas.length > 0 ? (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {data.areas.map((area, idx) => (
                      <div
                        key={idx}
                        className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{area.barangay}</h4>
                          <Badge
                            style={{
                              backgroundColor: RISK_COLORS[area.risk_level],
                              color: 'white'
                            }}
                            className="text-xs"
                          >
                            {area.risk_level}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Count:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{area.count}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Top Type:</span>
                            <span className="text-gray-900 dark:text-white">{area.top_incident_type}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No areas to display</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(RISK_LABELS).map(([level, label]) => (
                <div key={level} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: RISK_COLORS[level as keyof typeof RISK_COLORS] }}
                  />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-gray-500">
                      {level === 'CRITICAL' && '50+ incidents'}
                      {level === 'HIGH' && '30-49 incidents'}
                      {level === 'MEDIUM' && '15-29 incidents'}
                      {level === 'LOW' && '<15 incidents'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
