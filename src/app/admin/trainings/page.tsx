"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Button } from "@/components/ui/button"

export default function AdminTrainingsPage() {
  const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED === "true"

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
        const res = await fetch("/api/trainings")
        const json = await res.json()
        if (res.ok && json.success) setItems(json.data)
        else setError(json.message || "Failed to load trainings")
      } catch (e: any) {
        setError(e?.message || "Failed to load trainings")
      } finally {
        setLoading(false)
      }
    })()
  }, [FEATURE_ENABLED])

  const createTraining = async () => {
    if (!title.trim() || !startAt) {
      setError("Title and start date are required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const startDate = new Date(startAt)
      if (isNaN(startDate.getTime())) throw new Error("Invalid date format")

      const payload: any = {
        title: title.trim(),
        start_at: startDate.toISOString(),
      }

      const res = await fetch("/api/trainings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) throw new Error(json.message || "Failed to create training")
      if (json.success && json.data) {
        setItems([json.data, ...items])
        setTitle("")
        setStartAt("")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to create training")
    } finally {
      setLoading(false)
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.toUpperCase())
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && title.trim() && startAt) {
      createTraining()
    }
  }

  return (
    <AdminLayout>
      {!FEATURE_ENABLED ? (
        <div className="p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800 font-medium">⚠️ Trainings feature is disabled</p>
            <p className="text-yellow-700 text-sm mt-1">
              Set NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED=true in your environment variables
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Trainings Management</h1>
              <p className="text-sm text-gray-600 mt-1">Schedule and manage volunteer training sessions</p>
            </div>
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold">{items.length}</span>
            </div>
          </div>

          {/* Create Training Form */}
          <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Create New Training</h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Text auto-capitalizes</span>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-start">
                  <span className="text-red-500 mr-2">❌</span>
                  <div>
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Training Title *</label>
                <input
                  className="w-full border rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase placeholder:normal-case"
                  placeholder="e.g., First Aid Certification"
                  value={title}
                  onChange={handleTitleChange}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  maxLength={200}
                  style={{ textTransform: "uppercase" }}
                />
                <p className="text-xs text-gray-500 mt-1">{title.length}/200 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time *</label>
                <input
                  className="w-full border rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={createTraining} disabled={loading || !title.trim() || !startAt} className="px-6">
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span> Creating...
                  </>
                ) : (
                  <>
                    <span className="mr-2">➕</span> Create Training
                  </>
                )}
              </Button>

              {(title || startAt) && !loading && (
                <button
                  onClick={() => {
                    setTitle("")
                    setStartAt("")
                    setError(null)
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Clear form
                </button>
              )}
            </div>
          </div>

          {/* Trainings List */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Upcoming & Recent Trainings</h2>
              {items.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                  {items.length} total
                </span>
              )}
            </div>

            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin text-4xl mb-2">⏳</div>
                  <p className="text-gray-600">Loading trainings...</p>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-gray-500 font-medium">No trainings scheduled yet</p>
                <p className="text-sm text-gray-400 mt-1">Create your first training above</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {items.map((t) => {
                  const startDate = new Date(t.start_at)
                  const isUpcoming = startDate > new Date()
                  return (
                    <li key={t.id} className="py-4 hover:bg-gray-50 transition-colors rounded px-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-semibold text-gray-900 text-lg">{t.title}</p>
                            {isUpcoming && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                                Upcoming
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              📅{" "}
                              {startDate.toLocaleDateString("en-US", {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              🕐{" "}
                              {startDate.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </span>
                          </div>
                          {t.description && <p className="text-sm text-gray-600 mt-2">{t.description}</p>}
                        </div>
                        <div className="ml-4">
                          <span className="text-xs text-gray-400">ID: {t.id}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
