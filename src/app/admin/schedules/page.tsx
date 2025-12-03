"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminLayout } from "@/components/layout/admin-layout"
import { AlertTriangle, Calendar, CheckCircle, Clock, Pencil, MapPin, Plus, Trash2, User, Users, X } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/lib/auth"
import { ACTIVITY_TYPES, createSchedule, deleteSchedule, getSchedules, updateSchedule } from "@/lib/schedules"
import { getAllVolunteers } from "@/lib/volunteers"
import { CITIES, getBarangays } from "@/lib/locations"
import { ScheduleExportButton } from "@/components/admin/schedule-export-button"
import { BulkScheduleModal } from "@/components/admin/bulk-schedule-modal"
import { AttendanceMarkingModal } from "@/components/admin/attendance-marking-modal"
import { ExternalLink } from "lucide-react"

export default function ActivitySchedulesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [barangays, setBarangays] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [selectedScheduleForCompletion, setSelectedScheduleForCompletion] = useState<any>(null)
  const [editingSchedule, setEditingSchedule] = useState<any>(null)
  const [formData, setFormData] = useState({
    volunteer_id: "",
    title: "",
    customTitle: "",
    description: "",
    start_time: "",
    end_time: "",
    city: "",
    barangay: "",
    street: ""
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Fetch schedules
        const schedulesResult = await getSchedules()
        if (!schedulesResult.success) {
          throw new Error(schedulesResult.message)
        }
        setSchedules(schedulesResult.data || [])
        setPage(1)

        // Fetch volunteers
        const volunteersResult = await getAllVolunteers()
        if (!volunteersResult.success) {
          throw new Error(volunteersResult.message)
        }
        setVolunteers(volunteersResult.data || [])

      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityName = e.target.value
    setFormData({ ...formData, city: cityName, barangay: "" })
    if (cityName) {
      setBarangays(getBarangays(cityName))
    } else {
      setBarangays([])
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.volunteer_id) errors.volunteer_id = "Please select a volunteer"
    if (!formData.title) errors.title = "Please select an activity type"
    if (formData.title === "OTHER" && !formData.customTitle) {
      errors.customTitle = "Please enter a custom activity title"
    }
    if (!formData.start_time) errors.start_time = "Please select a start time"
    if (!formData.end_time) errors.end_time = "Please select an end time"
    if (!formData.city) errors.city = "Please select a city"
    if (!formData.barangay) errors.barangay = "Please select a barangay"
    if (!formData.street) errors.street = "Please enter a street address"

    // Check if end time is after start time
    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time)
      const end = new Date(formData.end_time)
      if (end <= start) {
        errors.end_time = "End time must be after start time"
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setSubmitting(true)
      
      // Format the location consistently
      const formattedLocation = `${formData.city}, ${formData.barangay}, ${formData.street}`.trim();
      
      const scheduleData = {
        volunteer_id: formData.volunteer_id,
        title: formData.title === "OTHER" ? formData.customTitle : formData.title,
        description: formData.description,
        start_time: formData.start_time,
        end_time: formData.end_time,
        location: formattedLocation,
        barangay: formData.barangay
      }

      console.log("Creating schedule with data:", scheduleData);
      
      let result
      if (editingSchedule) {
        result = await updateSchedule(
          user!.id,
          editingSchedule.id,
          scheduleData
        )
      } else {
        result = await createSchedule(
          user!.id,
          scheduleData
        )
      }

      console.log("Schedule creation result:", result);

      if (!result.success) {
        throw new Error(result.message)
      }

      // Add the new schedule to the list without refetching
      if (!editingSchedule) {
        setSchedules(prev => [...prev, { ...result.data, volunteer: volunteers.find(v => v.id === formData.volunteer_id) }])
      } else {
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? { ...result.data, volunteer: volunteers.find(v => v.id === formData.volunteer_id) } : s))
      }

      // Reset form
      setFormData({
        volunteer_id: "",
        title: "",
        customTitle: "",
        description: "",
        start_time: "",
        end_time: "",
        city: "",
        barangay: "",
        street: ""
      })
      setEditingSchedule(null)
      setShowForm(false)

    } catch (err: any) {
      console.error("Error saving schedule:", err);
      setError(err.message || "Failed to save schedule")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (schedule: any) => {
    console.log("Editing schedule:", schedule);
    
    let city = "", barangay = "", street = "";
    
    // Try to parse location information
    if (schedule.location) {
      // First try the city, barangay, street format
      const locationParts = schedule.location.split(', ');
      
      if (locationParts.length >= 3) {
        city = locationParts[0] || "";
        barangay = locationParts[1] || "";
        street = locationParts[2] || "";
      } else if (locationParts.length === 2) {
        city = locationParts[0] || "";
        barangay = locationParts[1] || "";
      } else if (locationParts.length === 1) {
        city = locationParts[0] || "";
      }
    }
    
    // Use barangay field as fallback if it exists
    if (!barangay && schedule.barangay) {
      barangay = schedule.barangay;
    }
    
    console.log("Parsed location:", { city, barangay, street });

    if (city) {
      setBarangays(getBarangays(city))
    }

    setFormData({
      volunteer_id: schedule.volunteer_id,
      title: ACTIVITY_TYPES.includes(schedule.title) ? schedule.title : "OTHER",
      customTitle: !ACTIVITY_TYPES.includes(schedule.title) ? schedule.title : "",
      description: schedule.description || "",
      start_time: new Date(schedule.start_time).toISOString().slice(0, 16),
      end_time: new Date(schedule.end_time).toISOString().slice(0, 16),
      city: city,
      barangay: barangay,
      street: street
    })
    
    // Location coordinates are no longer used - location is stored as text/Google Maps link
    setEditingSchedule(schedule)
    setShowForm(true)
  }

  const fetchSchedules = async () => {
    try {
      const schedulesResult = await getSchedules()
      if (schedulesResult.success) {
        setSchedules(schedulesResult.data || [])
      } else {
        setError(schedulesResult.message || "Failed to fetch schedules")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) {
      return
    }

    if (!user?.id) {
      setError("User not authenticated")
      return
    }

    const result = await deleteSchedule(user.id, id)
    if (result.success) {
      fetchSchedules()
    } else {
      setError(result.message || "Failed to delete schedule")
    }
  }

  const handleMarkComplete = (schedule: any) => {
    setSelectedScheduleForCompletion(schedule)
    setShowAttendanceModal(true)
  }

  const canMarkComplete = (schedule: any) => {
    // Can mark complete if status is SCHEDULED or ONGOING and not already completed
    const isCompletable = ['SCHEDULED', 'ONGOING'].includes(schedule.status || 'SCHEDULED')
    const notCompleted = schedule.status !== 'COMPLETED'
    return isCompletable && notCompleted
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Activity Schedules</h1>
            <p className="text-gray-600 mt-1">Manage and schedule activities for volunteers</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <button
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <Users className="mr-2 h-4 w-4" />
              Bulk Assign
            </button>
            <Link
              href="/admin/schedules/calendar"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Calendar View
            </Link>
            <ScheduleExportButton />
            <button
              onClick={() => {
                setEditingSchedule(null)
                setShowForm(!showForm)
                setFormData({
                  volunteer_id: "",
                  title: "",
                  customTitle: "",
                  description: "",
                  start_time: "",
                  end_time: "",
                  city: "",
                  barangay: "",
                  street: ""
                })
              }}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {showForm ? (
                <>Cancel</>
              ) : (
                <>
                  <Plus className="mr-2 h-5 w-5" />
                  New Activity
                </>
              )}
            </button>
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

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">
              {editingSchedule ? "Edit Activity" : "Schedule New Activity"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="volunteer" className="block text-sm font-medium text-gray-700">
                    Assign Volunteer *
                  </label>
                  <select
                    id="volunteer"
                    name="volunteer_id"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900"
                    value={formData.volunteer_id}
                    onChange={(e) => setFormData({ ...formData, volunteer_id: e.target.value })}
                  >
                    <option value="" className="text-gray-900">Select Volunteer</option>
                    {volunteers.map((volunteer) => (
                      <option key={volunteer.id} value={volunteer.id} className="text-gray-900">
                        {volunteer.first_name} {volunteer.last_name}
                      </option>
                    ))}
                  </select>
                  {formErrors.volunteer_id && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.volunteer_id}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Activity Type *
                  </label>
                  <select
                    id="title"
                    name="title"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  >
                    <option value="">Select Activity Type</option>
                    {ACTIVITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  {formErrors.title && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                  )}
                </div>

                {formData.title === "OTHER" && (
                  <div className="md:col-span-2">
                    <label htmlFor="customTitle" className="block text-sm font-medium text-gray-700">
                      Custom Activity Title *
                    </label>
              <input
                type="text"
                      id="customTitle"
                      name="customTitle"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900 uppercase"
                      value={formData.customTitle}
                      onChange={(e) => setFormData({ ...formData, customTitle: e.target.value.toUpperCase() })}
                    />
                    {formErrors.customTitle && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.customTitle}</p>
                    )}
                  </div>
                )}

                <div className="md:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900 uppercase"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value.toUpperCase() })}
                  />
                </div>

                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    id="start_time"
                    name="start_time"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                  {formErrors.start_time && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.start_time}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    id="end_time"
                    name="end_time"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                  {formErrors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.end_time}</p>
                  )}
              </div>

                <div className="md:col-span-2">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Location Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                          City *
                        </label>
                        <select
                          id="city"
                          name="city"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900"
                          value={formData.city}
                          onChange={handleCityChange}
                        >
                          <option value="">Select City</option>
                          {CITIES.map((city) => (
                            <option key={city.name} value={city.name}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                        {formErrors.city && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.city}</p>
                        )}
            </div>

                      <div>
                        <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">
                          Barangay *
                        </label>
              <select
                          id="barangay"
                          name="barangay"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900"
                          value={formData.barangay}
                          onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                          disabled={!formData.city}
                        >
                          <option value="">Select Barangay</option>
                          {barangays.map((barangay) => (
                            <option key={barangay} value={barangay}>
                              {barangay}
                            </option>
                          ))}
              </select>
                        {formErrors.barangay && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.barangay}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="street" className="block text-sm font-medium text-gray-700">
                          Street Address or Google Maps Link *
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                          <input
                            type="text"
                            id="street"
                            name="street"
                            className="mt-1 block w-full pl-10 pr-20 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm text-gray-900 uppercase"
                            value={formData.street}
                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                            placeholder="Enter address or paste Google Maps link"
                          />
                          <a
                            href={formData.city 
                              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.city + (formData.barangay ? `, ${formData.barangay}` : '') + ', Negros Occidental, Philippines')}`
                              : 'https://www.google.com/maps'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                            title={formData.city ? `Open Google Maps for ${formData.city}` : "Open Google Maps to find location"}
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Maps</span>
                          </a>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Enter the address or paste a Google Maps link. Click "Maps" to open Google Maps in a new tab.
                        </p>
                        {formErrors.street && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.street}</p>
                        )}
                      </div>
                    </div>
                  </div>
            </div>
          </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingSchedule(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {submitting ? (
                    <LoadingSpinner size="sm" color="text-white" />
                  ) : editingSchedule ? (
                    "Update Activity"
                  ) : (
                    "Schedule Activity"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Scheduled Activities</h2>
            {loading && !showForm ? (
              <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" text="Loading schedules..." />
            </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No activities scheduled</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by scheduling a new activity.</p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    New Activity
                  </button>
                </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Activity
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Volunteer
                    </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {schedules.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize).map((schedule) => (
                      <tr key={schedule.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{schedule.title}</div>
                          {schedule.description && (
                            <div className="text-sm text-gray-500">{schedule.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {(schedule.volunteer?.first_name || schedule.volunteer?.last_name)
                                  ? `${schedule.volunteer?.first_name ?? ''} ${schedule.volunteer?.last_name ?? ''}`.trim()
                                  : (volunteers.find(v => v.id === schedule.volunteer_id)?.email || 'Unknown Volunteer')}
                              </div>
                              <div className="text-sm text-gray-500">
                                {schedule.volunteer?.email || volunteers.find(v => v.id === schedule.volunteer_id)?.email || ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="mr-1.5 h-4 w-4 text-gray-500" />
                            {new Date(schedule.start_time).toLocaleDateString()}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="mr-1.5 h-4 w-4" />
                            {new Date(schedule.start_time).toLocaleTimeString()} -{" "}
                            {new Date(schedule.end_time).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                            <MapPin className="mr-1.5 h-4 w-4 text-gray-500" />
                            <div>
                              <div className="text-sm text-gray-900">{schedule.location}</div>
                              <div className="text-sm text-gray-500">{schedule.barangay}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              schedule.status === 'COMPLETED' 
                                ? 'bg-green-100 text-green-800'
                                : schedule.status === 'ONGOING'
                                ? 'bg-orange-100 text-orange-800'
                                : schedule.status === 'CANCELLED'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {schedule.status || 'SCHEDULED'}
                            </span>
                            {schedule.is_accepted !== null && (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                schedule.is_accepted 
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {schedule.is_accepted ? '✓ Accepted' : '✗ Declined'}
                              </span>
                            )}
                            {schedule.is_accepted === null && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                                ⏳ Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {canMarkComplete(schedule) && (
                            <button
                              onClick={() => handleMarkComplete(schedule)}
                              className="text-green-600 hover:text-green-900 mr-4"
                              title="Mark as Completed"
                            >
                              <CheckCircle className="h-4 w-4" />
                              <span className="sr-only">Mark Complete</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {/* Pagination controls */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {(() => {
                    const total = schedules.length
                    const start = total === 0 ? 0 : (page - 1) * pageSize + 1
                    const end = Math.min(page * pageSize, total)
                    return `Showing ${start}–${end} of ${total}`
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {page} of {Math.max(1, Math.ceil(schedules.length / pageSize))}
                  </span>
                  <button
                    disabled={page >= Math.max(1, Math.ceil(schedules.length / pageSize))}
                    onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(schedules.length / pageSize)), p + 1))}
                    className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Bulk Schedule Modal */}
      {user && (
        <BulkScheduleModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          volunteers={volunteers}
          adminId={user.id}
          onSuccess={() => {
            fetchSchedules()
            setShowBulkModal(false)
          }}
        />
      )}

      {/* Attendance Marking Modal */}
      <AttendanceMarkingModal
        isOpen={showAttendanceModal}
        onClose={() => {
          setShowAttendanceModal(false)
          setSelectedScheduleForCompletion(null)
        }}
        schedule={selectedScheduleForCompletion}
        onSuccess={() => {
          fetchSchedules()
          setShowAttendanceModal(false)
          setSelectedScheduleForCompletion(null)
        }}
      />

    </AdminLayout>
  )
} 