"use client"

import { useState } from "react"
import { X, CheckCircle, Camera, FileText, Users } from "lucide-react"
import { completeSchedule } from "@/lib/schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "sonner"

interface AttendanceMarkingModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: any
  onSuccess?: () => void
}

export function AttendanceMarkingModal({
  isOpen,
  onClose,
  schedule,
  onSuccess
}: AttendanceMarkingModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [attendanceMarked, setAttendanceMarked] = useState(false)
  const [notes, setNotes] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")

  if (!isOpen || !schedule) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSubmitting(true)

      let finalNotes = notes
      if (photoUrl) {
        finalNotes = `${notes}\n\nPhoto URL: ${photoUrl}`.trim()
      }

      const result = await completeSchedule(
        schedule.id,
        attendanceMarked,
        finalNotes || undefined
      )

      if (result.success) {
        toast.success("Schedule marked as completed")
        onSuccess?.()
        onClose()
      } else {
        throw new Error(result.message)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to mark completion")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setAttendanceMarked(false)
    setNotes("")
    setPhotoUrl("")
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                Mark Activity as Completed
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Complete the activity and mark attendance
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Activity Details */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">{schedule.title}</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                <strong>Volunteer:</strong>{" "}
                {schedule.volunteer?.first_name} {schedule.volunteer?.last_name}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {new Date(schedule.start_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p>
                <strong>Time:</strong>{" "}
                {new Date(schedule.start_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{" "}
                -{" "}
                {new Date(schedule.end_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {schedule.location && (
                <p>
                  <strong>Location:</strong> {schedule.location}
                </p>
              )}
            </div>
          </div>

          {/* Attendance Checkbox */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={attendanceMarked}
                onChange={(e) => setAttendanceMarked(e.target.checked)}
                className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Mark Attendance
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Check this box to confirm that the volunteer attended and completed the activity
                </p>
              </div>
            </label>
          </div>

          {/* Photo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Photo URL (Optional)
              </div>
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              Add a link to a photo documenting the completed activity
            </p>
          </div>

          {/* Completion Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Completion Notes (Optional)
              </div>
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about how the activity went, what was accomplished, or any issues encountered..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              These notes will be saved with the completed activity record
            </p>
          </div>

          {/* Warning if attendance not marked */}
          {!attendanceMarked && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-2">
                <div className="text-yellow-600">⚠️</div>
                <div className="text-sm text-yellow-800">
                  <strong>Note:</strong> The activity will be marked as completed, but attendance
                  will not be recorded. You can mark attendance by checking the box above.
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Completed
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
