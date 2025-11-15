"use client"

import { useState, useEffect } from "react"
import { Calendar, MapPin, Users, AlertCircle, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
  TRAINING: { label: "Training", color: "bg-blue-100 text-blue-800", icon: Users },
  MEETING: { label: "Meeting", color: "bg-green-100 text-green-800", icon: Calendar },
  ALERT: { label: "Alert", color: "bg-red-100 text-red-800", icon: AlertCircle },
  GENERAL: { label: "General", color: "bg-gray-100 text-gray-800", icon: CheckCircle }
}

const PRIORITY_CONFIG = {
  LOW: { label: "Low", color: "bg-gray-100 text-gray-800" },
  MEDIUM: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-800" },
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-800" }
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [filter, setFilter] = useState<'ALL' | 'TRAINING' | 'MEETING' | 'ALERT' | 'GENERAL'>('ALL')

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Announcements</h1>
          <p className="text-gray-600">Stay updated with the latest news, training schedules, and important alerts.</p>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
              <Button
                key={type}
                variant={filter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(type as any)}
                className="flex items-center gap-2"
              >
                <config.icon className="h-4 w-4" />
                {config.label}
              </Button>
            ))}
            <Button
              variant={filter === 'ALL' ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter('ALL')}
            >
              All
            </Button>
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-6">
          {sortedAnnouncements.map((announcement) => {
            const typeConfig = TYPE_CONFIG[announcement.type]
            const priorityConfig = PRIORITY_CONFIG[announcement.priority]
            const TypeIcon = typeConfig.icon

            return (
              <div key={announcement.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`${typeConfig.color} flex items-center gap-1`}>
                        <TypeIcon className="h-3 w-3" />
                        {typeConfig.label}
                      </Badge>
                      <Badge className={priorityConfig.color}>
                        {priorityConfig.label} Priority
                      </Badge>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      {announcement.title}
                    </h2>
                  </div>
                </div>

                <p className="text-gray-700 mb-4 leading-relaxed">
                  {announcement.content}
                </p>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {announcement.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{announcement.location}</span>
                    </div>
                  )}
                  {announcement.date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{announcement.date} {announcement.time}</span>
                    </div>
                  )}
                </div>

                {/* Requirements */}
                {announcement.requirements && announcement.requirements.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Requirements:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {announcement.requirements.map((req, index) => (
                        <li key={index} className="text-sm text-gray-600">{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-xs text-gray-500">
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
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No announcements found</h3>
            <p className="text-gray-600">There are no announcements matching your current filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
