"use client"

import { useState } from "react"
import { X, Users, Calendar, Clock, MapPin, CheckCircle } from "lucide-react"
import { createSchedule } from "@/lib/schedules"
import { CITIES, getBarangays } from "@/lib/locations"
import { ACTIVITY_TYPES } from "@/lib/schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "sonner"

interface BulkScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  volunteers: any[]
  adminId: string
  onSuccess?: () => void
}

export function BulkScheduleModal({
  isOpen,
  onClose,
  volunteers,
  adminId,
  onSuccess
}: BulkScheduleModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedVolunteers, setSelectedVolunteers] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null)
  
  const [formData, setFormData] = useState({
    title: "",
    customTitle: "",
    description: "",
    start_time: "",
    end_time: "",
    city: "",
    barangay: "",
    street: ""
  })
  
  const [barangays, setBarangays] = useState<string[]>([])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityName = e.target.value
    setFormData({ ...formData, city: cityName, barangay: "" })
    if (cityName) {
      setBarangays(getBarangays(cityName))
    } else {
      setBarangays([])
    }
  }

  const toggleVolunteer = (volunteerId: string) => {
    setSelectedVolunteers(prev =>
      prev.includes(volunteerId)
        ? prev.filter(id => id !== volunteerId)
        : [...prev, volunteerId]
    )
  }

  const selectAll = () => {
    setSelectedVolunteers(volunteers.map(v => v.id))
  }

  const deselectAll = () => {
    setSelectedVolunteers([])
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.title) errors.title = "Please select an activity type"
    if (formData.title === "OTHER" && !formData.customTitle) {
      errors.customTitle = "Please enter a custom activity title"
    }
    if (!formData.start_time) errors.start_time = "Please select a start time"
    if (!formData.end_time) errors.end_time = "Please select an end time"
    if (!formData.city) errors.city = "Please select a city"
    if (!formData.barangay) errors.barangay = "Please select a barangay"
    if (!formData.street) errors.street = "Please enter a street address"

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

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix all form errors")
      return
    }

    if (selectedVolunteers.length === 0) {
      toast.error("Please select at least one volunteer")
      return
    }

    try {
      setSubmitting(true)
      
      const location = `${formData.city}, ${formData.barangay}, ${formData.street}`.trim()
      const scheduleData = {
        title: formData.title === "OTHER" ? formData.customTitle : formData.title,
        description: formData.description,
        start_time: formData.start_time,
        end_time: formData.end_time,
        location,
        barangay: formData.barangay
      }

      let successCount = 0
      let failedCount = 0

      // Create schedule for each selected volunteer
      for (const volunteerId of selectedVolunteers) {
        const result = await createSchedule(adminId, {
          ...scheduleData,
          volunteer_id: volunteerId
        })

        if (result.success) {
          successCount++
        } else {
          failedCount++
        }
      }

      setResults({ success: successCount, failed: failedCount })
      
      if (failedCount === 0) {
        toast.success(`Successfully created ${successCount} schedules`)
      } else {
        toast.warning(`Created ${successCount} schedules, ${failedCount} failed`)
      }

      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "Failed to create schedules")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setSelectedVolunteers([])
    setFormData({
      title: "",
      customTitle: "",
      description: "",
      start_time: "",
      end_time: "",
      city: "",
      barangay: "",
      street: ""
    })
    setResults(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-6 w-6" />
                Bulk Schedule Assignment
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Assign the same activity to multiple volunteers
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Steps Indicator */}
          <div className="flex items-center gap-4 mt-6">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="font-medium">Select Volunteers</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="font-medium">Schedule Details</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {results ? (
            /* Success Screen */
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Bulk Assignment Complete!</h3>
              <p className="text-gray-600 mb-6">
                Successfully created {results.success} schedule{results.success !== 1 ? 's' : ''}
                {results.failed > 0 && `, ${results.failed} failed`}
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Done
              </button>
            </div>
          ) : step === 1 ? (
            /* Step 1: Select Volunteers */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Select Volunteers ({selectedVolunteers.length} selected)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg p-4">
                {volunteers.map((volunteer) => (
                  <label
                    key={volunteer.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedVolunteers.includes(volunteer.id)
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedVolunteers.includes(volunteer.id)}
                      onChange={() => toggleVolunteer(volunteer.id)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {volunteer.first_name} {volunteer.last_name}
                      </div>
                      <div className="text-sm text-gray-600">{volunteer.email}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={selectedVolunteers.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next: Schedule Details
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Schedule Details */
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>{selectedVolunteers.length} volunteers</strong> will be assigned to this activity
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Activity Type *
                  </label>
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Activity Title *
                    </label>
                    <input
                      type="text"
                      value={formData.customTitle}
                      onChange={(e) => setFormData({ ...formData, customTitle: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                    {formErrors.customTitle && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.customTitle}</p>
                    )}
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  {formErrors.start_time && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.start_time}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  {formErrors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.end_time}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <select
                    value={formData.city}
                    onChange={handleCityChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Barangay *
                  </label>
                  <select
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    disabled={!formData.city}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100"
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder="Enter street address"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  {formErrors.street && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.street}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                  >
                    {submitting ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Creating...
                      </>
                    ) : (
                      `Create ${selectedVolunteers.length} Schedule${selectedVolunteers.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
