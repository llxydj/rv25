"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  AlertTriangle, 
  MapPin, 
  User, 
  Bell, 
  Phone, 
  Calendar
} from "lucide-react"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    activeIncidents: 0,
    totalVolunteers: 0,
    resolvedToday: 0,
    pendingReports: 0
  })
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [feedback, setFeedback] = useState({ rating: 5, comment: "" })
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements?limit=5', { cache: 'no-store' })
        const json = await res.json()
        if (res.ok && json?.data) setAnnouncements(json.data)
      } catch { void 0 }
    }
    loadAnnouncements()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const quickActions = [
    {
      title: "Report Incident",
      description: "Report a new emergency",
      icon: AlertTriangle,
      color: "bg-red-600 hover:bg-red-700",
      href: "/resident/report"
    },
    {
      title: "View Incidents",
      description: "Check active incidents",
      icon: MapPin,
      color: "bg-blue-600 hover:bg-blue-700",
      href: user.role === 'admin' ? "/admin/incidents" : "/volunteer/incidents"
    },
    {
      title: "Announcements",
      description: "Latest news & updates",
      icon: Bell,
      color: "bg-green-600 hover:bg-green-700",
      href: "/announcements"
    },
    {
      title: "Emergency Call",
      description: "Call emergency services",
      icon: Phone,
      color: "bg-orange-600 hover:bg-orange-700",
      action: "call"
    }
  ]

  const handleQuickAction = (action: any) => {
    if (action.action === "call") {
      // Trigger emergency call modal
      const callButton = document.querySelector('[data-emergency-call]') as HTMLElement
      if (callButton) {
        callButton.click()
      }
    } else {
      router.push(action.href)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to RVOIS
          </h1>
          <p className="text-gray-600">
            Rescue Volunteers Operations Information System - Talisay City
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Incidents</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeIncidents}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Volunteers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVolunteers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolved Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.resolvedToday}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Bell className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Reports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingReports}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Announcements */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Announcements</h2>
          {announcements.length === 0 ? (
            <Card className="p-6">
              <p className="text-gray-500 text-sm">No announcements.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.slice(0,4).map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{a.title || 'Announcement'}</h3>
                    <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{a.body || a.content}</p>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon
              return (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <div 
                    onClick={() => handleQuickAction(action)}
                    className="text-center"
                  >
                    <div className={`inline-flex p-3 rounded-full text-white mb-4 ${action.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {action.description}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Fire Emergency - Zone 5</p>
                  <p className="text-sm text-gray-600">2 hours ago</p>
                </div>
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  Responding
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Medical Emergency - Zone 12</p>
                  <p className="text-sm text-gray-600">4 hours ago</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Resolved
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h3>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Emergency Response Training</p>
                  <p className="text-sm text-gray-600">March 25, 2024 - 8:00 AM</p>
                </div>
              </div>
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Monthly Volunteer Meeting</p>
                  <p className="text-sm text-gray-600">March 28, 2024 - 7:00 PM</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Feedback (guarded by env flag) */}
        {process.env.NEXT_PUBLIC_FEATURE_FEEDBACK_ENABLED === 'true' && (
          <div className="mt-8">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback</h3>
              <div className="flex items-center gap-3 mb-3">
                <label className="text-sm text-gray-600">Rating</label>
                <select
                  value={feedback.rating}
                  onChange={(e) => setFeedback({ ...feedback, rating: Number(e.target.value) })}
                  className="border rounded px-2 py-1 text-sm text-black"
                >
                  {[5,4,3,2,1].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <textarea
                value={feedback.comment}
                onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm text-black"
                placeholder="Share your feedback"
                rows={3}
              />
              <div className="mt-3">
                <Button
                  disabled={feedbackSubmitting}
                  onClick={async () => {
                    try {
                      setFeedbackSubmitting(true)
                      await fetch('/api/feedback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rating: feedback.rating, comment: feedback.comment || null }),
                      })
                      setFeedback({ rating: 5, comment: '' })
                    } finally {
                      setFeedbackSubmitting(false)
                    }
                  }}
                >
                  {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
