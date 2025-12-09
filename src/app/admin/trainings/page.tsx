"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, MapPin, Users, Clock, Edit, X, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ExternalLink } from "lucide-react"

export default function AdminTrainingsPage() {
  // Trainings feature is enabled by default
  const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TRAININGS_ENABLED !== 'false'

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [startAt, setStartAt] = useState("")
  const [endAt, setEndAt] = useState("")
  const [capacity, setCapacity] = useState("")
  const [status, setStatus] = useState<"SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED">("SCHEDULED")
  const [statusFilter, setStatusFilter] = useState<"all" | "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED">("all")

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
      if (isNaN(startDate.getTime())) throw new Error("Invalid start date format")

      const payload: any = {
        title: title.trim(),
        start_at: startDate.toISOString(),
        description: description.trim() || null,
        location: location.trim() || null,
        location_lat: null,
        location_lng: null,
        capacity: capacity ? parseInt(capacity) : null,
        status: status
      }

      if (endAt) {
        const endDate = new Date(endAt)
        if (isNaN(endDate.getTime())) throw new Error("Invalid end date format")
        if (endDate <= startDate) throw new Error("End date must be after start date")
        payload.end_at = endDate.toISOString()
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
        // Reset form
        setTitle("")
        setDescription("")
        setLocation("")
        setLocationLat(null)
        setLocationLng(null)
        setStartAt("")
        setEndAt("")
        setCapacity("")
        setStatus("SCHEDULED")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to create training")
    } finally {
      setLoading(false)
    }
  }

  const updateTrainingStatus = async (trainingId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/trainings/${trainingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.message || "Failed to update status")

      // Update local state
      setItems(items.map(t => t.id === trainingId ? { ...t, status: newStatus } : t))
    } catch (e: any) {
      alert("Failed to update status: " + (e?.message || "Unknown error"))
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      SCHEDULED: { variant: "default", label: "Scheduled" },
      ONGOING: { variant: "secondary", label: "Ongoing" },
      COMPLETED: { variant: "outline", label: "Completed" },
      CANCELLED: { variant: "destructive", label: "Cancelled" }
    }
    return variants[status] || { variant: "outline" as const, label: status }
  }

  const filteredItems = statusFilter === "all" 
    ? items 
    : items.filter(t => t.status === statusFilter)

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-black">Trainings Management</h1>
              <p className="text-xs md:text-sm text-gray-600 mt-1">Schedule and manage volunteer training sessions</p>
            </div>
            <div className="text-sm text-gray-500">
              Total: <span className="font-semibold">{items.length}</span>
            </div>
          </div>

          {/* Create Training Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Training</CardTitle>
              <CardDescription>Fill in the details to schedule a new training session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Error</p>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Training Title *</label>
                  <Input
                    placeholder="e.g., First Aid Certification"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.toUpperCase())}
                    disabled={loading}
                    maxLength={200}
                    className="uppercase"
                  />
                  <p className="text-xs text-gray-500 mt-1">{title.length}/200 characters</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <Textarea
                    placeholder="Describe the training content, objectives, and what volunteers will learn..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location/Venue or Google Maps Link</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                    <Input
                      placeholder="Enter address or paste Google Maps link"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={loading}
                      className="pl-10 pr-20"
                    />
                    <a
                      href="https://www.google.com/maps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                      title="Open Google Maps to find location"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Maps</span>
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter the address or paste a Google Maps link. Click "Maps" to open Google Maps in a new tab.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (Max Participants)</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      placeholder="e.g., 50"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      disabled={loading}
                      min="1"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date & Time *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      disabled={loading}
                      min={new Date().toISOString().slice(0, 16)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date & Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      disabled={loading}
                      min={startAt || new Date().toISOString().slice(0, 16)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="ONGOING">Ongoing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={createTraining} disabled={loading || !title.trim() || !startAt}>
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create Training
                    </>
                  )}
                </Button>

                {(title || startAt || description || location) && !loading && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTitle("")
                      setDescription("")
                      setLocation("")
                      setStartAt("")
                      setEndAt("")
                      setCapacity("")
                      setStatus("SCHEDULED")
                      setError(null)
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Form
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trainings List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Trainings ({filteredItems.length})</CardTitle>
                  <CardDescription>Manage scheduled and completed training sessions</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="ONGOING">Ongoing</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading && items.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading trainings..." />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <p className="text-gray-500 font-medium">No trainings found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {statusFilter === "all" ? "Create your first training above" : `No ${statusFilter.toLowerCase()} trainings`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.map((t) => {
                    const startDate = new Date(t.start_at)
                    const endDate = t.end_at ? new Date(t.end_at) : null
                    const badge = getStatusBadge(t.status || 'SCHEDULED')
                    
                    return (
                      <div key={t.id} className="border rounded-lg p-3 md:p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start gap-2 md:gap-3 mb-2">
                              <Link href={`/admin/trainings/${t.id}`} className="hover:underline flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm md:text-lg truncate">{t.title}</h3>
                              </Link>
                              <Badge variant={badge.variant} className="text-xs flex-shrink-0">{badge.label}</Badge>
                            </div>
                            
                            {t.description && (
                              <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2">{t.description}</p>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                                <span className="truncate">
                                  {startDate.toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })} at {startDate.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                              
                              {endDate && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                                  <span className="truncate">
                                    Ends: {endDate.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })} at {endDate.toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })}
                                  </span>
                                </div>
                              )}

                              {t.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                                  <span className="truncate">{t.location}</span>
                                </div>
                              )}

                              {t.capacity && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                                  <span>Capacity: {t.capacity}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-200 lg:ml-4">
                            <Select
                              value={t.status || 'SCHEDULED'}
                              onValueChange={(value) => updateTrainingStatus(t.id, value)}
                            >
                              <SelectTrigger className="w-full sm:w-[130px] touch-manipulation min-h-[2.5rem] text-xs md:text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                <SelectItem value="ONGOING">Ongoing</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <Link href={`/admin/trainings/${t.id}`} className="flex-1 sm:flex-none">
                              <Button variant="outline" size="sm" className="w-full sm:w-auto touch-manipulation min-h-[2.5rem] text-xs md:text-sm">
                                <Edit className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                                <span className="hidden sm:inline">View Details</span>
                                <span className="sm:hidden">View</span>
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Location Picker Modal */}
    </AdminLayout>
  )
}
