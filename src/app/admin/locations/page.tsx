"use client"

import { useEffect, useMemo, useState } from 'react'
import { AuthLayout } from '@/components/layout/auth-layout'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useVolunteerLocationsChannel, VolunteerLocationRow } from '@/lib/use-volunteer-locations'
import { MapComponent } from '@/components/ui/map-component'

export default function AdminLiveLocationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<VolunteerLocationRow[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/volunteer/location/recent?since=120&limit=500')
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json?.message || 'Failed to load locations')
        setRows(json.data || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load locations')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useVolunteerLocationsChannel((row) => {
    setRows(prev => [row, ...prev])
  })

  const markers = useMemo<{
    id: string
    position: [number, number]
    status: "PENDING" | "ASSIGNED" | "RESPONDING" | "RESOLVED" | "CANCELLED"
    title: string
    description?: string
  }[]>(() => {
    // Keep latest per volunteer (user_id)
    const seen = new Set<string>()
    const latest: VolunteerLocationRow[] = []
    for (const r of rows) {
      if (!seen.has(r.user_id)) {
        seen.add(r.user_id)
        latest.push(r)
      }
    }
    return latest.map(r => ({
      id: r.id,
      position: [r.lat, r.lng] as [number, number],
      status: 'RESPONDING' as const,
      title: `Volunteer ${r.user_id.slice(0, 8)}`,
      description: new Date(r.created_at).toLocaleString(),
    }))
  }, [rows])

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Live Volunteer Locations</h1>
          {loading && <LoadingSpinner size="sm" />}
        </div>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700">{error}</div>
        )}
        <div className="bg-white p-4 rounded shadow">
          <div className="h-[500px] w-full rounded overflow-hidden">
            <MapComponent markers={markers} height="500px" />
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
