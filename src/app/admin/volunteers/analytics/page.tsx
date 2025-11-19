"use client"

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Download, BarChart3, TrendingUp, Clock, MapPin, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { format, subDays, subWeeks, subMonths } from 'date-fns'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function VolunteerAnalyticsPage() {
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('')
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    fetchVolunteers()
  }, [])

  useEffect(() => {
    if (selectedVolunteer) {
      fetchAnalytics()
    }
  }, [selectedVolunteer, dateRange, startDate, endDate])

  const fetchVolunteers = async () => {
    try {
      setLoading(true)
      const { getAllVolunteers } = await import('@/lib/volunteers')
      const result = await getAllVolunteers()
      
      if (result.success) {
        setVolunteers(result.data || [])
        if (result.data && result.data.length > 0) {
          setSelectedVolunteer(result.data[0].id)
        }
      } else {
        setError(result.message || 'Failed to fetch volunteers')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch volunteers')
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    if (!selectedVolunteer) return

    try {
      setLoading(true)
      setError(null)

      let start: string | undefined
      let end: string | undefined

      if (dateRange === '7d') {
        start = subDays(new Date(), 7).toISOString()
        end = new Date().toISOString()
      } else if (dateRange === '30d') {
        start = subDays(new Date(), 30).toISOString()
        end = new Date().toISOString()
      } else if (dateRange === '90d') {
        start = subDays(new Date(), 90).toISOString()
        end = new Date().toISOString()
      } else if (dateRange === 'all') {
        // No date filter
      }

      if (startDate) start = new Date(startDate).toISOString()
      if (endDate) end = new Date(endDate).toISOString()

      const params = new URLSearchParams()
      params.append('volunteer_id', selectedVolunteer)
      if (start) params.append('start_date', start)
      if (end) params.append('end_date', end)
      // Add limit for large datasets (50000 max)
      params.append('limit', '50000')

      const response = await fetch(`/api/volunteers/analytics?${params.toString()}`)
      const result = await response.json()
      
      if (!result.success) {
        setError(result.message || 'Failed to fetch analytics')
        return
      }
      
      if (result.success) {
        setAnalytics(result.data)
        
        // Show warning if dataset is large
        if (result.data?.total_incidents && result.data.total_incidents > 10000) {
          console.warn(`Large dataset detected: ${result.data.total_incidents} incidents. Consider using date filters.`)
        }
        
        // Show info about limit if dataset is at limit
        if (result.data?.total_incidents && result.data.total_incidents >= 50000) {
          console.info('Dataset reached the 50,000 incident limit. Results may be incomplete. Use date filters for complete data.')
        }
      } else {
        setError(result.message || 'Failed to fetch analytics')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = async () => {
    if (!selectedVolunteer || !analytics) return

    try {
      let start: string | undefined
      let end: string | undefined

      if (dateRange === '7d') {
        start = subDays(new Date(), 7).toISOString()
        end = new Date().toISOString()
      } else if (dateRange === '30d') {
        start = subDays(new Date(), 30).toISOString()
        end = new Date().toISOString()
      } else if (dateRange === '90d') {
        start = subDays(new Date(), 90).toISOString()
        end = new Date().toISOString()
      }

      if (startDate) start = new Date(startDate).toISOString()
      if (endDate) end = new Date(endDate).toISOString()

      const params = new URLSearchParams()
      params.append('volunteer_id', selectedVolunteer)
      params.append('export', 'csv')
      if (start) params.append('start_date', start)
      if (end) params.append('end_date', end)

      const response = await fetch(`/api/volunteers/analytics?${params.toString()}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `volunteer-analytics-${selectedVolunteer}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV')
    }
  }

  const selectedVolunteerName = volunteers.find(v => v.id === selectedVolunteer)?.first_name + ' ' + volunteers.find(v => v.id === selectedVolunteer)?.last_name

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Volunteer Analytics</h1>
            <p className="text-gray-600 mt-1">Comprehensive analytics and profiling for volunteers</p>
          </div>
          {analytics && (
            <Button onClick={exportToCSV} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Analytics are limited to 50,000 incidents per query for performance. Use date filters to narrow results for large datasets.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Volunteer</Label>
              <Select value={selectedVolunteer} onValueChange={setSelectedVolunteer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select volunteer" />
                </SelectTrigger>
                <SelectContent>
                  {volunteers.map(volunteer => (
                    <SelectItem key={volunteer.id} value={volunteer.id}>
                      {volunteer.first_name} {volunteer.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date (Optional)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date (Optional)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Loading analytics..." />
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Data Limit Notice */}
            {analytics.total_incidents >= 50000 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Data Limit Reached</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        This volunteer has {analytics.total_incidents.toLocaleString()} incidents, which exceeds the 50,000 row limit for analytics queries.
                        Results shown are based on the most recent 50,000 incidents.
                      </p>
                      <p className="mt-2">
                        <strong>Tip:</strong> Use date filters to narrow the date range and get complete analytics for a specific period.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Incidents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.total_incidents}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Resolved</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{analytics.total_resolved}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg Response Time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics.average_response_time_minutes !== null
                      ? `${analytics.average_response_time_minutes} min`
                      : 'N/A'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Resolution Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {analytics.total_incidents > 0
                      ? Math.round((analytics.total_resolved / analytics.total_incidents) * 100)
                      : 0}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Incidents by Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Incidents by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(analytics.incidents_by_type).map(([name, value]) => ({
                          name,
                          value
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.entries(analytics.incidents_by_type).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Incidents by Severity */}
              <Card>
                <CardHeader>
                  <CardTitle>Incidents by Severity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Object.entries(analytics.incidents_by_severity).map(([name, value]) => ({
                        name,
                        count: value
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.monthly_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Incidents by Barangay */}
              <Card>
                <CardHeader>
                  <CardTitle>Incidents by Barangay</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Object.entries(analytics.incidents_by_barangay)
                        .map(([name, value]) => ({ name, count: value as number }))
                        .sort((a, b) => (b.count as number) - (a.count as number))
                        .slice(0, 10)}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Recent Incidents */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barangay</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analytics.recent_incidents.map((incident: any) => (
                        <tr key={incident.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{incident.incident_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {new Date(incident.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="outline">{incident.severity || 'N/A'}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge>{incident.status}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {incident.response_time_minutes !== null
                              ? `${incident.response_time_minutes} min`
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{incident.barangay || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Select a volunteer to view analytics</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}

