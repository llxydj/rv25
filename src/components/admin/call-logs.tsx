"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, Clock, User, FileText } from 'lucide-react'

interface CallLog {
  id: string
  user_id: string
  contact_id: string
  contact_name: string
  contact_number: string
  call_type: 'emergency' | 'incident' | 'volunteer' | 'reporter' | 'admin'
  incident_id: string | null
  duration: number | null
  status: 'initiated' | 'connected' | 'missed' | 'failed' | 'completed'
  notes: string | null
  created_at: string
  updated_at: string
}

export function CallLogsManager() {
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    call_type: '',
    status: '',
    user_id: ''
  })

  useEffect(() => {
    fetchCallLogs()
  }, [filters])

  const fetchCallLogs = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.call_type && filters.call_type !== 'all') params.append('call_type', filters.call_type)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.user_id) params.append('user_id', filters.user_id)

      const response = await fetch(`/api/call-logs?${params.toString()}`)
      const result = await response.json()
      if (result.success) {
        setCallLogs(result.data)
      }
    } catch (error) {
      console.error('Error fetching call logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      initiated: 'bg-blue-100 text-blue-800',
      connected: 'bg-green-100 text-green-800',
      missed: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getTypeColor = (type: string) => {
    const colors = {
      emergency: 'bg-red-100 text-red-800',
      incident: 'bg-orange-100 text-orange-800',
      volunteer: 'bg-blue-100 text-blue-800',
      reporter: 'bg-green-100 text-green-800',
      admin: 'bg-purple-100 text-purple-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return <div className="p-6">Loading call logs...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Call Logs</h2>
        <Button onClick={fetchCallLogs}>
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
              <Label htmlFor="call_type">Call Type</Label>
              <Select
                value={filters.call_type}
                onValueChange={(value) => setFilters({ ...filters, call_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="reporter">Reporter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="initiated">Initiated</SelectItem>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="user_id">User ID</Label>
              <Input
                id="user_id"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                placeholder="Filter by user ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {callLogs.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span className="font-semibold">{log.contact_name}</span>
                      <Badge className={getTypeColor(log.call_type)}>
                        {log.call_type.toUpperCase()}
                      </Badge>
                      <Badge className={getStatusColor(log.status)}>
                        {log.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{log.contact_number}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(log.duration)}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {log.user_id}
                      </div>
                    </div>
                    {log.incident_id && (
                      <div className="text-sm text-blue-600">
                        Incident: {log.incident_id}
                      </div>
                    )}
                    {log.notes && (
                      <div className="flex items-start gap-2 text-sm">
                        <FileText className="w-4 h-4 mt-0.5" />
                        <span>{log.notes}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {callLogs.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No call logs found</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

