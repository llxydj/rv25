"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Button } from "@/components/ui/button"

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true'

export default function AdminTrainingsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [startAt, setStartAt] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!FEATURE_ENABLED) return
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/trainings')
        const json = await res.json()
        if (res.ok && json.success) setItems(json.data)
        else setError(json.message || 'Failed to load trainings')
      } catch (e: any) {
        setError(e?.message || 'Failed to load trainings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const createTraining = async () => {
    if (!title || !startAt) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, start_at: startAt }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setItems([json.data, ...items])
        setTitle("")
        setStartAt("")
      } else {
        setError(json.message || 'Failed to create training')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create training')
    } finally {
      setLoading(false)
    }
  }

  if (!FEATURE_ENABLED) {
    return (
      <AdminLayout>
        <div className="p-6"><p className="text-gray-600">Trainings feature is disabled.</p></div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-black">Trainings</h1>

        <div className="bg-white p-4 rounded-lg shadow space-y-3">
          <h2 className="font-semibold">Create Training</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border rounded px-3 py-2 text-gray-900" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
            <input className="border rounded px-3 py-2 text-gray-900" type="datetime-local" value={startAt} onChange={(e)=>setStartAt(e.target.value)} />
            <Button onClick={createTraining} disabled={loading || !title || !startAt}>Create</Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-3">Upcoming/Recent</h2>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ul className="divide-y">
              {items.map((t) => (
                <li key={t.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{t.title}</p>
                      <p className="text-sm text-gray-600">{new Date(t.start_at).toLocaleString()}</p>
                    </div>
                  </div>
                </li>
              ))}
              {items.length === 0 && <li className="py-3 text-gray-500">No trainings yet</li>}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}





