"use client"

import { useState, useEffect, useMemo } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Star, MessageSquare, TrendingUp, Users, Filter, Download, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import Link from "next/link"

interface FeedbackItem {
  id: string
  incident_id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
  users?: {
    first_name: string
    last_name: string
    role: string
  }
  incident?: {
    incident_type: string
    barangay: string
    status: string
    assigned_to?: {
      first_name: string
      last_name: string
    }
  }
}

interface FeedbackStats {
  total: number
  averageRating: number
  ratingDistribution: { rating: number; count: number }[]
  recentTrend: 'up' | 'down' | 'stable'
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month" | "year">("month")
  const [ratingFilter, setRatingFilter] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch all feedback
  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all incidents with feedback
        const incidentsResponse = await fetch('/api/incidents?limit=1000')
        const incidentsResult = await incidentsResponse.json()

        if (!incidentsResult.success) {
          throw new Error('Failed to fetch incidents')
        }

        const incidents = incidentsResult.data || []
        const allFeedback: FeedbackItem[] = []

        // Fetch feedback for each incident
        for (const incident of incidents) {
          try {
            const feedbackResponse = await fetch(`/api/feedback?incident_id=${incident.id}`)
            const feedbackResult = await feedbackResponse.json()

            if (feedbackResult.success && feedbackResult.data) {
              feedbackResult.data.forEach((fb: any) => {
                allFeedback.push({
                  ...fb,
                  incident: {
                    incident_type: incident.incident_type,
                    barangay: incident.barangay,
                    status: incident.status,
                    assigned_to: incident.assigned_to ? {
                      first_name: incident.assigned_to.first_name,
                      last_name: incident.assigned_to.last_name
                    } : undefined
                  }
                })
              })
            }
          } catch (err) {
            console.error(`Error fetching feedback for incident ${incident.id}:`, err)
          }
        }

