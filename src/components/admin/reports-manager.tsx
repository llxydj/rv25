"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, User, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Report {
  id: string
  title: string
  report_type: 'INCIDENT_REPORT' | 'ACTIVITY_REPORT' | 'SITUATION_REPORT'
  description: string
  incident_id: string | null
  created_by: string
  status: 'SUBMITTED' | 'REVIEWED' | 'REJECTED'
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export function ReportsManager() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    report_type: '',
    status: '',
    created_by: ''
  })
  const [reviewing, setReviewing] = useState<Report | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewStatus, setReviewStatus] = useState<'REVIEWED' | 'REJECTED'>('REVIEWED')

  useEffect(() => {
    fetchReports()
  }, [filters])

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.report_type) params.append('report_type', filters.report_type)
      if (filters.status) params.append('status', filters.status)
      if (filters.created_by) params.append('created_by', filters.created_by)

      const response = await fetch(`/api/reports?${params.toString()}`)
      const result = await response.json()
      if (result.success) {
        setReports(result.data)
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (report: Report) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          status: reviewStatus,
          review_notes: reviewNotes,
          reviewed_by: 'current-user-id' // This should come from auth context
        })
      })

      const result = await response.json()
      if (result.success) {
        await fetchReports()
        setReviewing(null)
        setReviewNotes('')
        setReviewStatus('REVIEWED')
      }
    } catch (error) {
      console.error('Error reviewing report:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      SUBMITTED: 'bg-yellow-100 text-yellow-800',
      REVIEWED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getTypeColor = (type: string) => {
    const colors = {
      INCIDENT_REPORT: 'bg-red-100 text-red-800',
      ACTIVITY_REPORT: 'bg-blue-100 text-blue-800',
      SITUATION_REPORT: 'bg-purple-100 text-purple-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return <div className="p-6">Loading reports...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reports Management</h2>
        <Button onClick={fetchReports}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="report_type">Report Type</Label>
              <Select
                value={filters.report_type}
                onValueChange={(value) => setFilters({ ...filters, report_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="INCIDENT_REPORT">Incident Report</SelectItem>
                  <SelectItem value="ACTIVITY_REPORT">Activity Report</SelectItem>
                  <SelectItem value="SITUATION_REPORT">Situation Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="REVIEWED">Reviewed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="created_by">Created By</Label>
              <Input
                id="created_by"
                value={filters.created_by}
                onChange={(e) => setFilters({ ...filters, created_by: e.target.value })}
                placeholder="Filter by creator ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span className="font-semibold">{report.title}</span>
                      <Badge className={getTypeColor(report.report_type)}>
                        {report.report_type.replace('_', ' ')}
                      </Badge>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{report.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {report.created_by}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(report.created_at)}
                      </div>
                      {report.incident_id && (
                        <div className="text-sm text-blue-600">
                          Incident: {report.incident_id}
                        </div>
                      )}
                    </div>
                    {report.review_notes && (
                      <div className="text-sm bg-gray-50 p-2 rounded">
                        <strong>Review Notes:</strong> {report.review_notes}
                      </div>
                    )}
                    {report.reviewed_by && (
                      <div className="text-sm text-gray-500">
                        Reviewed by: {report.reviewed_by} on {formatDate(report.reviewed_at || '')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {report.status === 'SUBMITTED' && (
                      <Button
                        size="sm"
                        onClick={() => setReviewing(report)}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reports.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No reports found</p>
          </CardContent>
        </Card>
      )}

      {reviewing && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <CardContent className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Review Report</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="review_status">Status</Label>
                <Select
                  value={reviewStatus}
                  onValueChange={(value) => setReviewStatus(value as 'REVIEWED' | 'REJECTED')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REVIEWED">Reviewed</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="review_notes">Review Notes</Label>
                <Textarea
                  id="review_notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add review notes..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleReview(reviewing)}>
                  Submit Review
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewing(null)
                    setReviewNotes('')
                    setReviewStatus('REVIEWED')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

