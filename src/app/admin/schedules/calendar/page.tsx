"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { ScheduleCalendar } from "@/components/admin/schedule-calendar"
import { LocationLinkDisplay } from "@/components/ui/location-link-display"
import { ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"

export default function ScheduleCalendarPage() {
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null)

  const handleScheduleClick = (schedule: any) => {
    setSelectedSchedule(schedule)
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/schedules"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to List
            </Link>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                Schedule Calendar
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Visual overview of all scheduled activities
              </p>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <ScheduleCalendar onScheduleClick={handleScheduleClick} />

        {/* Schedule Details Modal */}
        {selectedSchedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {selectedSchedule.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                          selectedSchedule.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : selectedSchedule.status === 'ONGOING'
                            ? 'bg-orange-100 text-orange-800 border-orange-200'
                            : selectedSchedule.status === 'CANCELLED'
                            ? 'bg-gray-100 text-gray-800 border-gray-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        {selectedSchedule.status || 'SCHEDULED'}
                      </span>
                      {selectedSchedule.is_accepted !== null && (
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                            selectedSchedule.is_accepted
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {selectedSchedule.is_accepted ? '✓ Accepted' : '✗ Declined'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSchedule(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {selectedSchedule.description && (
                  <p className="text-gray-600 mb-4">{selectedSchedule.description}</p>
                )}

                <div className="space-y-3 border-t border-gray-200 pt-4">
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-gray-700 w-32">Date:</span>
                    <span className="text-gray-900">
                      {new Date(selectedSchedule.start_time).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center text-sm">
                    <span className="font-medium text-gray-700 w-32">Time:</span>
                    <span className="text-gray-900">
                      {new Date(selectedSchedule.start_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {new Date(selectedSchedule.end_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {selectedSchedule.volunteer && (
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-32">Volunteer:</span>
                      <span className="text-gray-900">
                        {selectedSchedule.volunteer.first_name} {selectedSchedule.volunteer.last_name}
                      </span>
                    </div>
                  )}

                  {selectedSchedule.location && (
                    <div className="mt-4">
                      <LocationLinkDisplay
                        location={selectedSchedule.location}
                        className="w-full"
                      />
                    </div>
                  )}

                  {selectedSchedule.barangay && (
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-32">Barangay:</span>
                      <span className="text-gray-900">{selectedSchedule.barangay}</span>
                    </div>
                  )}

                  {selectedSchedule.completed_at && (
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-32">Completed:</span>
                      <span className="text-green-700">
                        {new Date(selectedSchedule.completed_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Link
                    href="/admin/schedules"
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    View All Schedules
                  </Link>
                  <button
                    onClick={() => setSelectedSchedule(null)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
