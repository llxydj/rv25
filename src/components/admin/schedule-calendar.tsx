"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, MapPin } from "lucide-react"
import { getSchedules } from "@/lib/schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface ScheduleCalendarProps {
  onScheduleClick?: (schedule: any) => void
}

export function ScheduleCalendar({ onScheduleClick }: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'month' | 'week'>('month')

  useEffect(() => {
    fetchSchedules()
  }, [currentDate])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const result = await getSchedules()
      if (result.success) {
        setSchedules(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek }
  }

  const getSchedulesForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    return schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.start_time).toISOString().split('T')[0]
      return scheduleDate === dateString
    })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day
    startOfWeek.setDate(diff)

    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push(date)
    }
    return days
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200'
      case 'ONGOING': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const renderMonthView = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
    const days = []

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(
        <div key={`empty-${i}`} className="min-h-[120px] bg-gray-50 border border-gray-200"></div>
      )
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const daySchedules = getSchedulesForDate(date)
      const isToday = new Date().toDateString() === date.toDateString()

      days.push(
        <div
          key={day}
          className={`min-h-[120px] border border-gray-200 p-2 bg-white hover:bg-gray-50 transition-colors ${
            isToday ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
            {day}
            {isToday && <span className="ml-1 text-xs">(Today)</span>}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[80px]">
            {daySchedules.slice(0, 3).map((schedule) => (
              <div
                key={schedule.id}
                onClick={() => onScheduleClick?.(schedule)}
                className={`text-xs p-1.5 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(
                  schedule.status || 'SCHEDULED'
                )}`}
              >
                <div className="font-medium truncate">{schedule.title}</div>
                <div className="text-xs opacity-80 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(schedule.start_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
            {daySchedules.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{daySchedules.length - 3} more
              </div>
            )}
          </div>
        </div>
      )
    }

    return days
  }

  const renderWeekView = () => {
    const weekDays = getWeekDays()

    return weekDays.map((date, index) => {
      const daySchedules = getSchedulesForDate(date)
      const isToday = new Date().toDateString() === date.toDateString()

      return (
        <div
          key={index}
          className={`border-r border-gray-200 last:border-r-0 ${
            isToday ? 'bg-blue-50' : 'bg-white'
          }`}
        >
          <div className={`p-3 border-b border-gray-200 text-center ${
            isToday ? 'bg-blue-100' : 'bg-gray-50'
          }`}>
            <div className="text-xs text-gray-600">
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
              {date.getDate()}
            </div>
          </div>
          <div className="p-2 space-y-2 min-h-[400px] overflow-y-auto">
            {daySchedules.map((schedule) => (
              <div
                key={schedule.id}
                onClick={() => onScheduleClick?.(schedule)}
                className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(
                  schedule.status || 'SCHEDULED'
                )}`}
              >
                <div className="font-semibold text-sm mb-1">{schedule.title}</div>
                <div className="text-xs space-y-1 opacity-90">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(schedule.start_time).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {schedule.volunteer && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {schedule.volunteer.first_name} {schedule.volunteer.last_name}
                    </div>
                  )}
                  {schedule.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{schedule.location}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" text="Loading calendar..." />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Calendar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {schedules.length} activities this month
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Today
            </button>
            <div className="flex items-center gap-1 border border-gray-300 rounded-md">
              <button
                onClick={() => view === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
                className="p-1.5 hover:bg-gray-100 rounded-l-md transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <button
                onClick={() => view === 'month' ? navigateMonth('next') : navigateWeek('next')}
                className="p-1.5 hover:bg-gray-100 rounded-r-md transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('month')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Calendar Body */}
      {view === 'month' ? (
        <>
          {/* Month View - Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 border-r border-gray-200 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          {/* Month View - Days Grid */}
          <div className="grid grid-cols-7">{renderMonthView()}</div>
        </>
      ) : (
        <>
          {/* Week View */}
          <div className="grid grid-cols-7">{renderWeekView()}</div>
        </>
      )}

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
            <span className="text-gray-700">Scheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></div>
            <span className="text-gray-700">Ongoing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
            <span className="text-gray-700">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></div>
            <span className="text-gray-700">Cancelled</span>
          </div>
        </div>
      </div>
    </div>
  )
}
