"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { getIncidentById, getIncidentUpdates } from "@/lib/incidents"

export default function IncidentBriefPage() {
  const { id } = useParams()
  const [incident, setIncident] = useState<any>(null)
  const [updates, setUpdates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [inc, ups] = await Promise.all([
          getIncidentById(id as string),
          getIncidentUpdates(id as string),
        ])
        if (mounted) {
          if (inc.success) setIncident(inc.data)
          else setError(inc.message || "Failed to load incident")
          if (ups.success) setUpdates(ups.data || [])
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load incident")
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  const mapsUrl = useMemo(() => {
    if (!incident?.location_lat || !incident?.location_lng) return null
    return `https://maps.google.com/?q=${incident.location_lat},${incident.location_lng}`
  }, [incident])

  const copyDetails = async () => {
    try {
      const text = [
        `Incident ID: ${incident?.id || ""}`,
        `Created: ${incident?.created_at || ""}`,
        `Type: ${incident?.incident_type || ""}`,
        `Severity: ${incident?.severity || ""}`,
        `Status: ${incident?.status || ""}`,
        `Barangay: ${incident?.barangay || ""}`,
        `Address: ${incident?.address || ""}`,
        `Location: ${incident?.location_lat || ""}, ${incident?.location_lng || ""}`,
        mapsUrl ? `Map: ${mapsUrl}` : null,
        "",
        "Description:",
        `${incident?.description || ""}`,
      ].filter(Boolean).join("\n")
      await navigator.clipboard.writeText(text)
      alert("Incident details copied to clipboard.")
    } catch {
      alert("Failed to copy details.")
    }
  }

  const emailHref = useMemo(() => {
    const subject = encodeURIComponent(`RVOIS Incident Handoff: ${incident?.incident_type || ''} (${incident?.barangay || ''})`)
    const body = encodeURIComponent([
      `Incident ID: ${incident?.id || ""}`,
      `Created: ${incident?.created_at || ""}`,
      `Type: ${incident?.incident_type || ""}`,
      `Severity: ${incident?.severity || ""}`,
      `Status: ${incident?.status || ""}`,
      `Barangay: ${incident?.barangay || ""}`,
      `Address: ${incident?.address || ""}`,
      `Location: ${incident?.location_lat || ""}, ${incident?.location_lng || ""}`,
      mapsUrl ? `Map: ${mapsUrl}` : null,
      "",
      "Description:",
      `${incident?.description || ""}`,
      "",
      `Photo: ${incident?.photo_url || 'None'}`,
      "",
      "— Generated via RVOIS",
    ].filter(Boolean).join("\n"))
    return `mailto:?subject=${subject}&body=${body}`
  }, [incident, mapsUrl])

  const smsHref = useMemo(() => {
    const text = encodeURIComponent(
      `RVOIS: ${incident?.incident_type || ''} (${incident?.severity || ''}) in ${incident?.barangay || ''}\n` +
      `ID:${incident?.id || ''} Loc:${incident?.location_lat || ''},${incident?.location_lng || ''}\n` +
      (mapsUrl ? `Map: ${mapsUrl}` : '')
    )
    return `sms:?&body=${text}`
  }, [incident, mapsUrl])

  return (
    <AdminLayout>
      <div className="p-6 print:p-0">
        {loading && <p>Loading...</p>}
        {error && <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700">{error}</div>}
        {incident && (
          <div className="space-y-4">
            <div className="flex items-center justify-between print:hidden">
              <h1 className="text-2xl font-bold">Incident Brief</h1>
              <div className="flex gap-2">
                <button onClick={()=>window.print()} className="px-3 py-2 rounded border">Print / PDF</button>
                <button onClick={copyDetails} className="px-3 py-2 rounded border">Copy Details</button>
                <a href={emailHref} className="px-3 py-2 rounded border">Email</a>
                <a href={smsHref} className="px-3 py-2 rounded border">SMS</a>
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow print:shadow-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h2 className="font-semibold mb-2">Summary</h2>
                  <div className="text-sm space-y-1">
                    <div><strong>ID:</strong> {incident.id}</div>
                    <div><strong>Created:</strong> {new Date(incident.created_at).toLocaleString()}</div>
                    <div><strong>Type:</strong> {incident.incident_type}</div>
                    <div><strong>Severity:</strong> {incident.severity || '—'}</div>
                    <div><strong>Status:</strong> {incident.status}</div>
                    <div><strong>Barangay:</strong> {incident.barangay}</div>
                    <div><strong>Address:</strong> {incident.address || '—'}</div>
                    <div><strong>Location:</strong> {incident.location_lat}, {incident.location_lng}</div>
                    {mapsUrl && (
                      <div><a className="text-blue-600 hover:underline" href={mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps</a></div>
                    )}
                  </div>
                </div>
                <div>
                  <h2 className="font-semibold mb-2">Description</h2>
                  <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
                </div>
              </div>

              {incident.photo_url && (
                <div className="mt-4">
                  <h2 className="font-semibold mb-2">Photo</h2>
                  <img src={incident.photo_url} alt="Incident photo" className="max-w-full rounded border" />
                </div>
              )}

              {updates.length > 0 && (
                <div className="mt-4">
                  <h2 className="font-semibold mb-2">Recent Updates</h2>
                  <ul className="text-sm space-y-1">
                    {updates.slice(0,5).map((u:any)=> (
                      <li key={u.id}>
                        <strong>{u.new_status}</strong> — {u.notes || '—'}
                        <span className="text-gray-500"> ({new Date(u.created_at).toLocaleString()})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
