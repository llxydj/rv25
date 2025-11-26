// src/components/admin/sms-monitoring-dashboard.tsx
"use client"

import React, { useState, useEffect } from 'react'
import { Card, Button, LoadingSpinner, ErrorState, DataTable, StatusBadge } from '@/components/ui/enhanced-components'

interface SMSLog {
  id: string
  incident_id: string
  reference_id: string
  trigger_source: string
  recipient_user_id: string
  phone_masked: string
  template_code: string
  message_content: string
  timestamp_sent: string
  api_response_status: string
  delivery_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY'
  retry_count: number
  error_message?: string
}

interface SMSStats {
  totalSent: number
  successRate: number
  failureRate: number
  recentActivity: Array<{
    date: string
    sent: number
    success: number
    failed: number
  }>
}

export const SMSMonitoringDashboard: React.FC = () => {
  const [logs, setLogs] = useState<SMSLog[]>([])
  const [stats, setStats] = useState<SMSStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    status: '',
    incidentId: '',
    startDate: '',
    endDate: ''
  })
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    fetchSMSLogs()
    fetchSMSStats()
  }, [filters])

  // Fetch SMS logs via API endpoint
  const fetchSMSLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.incidentId) params.append('incident_id', filters.incidentId)
      if (filters.startDate) params.append('start_date', filters.startDate)
      if (filters.endDate) params.append('end_date', filters.endDate)

      const response = await fetch(`/api/sms?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setLogs(result.data)
        setError(null)
      } else {
        setError(result.message || 'Failed to fetch SMS logs')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch SMS logs')
    } finally {
      setLoading(false)
    }
  }

  // Fetch SMS stats via secure API endpoint
  const fetchSMSStats = async () => {
    try {
      const response = await fetch('/api/sms?stats=true')
      const result = await response.json()

      if (result.success) {
        setStats(result.data)
      } else {
        console.error('Failed to fetch SMS stats:', result.message)
      }
    } catch (err: any) {
      console.error('Failed to fetch SMS stats:', err)
    }
  }

  const handleRetryFailed = async () => {
    try {
      setRetrying(true)
      const response = await fetch('/api/sms/retry', { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        alert(`Retried ${result.retried} failed SMS sends`)
        fetchSMSLogs()
        fetchSMSStats()
      } else {
        alert('Failed to retry SMS sends')
      }
    } catch (err: any) {
      alert(`Error retrying SMS: ${err.message}`)
    } finally {
      setRetrying(false)
    }
  }

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const response = await fetch(`/api/sms?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        const csv = convertToCSV(result.data)
        downloadCSV(csv, `sms-logs-${new Date().toISOString().split('T')[0]}.csv`)
      }
    } catch (err: any) {
      alert(`Error exporting logs: ${err.message}`)
    }
  }

  const convertToCSV = (data: SMSLog[]): string => {
    const headers = [
      'ID', 'Incident ID', 'Reference ID', 'Trigger Source', 'Recipient User ID',
      'Phone Masked', 'Template Code', 'Message Content', 'Timestamp Sent',
      'API Response Status', 'Delivery Status', 'Retry Count', 'Error Message'
    ]

    const rows = data.map(log => [
      log.id, log.incident_id, log.reference_id, log.trigger_source,
      log.recipient_user_id, log.phone_masked, log.template_code,
      log.message_content, log.timestamp_sent, log.api_response_status,
      log.delivery_status, log.retry_count, log.error_message || ''
    ])

    return [headers, ...rows].map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n')
  }

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const columns = [
    {
      key: 'reference_id',
      label: 'Ref ID',
      render: (value: string) => <span className="font-mono text-sm font-medium text-blue-600">#{value}</span>
    },
    {
      key: 'trigger_source',
      label: 'Trigger',
      render: (value: string) => <span className="text-sm text-gray-600">{value.replace(/_/g, ' ')}</span>
    },
    {
      key: 'phone_masked',
      label: 'Recipient',
      render: (value: string) => <span className="font-mono text-sm text-gray-600">{value}</span>
    },
    {
      key: 'delivery_status',
      label: 'Status',
      render: (value: string) => {
        const statusMap = { PENDING: 'PENDING', SUCCESS: 'RESOLVED', FAILED: 'CANCELLED', RETRY: 'PENDING' } as const
        return <StatusBadge status={statusMap[value as keyof typeof statusMap] || 'PENDING'} size="sm" />
      }
    },
    {
      key: 'timestamp_sent',
      label: 'Sent At',
      render: (value: string) => <span className="text-sm text-gray-600">{new Date(value).toLocaleString()}</span>
    },
    {
      key: 'retry_count',
      label: 'Retries',
      render: (value: number) => <span className="text-sm text-gray-600">{value}</span>
    },
    {
      key: 'error_message',
      label: 'Error',
      render: (value: string) => value ? <span className="text-sm text-red-600 truncate max-w-xs" title={value}>{value}</span> : <span className="text-sm text-gray-400">-</span>
    }
  ]

  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" text="Loading SMS logs..." />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load SMS logs" message={error} onRetry={fetchSMSLogs} />
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalSent}</div>
              <div className="text-sm text-gray-600">Total Sent</div>
            </div>
          </Card>
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.successRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
          </Card>
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failureRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Failure Rate</div>
            </div>
          </Card>
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <Button variant="warning" size="sm" onClick={handleRetryFailed} loading={retrying} disabled={retrying}>
                Retry Failed
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card variant="outlined" padding="md">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={filters.status} onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">All Status</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Incident ID</label>
            <input type="text" value={filters.incidentId} onChange={(e) => setFilters(prev => ({ ...prev, incidentId: e.target.value }))} placeholder="Search incident..." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="md" onClick={exportLogs} className="w-full">Export CSV</Button>
          </div>
        </div>
      </Card>

      {/* SMS Logs Table */}
      <DataTable data={logs} columns={columns} loading={loading} emptyMessage="No SMS logs found" className="min-h-96" />

      {/* Recent Activity Chart */}
      {stats && stats.recentActivity.length > 0 && (
        <Card variant="elevated" padding="lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity (Last 7 Days)</h3>
          <div className="space-y-2">
            {stats.recentActivity.slice(-7).map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm font-medium text-gray-700">{new Date(activity.date).toLocaleDateString()}</span>
                <div className="flex space-x-4 text-sm">
                  <span className="text-gray-600">Sent: <span className="font-medium">{activity.sent}</span></span>
                  <span className="text-green-600">Success: <span className="font-medium">{activity.success}</span></span>
                  <span className="text-red-600">Failed: <span className="font-medium">{activity.failed}</span></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