        setFeedback(allFeedback)
      } catch (err: any) {
        console.error('Error fetching feedback:', err)
        setError(err.message || 'Failed to load feedback')
      } finally {
        setLoading(false)
      }
    }

    fetchFeedback()
  }, [])

  // Calculate statistics
  const stats: FeedbackStats = useMemo(() => {
    const filtered = getFilteredFeedback()
    const total = filtered.length

    if (total === 0) {
      return {
        total: 0,
        averageRating: 0,
        ratingDistribution: [1, 2, 3, 4, 5].map(r => ({ rating: r, count: 0 })),
        recentTrend: 'stable'
      }
    }

    const averageRating = filtered.reduce((sum, f) => sum + f.rating, 0) / total

    const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: filtered.filter(f => f.rating === rating).length
    }))

    // Calculate recent trend (last 7 days vs previous 7 days)
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000

    const recent = filtered.filter(f => new Date(f.created_at).getTime() > sevenDaysAgo)
    const previous = filtered.filter(f => {
      const time = new Date(f.created_at).getTime()
      return time > fourteenDaysAgo && time <= sevenDaysAgo
    })

    const recentAvg = recent.length > 0 
      ? recent.reduce((sum, f) => sum + f.rating, 0) / recent.length
      : 0
    const previousAvg = previous.length > 0
      ? previous.reduce((sum, f) => sum + f.rating, 0) / previous.length
      : 0

    const recentTrend = recentAvg > previousAvg ? 'up' : recentAvg < previousAvg ? 'down' : 'stable'

    return {
      total,
      averageRating,
      ratingDistribution,
      recentTrend
    }
  }, [feedback, dateFilter, ratingFilter, searchTerm])

  // Filter feedback
  const getFilteredFeedback = (): FeedbackItem[] => {
    let filtered = [...feedback]

    // Date filter
    if (dateFilter !== "all") {
      const now = Date.now()
      let cutoff = now

      switch (dateFilter) {
        case "week":
          cutoff = now - 7 * 24 * 60 * 60 * 1000
          break
        case "month":
          cutoff = now - 30 * 24 * 60 * 60 * 1000
          break
        case "year":
          cutoff = now - 365 * 24 * 60 * 60 * 1000
          break
      }

      filtered = filtered.filter(f => new Date(f.created_at).getTime() > cutoff)
    }

    // Rating filter
    if (ratingFilter !== "all") {
      filtered = filtered.filter(f => f.rating === parseInt(ratingFilter))
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(f => 
        f.comment?.toLowerCase().includes(term) ||
        f.incident?.incident_type.toLowerCase().includes(term) ||
        f.incident?.barangay.toLowerCase().includes(term) ||
        f.users?.first_name.toLowerCase().includes(term) ||
        f.users?.last_name.toLowerCase().includes(term)
      )
    }

    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  const filteredFeedback = getFilteredFeedback()

  const exportCSV = () => {
    const headers = ['Date', 'Rating', 'Comment', 'Resident', 'Incident Type', 'Barangay', 'Status', 'Assigned Volunteer']
    const rows = filteredFeedback.map(f => [
      new Date(f.created_at).toLocaleString(),
      f.rating.toString(),
      f.comment || '',
      f.users ? `${f.users.first_name} ${f.users.last_name}` : 'Unknown',
      f.incident?.incident_type || 'N/A',
      f.incident?.barangay || 'N/A',
      f.incident?.status || 'N/A',
      f.incident?.assigned_to ? `${f.incident.assigned_to.first_name} ${f.incident.assigned_to.last_name}` : 'N/A'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1: return "Poor"
      case 2: return "Fair"
      case 3: return "Good"
      case 4: return "Very Good"
      case 5: return "Excellent"
      default: return ""
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading feedback..." />
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feedback Management</h1>
            <p className="text-sm text-gray-600 mt-1">View and analyze resident feedback on incidents</p>
          </div>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(stats.averageRating)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Out of 5.0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Recent Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {stats.recentTrend === 'up' && (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-lg font-semibold text-green-600">Improving</span>
                  </>
                )}
                {stats.recentTrend === 'down' && (
                  <>
                    <TrendingUp className="h-5 w-5 text-red-600 rotate-180" />
                    <span className="text-lg font-semibold text-red-600">Declining</span>
                  </>
                )}
                {stats.recentTrend === 'stable' && (
                  <>
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                    <span className="text-lg font-semibold text-gray-600">Stable</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">This Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredFeedback.length}</div>
              <p className="text-xs text-gray-500 mt-1">
                {dateFilter === "all" ? "All time" : `Last ${dateFilter}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Breakdown of feedback ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.ratingDistribution.map(({ rating, count }) => {
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={rating} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= rating
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-medium">{getRatingLabel(rating)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600">{count}</span>
                        <span className="text-gray-400 text-xs">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <Select value={ratingFilter} onValueChange={(value: any) => setRatingFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars (Excellent)</SelectItem>
                    <SelectItem value="4">4 Stars (Very Good)</SelectItem>
                    <SelectItem value="3">3 Stars (Good)</SelectItem>
                    <SelectItem value="2">2 Stars (Fair)</SelectItem>
                    <SelectItem value="1">1 Star (Poor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <Input
                  placeholder="Search by comment, incident type, barangay, or resident name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback List */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback ({filteredFeedback.length})</CardTitle>
            <CardDescription>Resident feedback on resolved incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredFeedback.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No feedback found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFeedback.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-5 w-5 ${
                                star <= item.rating
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {item.rating}/5 - {getRatingLabel(item.rating)}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.created_at)}
                      </div>
                    </div>

                    {/* User Info */}
                    {item.users && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>
                          {item.users.first_name} {item.users.last_name}
                          {item.users.role && (
                            <span className="text-gray-400 ml-1">({item.users.role})</span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Incident Info */}
                    {item.incident && (
                      <div className="flex items-center gap-4 text-sm">
                        <Link
                          href={`/admin/incidents/${item.incident_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          <Badge variant="outline">{item.incident.incident_type}</Badge>
                        </Link>
                        <span className="text-gray-500">{item.incident.barangay}</span>
                        {item.incident.assigned_to && (
                          <span className="text-gray-500">
                            Volunteer: {item.incident.assigned_to.first_name} {item.incident.assigned_to.last_name}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Comment */}
                    {item.comment && (
                      <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                        <p className="whitespace-pre-wrap">{item.comment}</p>
                      </div>
                    )}

                    {/* Updated indicator */}
                    {item.updated_at !== item.created_at && (
                      <div className="text-xs text-gray-400 italic">
                        Updated {formatDate(item.updated_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

