"use client"

import React, { useEffect, useState, useRef } from "react"
import { RefreshCw } from "lucide-react"

interface Profile {
  role: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  address: string | null
  barangay: string | null
}

interface Handoff {
  id: number
  incident_id: string
  from_lgu: string
  to_lgu: string
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED"
  notes: string | null
  created_by: string | null
  created_at: string
}

export default function BarangayHandoffsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [filter, setFilter] = useState<"ALL" | Handoff["status"]>("ALL")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)

  async function load(showLoader = true) {
    try {
      if (showLoader) setLoading(true)
      else setIsRefreshing(true)
      setError(null)

      const profRes = await fetch("/api/user/profile", { cache: "no-store" })
      if (!profRes.ok) throw new Error("Failed to load user profile")
      const prof = await profRes.json()
      setProfile(prof)

      const res = await fetch(`/api/incident-handoffs`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load handoffs")
      const json = await res.json()
      const list: Handoff[] = json?.data || []

      // Only show handoffs intended for this LGU (to_lgu === user's barangay)
      const filtered = (prof?.barangay
        ? list.filter((h) => (h.to_lgu || "").toUpperCase() === (prof.barangay || "").toUpperCase())
        : list)

      setHandoffs(filtered)
      setLastUpdate(new Date())
    } catch (e: any) {
      setError(e?.message || "Failed to load data")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    load(true)
    
    // Set up polling every 10 seconds
    pollingInterval.current = setInterval(() => {
      load(false)
    }, 10000)
    
    // Cleanup on unmount
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
      }
    }
  }, [])

  async function updateStatus(id: number, status: Handoff["status"]) {
    try {
      setBusyId(id)
      const res = await fetch("/api/incident-handoffs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || "Failed to update handoff")
      }
      await load()
    } catch (e: any) {
      setError(e?.message || "Failed to update")
    } finally {
      setBusyId(null)
    }
  }

  const visible = filter === "ALL" ? handoffs : handoffs.filter((h) => h.status === filter)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">LGU Handoffs</h1>
          <p className="text-sm text-gray-500">Incoming handoff requests for your barangay</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
            {isRefreshing && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Refreshing...</span>
              </div>
            )}
          </div>
        </div>
        <button
          className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          onClick={() => load(false)}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {profile?.barangay && (
        <div className="mb-4 text-sm">Viewing handoffs for: <span className="font-medium">{profile.barangay}</span></div>
      )}

      <div className="mb-4 flex gap-2 items-center">
        <label className="text-sm">Filter:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
        >
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <button
          className="ml-auto border rounded px-3 py-1 text-sm hover:bg-gray-50"
          onClick={load}
        >Refresh</button>
      </div>

      {loading && <div className="text-sm">Loading…</div>}
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}

      {!loading && visible.length === 0 && (
        <div className="text-sm text-gray-500">No handoffs found.</div>
      )}

      <div className="space-y-3">
        {visible.map((h) => (
          <div key={h.id} className="border rounded p-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">Incident: {h.incident_id}</div>
              <span className="ml-2 text-xs rounded bg-gray-100 px-2 py-0.5">{h.status}</span>
              <span className="ml-auto text-xs text-gray-500">{new Date(h.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">From: {h.from_lgu} → To: {h.to_lgu}</div>
            {h.notes && <div className="text-sm mt-1">Notes: {h.notes}</div>}
            <div className="mt-3 flex gap-2">
              <button
                disabled={busyId === h.id || h.status !== "PENDING"}
                onClick={() => updateStatus(h.id, "ACCEPTED")}
                className="border rounded px-3 py-1 text-sm disabled:opacity-50 hover:bg-green-50"
              >Accept</button>
              <button
                disabled={busyId === h.id || h.status !== "PENDING"}
                onClick={() => updateStatus(h.id, "REJECTED")}
                className="border rounded px-3 py-1 text-sm disabled:opacity-50 hover:bg-red-50"
              >Reject</button>
              <button
                disabled={busyId === h.id || h.status !== "ACCEPTED"}
                onClick={() => updateStatus(h.id, "COMPLETED")}
                className="border rounded px-3 py-1 text-sm disabled:opacity-50 hover:bg-blue-50"
              >Complete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
