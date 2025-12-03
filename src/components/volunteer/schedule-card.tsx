"use client"

import { useState } from "react"
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { respondToSchedule } from "@/lib/schedules"
import { LocationLinkDisplay } from "@/components/ui/location-link-display"
import { toast } from "sonner"

interface ScheduleCardProps {
  schedule: any
  onResponse?: () => void
}

export function ScheduleCard({ schedule, onResponse }: ScheduleCardProps) {
  const [responding, setResponding] = useState(false)

  const handleResponse = async (isAccepted: boolean) => {
    if (!confirm(`Are you sure you want to ${isAccepted ? 'accept' : 'decline'} this activity?`)) {
      return
    }

    try {
      setResponding(true)
      const result = await respondToSchedule(schedule.id, isAccepted)
      
      if (result.success) {
        toast.success(isAccepted ? 'Activity accepted!' : 'Activity declined')
        onResponse?.()
      } else {
        throw new Error(result.message)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to respond to activity')
    } finally {
      setResponding(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200'
      case 'ONGOING': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const isPast = new Date(schedule.start_time) < new Date()
  const isUpcoming = new Date(schedule.start_time) > new Date()
  const canRespond = schedule.is_accepted === null && isUpcoming && schedule.status === 'SCHEDULED'

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        {/* Title & Status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{schedule.title}</h3>
            {schedule.description && (
              <p className="text-sm text-gray-600 mt-1">{schedule.description}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(schedule.status || 'SCHEDULED')}`}>
            {schedule.status || 'SCHEDULED'}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center text-sm text-gray-700">
            <Calendar className="h-4 w-4 mr-2 text-gray-500" />
            <span className="font-medium">
              {new Date(schedule.start_time).toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>

          <div className="flex items-center text-sm text-gray-700">
            <Clock className="h-4 w-4 mr-2 text-gray-500" />
            <span>
              {new Date(schedule.start_time).toLocaleTimeString('en-US', { 
                hour: '2-digit',
                minute: '2-digit'
              })} - {new Date(schedule.end_time).toLocaleTimeString('en-US', { 
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {schedule.location && (
            <div className="mt-3">
              <LocationLinkDisplay
                location={schedule.location}
                className="w-full"
              />
            </div>
          )}

          {schedule.creator && (
            <div className="flex items-center text-sm text-gray-500">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span>Created by {schedule.creator.first_name} {schedule.creator.last_name}</span>
            </div>
          )}
        </div>

        {/* Response Status */}
        {schedule.is_accepted !== null && (
          <div className={`flex items-center px-4 py-3 rounded-lg mb-4 ${
            schedule.is_accepted 
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {schedule.is_accepted ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">You accepted this activity</p>
                  {schedule.response_at && (
                    <p className="text-xs text-green-700">
                      Responded on {new Date(schedule.response_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600 mr-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">You declined this activity</p>
                  {schedule.response_at && (
                    <p className="text-xs text-red-700">
                      Responded on {new Date(schedule.response_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Completion Status */}
        {schedule.completed_at && (
          <div className="flex items-center px-4 py-3 rounded-lg mb-4 bg-green-50 border border-green-200">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Activity Completed</p>
              <p className="text-xs text-green-700">
                Completed on {new Date(schedule.completed_at).toLocaleString()}
              </p>
              {schedule.attendance_marked && (
                <p className="text-xs text-green-600 mt-1">✓ Attendance marked</p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {canRespond && (
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => handleResponse(true)}
              disabled={responding}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept
            </button>
            <button
              onClick={() => handleResponse(false)}
              disabled={responding}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </button>
          </div>
        )}

        {/* Pending Message */}
        {schedule.is_accepted === null && !canRespond && (
          <div className="flex items-center px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-sm text-yellow-800">
              {isPast ? 'Response period has ended' : 'Awaiting your response'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
