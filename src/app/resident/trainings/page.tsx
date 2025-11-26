"use client"

import React, { useEffect, useState } from "react"

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === 'true'

export default function ResidentTrainingsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!FEATURE_ENABLED) return
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/trainings')
        const json = await res.json()
        if (res.ok && json.success) setItems(json.data || [])
        else setError(json.message || 'Failed to load trainings')
      } catch (e: any) {
        setError(e?.message || 'Failed to load trainings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (!FEATURE_ENABLED) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Trainings</h1>
        <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-500 p-3 text-sm text-yellow-800">
          Training features are disabled. Enable NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED to access this page.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Trainings</h1>
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it: any) => (
            <li key={it.id} className="p-3 border rounded">
              <div className="font-medium">{it.title}</div>
              <div className="text-sm text-gray-600">{it.description || ''}</div>
            </li>
          ))}
          {!items.length && !error && (
            <li className="text-gray-500 text-sm">No trainings available.</li>
          )}
        </ul>
      )}
    </div>
  )
}
