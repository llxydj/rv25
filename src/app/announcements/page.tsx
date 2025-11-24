"use client"

import { useState, useEffect } from "react"
import { Calendar, MapPin, Users, AlertCircle, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface Announcement {
  id: string
  title: string
  content: string
  type: 'TRAINING' | 'MEETING' | 'ALERT' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  location?: string
  date?: string
  time?: string
  requirements?: string[]
  created_at: string
  created_by: string
}

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    title: "Emergency Response Training - Zone 1-5",
    content: "Mandatory training session for all volunteers covering basic first aid, fire safety, and emergency protocols. Please bring your ID and training materials.",
    type: "TRAINING",
    priority: "HIGH",
    location: "Talisay City Hall - Conference Room A",
    date: "2024-03-25",
    time: "08:00 AM - 05:00 PM",
    requirements: ["Valid ID", "Training Materials", "Medical Certificate"],
    created_at: "2024-03-20T10:00:00Z",
    created_by: "admin"
  },
  {
    id: "2",
    title: "Monthly Volunteer Meeting",
    content: "Regular monthly meeting to discuss recent incidents, review protocols, and plan upcoming activities.",
    type: "MEETING",
    priority: "MEDIUM",
    location: "RVOIS Office",
    date: "2024-03-28",
    time: "07:00 PM - 09:00 PM",
    created_at: "2024-03-18T14:30:00Z",
    created_by: "admin"
  },
  {
    id: "3",
    title: "Weather Alert - Heavy Rain Expected",
    content: "The Philippine Atmospheric, Geophysical and Astronomical Services Administration (PAGASA) has issued a weather advisory for heavy rainfall in Talisay City. All volunteers should be on standby.",
    type: "ALERT",
    priority: "CRITICAL",
    created_at: "2024-03-22T06:00:00Z",
    created_by: "admin"
  }
]

const TYPE_CONFIG = {
  TRAINING: { 
    label: "Training", 
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800", 
    icon: Users 
  },
  MEETING: { 
    label: "Meeting", 
    color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800", 
    icon: Calendar 
  },
  ALERT: { 
    label: "Alert", 
    color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800", 
    icon: AlertCircle 
  },
  GENERAL: { 
    label: "General", 
    color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600", 
    icon: CheckCircle 
  }
}

const PRIORITY_CONFIG = {
  LOW: { 
    label: "Low", 
    color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600" 
  },
  MEDIUM: { 
    label: "Medium", 
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800" 
  },
  HIGH: { 
    label: "High", 
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800" 
  },
  CRITICAL: { 
    label: "Critical", 
    color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800" 
  }
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [filter, setFilter] = useState<'ALL' | 'TRAINING' | 'MEETING' | 'ALERT' | 'GENERAL'>('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/announcements', { cache: 'no-store' })
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setAnnouncements(json.data)
        } else {
          // Fallback to mock if API fails
          setAnnouncements(MOCK_ANNOUNCEMENTS)
        }
      } catch (e) {
        setAnnouncements(MOCK_ANNOUNCEMENTS)
      } finally {
        setLoading(false)
      }
    }
    fetchAnnouncements()
  }, [])

  const filteredAnnouncements = filter === 'ALL' 
    ? announcements 
    : announcements.filter(ann => ann.type === filter)

  const sortedAnnouncements = filteredAnnouncements.sort((a, b) => {
    // Sort by priority first, then by date
    const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" text="Loading announcements..." />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Announcements
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            Stay updated with the latest news, training schedules, and important alerts.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="mb-4 md:mb-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'ALL' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('ALL')}
              className="text-xs md:text-sm"
            >
              All
            </Button>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
              <Button
                key={type}
                variant={filter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(type as any)}
                className="flex items-center gap-1.5 text-xs md:text-sm"
              >
                <config.icon className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{config.label}</span>
                <span className="sm:hidden">{config.label.slice(0, 3)}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-4 md:space-y-6">
          {sortedAnnouncements.map((announcement) => {
            const typeConfig = TYPE_CONFIG[announcement.type]
            const priorityConfig = PRIORITY_CONFIG[announcement.priority]
            const TypeIcon = typeConfig.icon

            return (
              <div 
                key={announcement.id} 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 md:p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeConfig.color}`}>
                        <TypeIcon className="h-3 w-3 flex-shrink-0" />
                        {typeConfig.label}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityConfig.color}`}>
                        {priorityConfig.label} Priority
                      </span>
                    </div>
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {announcement.title}
                    </h2>
                  </div>
                </div>

                <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                  {announcement.content}
                </p>

                {/* Details */}
                {(announcement.location || announcement.date) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4">
                    {announcement.location && (
                      <div className="flex items-start gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{announcement.location}</span>
                      </div>
                    )}
                    {announcement.date && (
                      <div className="flex items-start gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{announcement.date} {announcement.time}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Requirements */}
                {announcement.requirements && announcement.requirements.length > 0 && (
                  <div className="mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                    <h4 className="text-xs md:text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Requirements:
                    </h4>
                    <ul className="space-y-1">
                      {announcement.requirements.map((req, index) => (
                        <li 
                          key={index} 
                          className="flex items-start gap-2 text-xs md:text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Posted on {new Date(announcement.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {sortedAnnouncements.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="h-10 w-10 md:h-12 md:w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-base md:text-lg font-medium text-gray-900 dark:text-white mb-2">
              No announcements found
            </h3>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              There are no announcements matching your current filter.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}