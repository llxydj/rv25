"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AuthLayout } from "@/components/layout/auth-layout"

interface Incident {
  id: string
  incident_type: string
  description: string
  barangay: string
  created_at: string
  status?: string
}

export default function BarangaySummaryPage() {
  const [barangay, setBarangay] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (barangay) params.set('barangay', barangay)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/summary/barangay-summary?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed to load summary')
      setIncidents(json.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load summary')
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // optional auto-load with a default barangay if you want
  }, [])

  return (
    <AuthLayout allowedRoles={["admin"]}>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Barangay Case Summary</h1>

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Barangay</label>
              <Input value={barangay} onChange={e=>setBarangay(e.target.value)} placeholder="e.g., Zone 1" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">From</label>
              <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <Input type="date" value={to} onChange={e=>setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={loading || !barangay} className="w-full">{loading ? 'Loading...' : 'Load'}</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-sm mb-3">{error}</div>
          )}

          {loading ? (
            <div>Loading...</div>
          ) : incidents.length === 0 ? (
            <div className="text-gray-600">No incidents found for the selected filters.</div>
          ) : (
            <div className="space-y-2">
              {incidents.map((it) => (
                <div key={it.id} className="p-3 bg-gray-50 rounded">
                  <div className="flex justify-between">
                    <span className="font-medium">{it.incident_type}</span>
                    <span className="text-xs text-gray-600">{new Date(it.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-700 truncate">{it.description}</div>
                  <div className="text-xs text-gray-600 mt-1">Barangay: {it.barangay}{it.status ? ` • Status: ${it.status}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AuthLayout>
  )
}
