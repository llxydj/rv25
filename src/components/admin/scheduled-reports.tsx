"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Trash2, Edit, Clock, Mail, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { format } from 'date-fns'

interface ScheduledReport {
  id: string
  report_type: string
  title: string
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom'
  schedule_config: any
  enabled: boolean
  next_run_at: string
  last_run_at?: string
  recipients: string[]
  created_at: string
}

export function ScheduledReports() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchScheduledReports()
  }, [])

  const fetchScheduledReports = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/reports/scheduled')
      const json = await res.json()
      
      if (json.success) {
        setReports(json.data || [])
      } else {
        throw new Error(json.message || 'Failed to fetch scheduled reports')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load scheduled reports')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch('/api/reports/scheduled', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled })
      })
      const json = await res.json()
      
      if (json.success) {
        toast.success(`Report ${!enabled ? 'enabled' : 'disabled'}`)
        fetchScheduledReports()
      } else {
        throw new Error(json.message || 'Failed to update report')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update report')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return

    try {
      const res = await fetch(`/api/reports/scheduled?id=${id}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      
      if (json.success) {
        toast.success('Scheduled report deleted')
        fetchScheduledReports()
      } else {
        throw new Error(json.message || 'Failed to delete report')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete report')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Scheduled Reports</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Automatically generate and email reports</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Report
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Scheduled Reports
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create a scheduled report to automatically generate and email PDF reports
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Scheduled Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                    <CardDescription>
                      {report.report_type} • {report.schedule_type}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(report.id, report.enabled)}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      {report.enabled ? (
                        <ToggleRight className="h-6 w-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-400" />
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(report.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>Next run: {format(new Date(report.next_run_at), 'PPp')}</span>
                  </div>
                  {report.last_run_at && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>Last run: {format(new Date(report.last_run_at), 'PPp')}</span>
                    </div>
                  )}
                  {report.recipients.length > 0 && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Mail className="h-4 w-4" />
                      <span>{report.recipients.length} recipient(s)</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateForm && (
        <CreateScheduledReportForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false)
            fetchScheduledReports()
          }}
        />
      )}
    </div>
  )
}

function CreateScheduledReportForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    report_type: 'incidents',
    title: '',
    schedule_type: 'daily' as 'daily' | 'weekly' | 'monthly' | 'custom',
    time: '09:00',
    day_of_week: 1,
    day_of_month: 1,
    recipients: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const scheduleConfig: any = { time: formData.time }
      if (formData.schedule_type === 'weekly') {
        scheduleConfig.day_of_week = formData.day_of_week
      } else if (formData.schedule_type === 'monthly') {
        scheduleConfig.day_of_month = formData.day_of_month
      }

      const res = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: formData.report_type,
          title: formData.title,
          schedule_type: formData.schedule_type,
          schedule_config: scheduleConfig,
          filters: {}, // Default filters
          recipients: formData.recipients.split(',').map(e => e.trim()).filter(Boolean)
        })
      })

      const json = await res.json()
      
      if (json.success) {
        toast.success('Scheduled report created successfully')
        onSuccess()
      } else {
        throw new Error(json.message || 'Failed to create scheduled report')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create scheduled report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="fixed inset-4 z-50 overflow-auto bg-white dark:bg-gray-800">
      <CardHeader>
        <CardTitle>Create Scheduled Report</CardTitle>
        <CardDescription>Set up automatic report generation</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Report Type</label>
            <select
              value={formData.report_type}
              onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="incidents">Incidents</option>
              <option value="volunteers">Volunteers</option>
              <option value="analytics">Analytics</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Schedule Type</label>
            <select
              value={formData.schedule_type}
              onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Time</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          {formData.schedule_type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium mb-1">Day of Week</label>
              <select
                value={formData.day_of_week}
                onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
                <option value="7">Sunday</option>
              </select>
            </div>
          )}

          {formData.schedule_type === 'monthly' && (
            <div>
              <label className="block text-sm font-medium mb-1">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.day_of_month}
                onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email Recipients (comma-separated)</label>
            <input
              type="text"
              value={formData.recipients}
              onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="admin@example.com, manager@example.com"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? <LoadingSpinner size="sm" /> : 'Create Schedule'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

