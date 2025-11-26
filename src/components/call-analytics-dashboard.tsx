"use client"

import { useState, useEffect } from "react"
import { Phone, Clock, TrendingUp, Users, AlertTriangle, BarChart3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { callService, CallLog } from "@/lib/call-service"
import { useAuth } from "@/lib/auth"

interface CallAnalyticsDashboardProps {
  className?: string
}

export function CallAnalyticsDashboard({ className = "" }: CallAnalyticsDashboardProps) {
  const { user } = useAuth()
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [statistics, setStatistics] = useState({
    totalCalls: 0,
    callsByType: {} as Record<string, number>,
    recentCalls: 0,
    averageDuration: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        await callService.initialize(user.id)
        
        const logs = callService.getCallLogs(100)
        const stats = callService.getCallStatistics()
        
        setCallLogs(logs)
        setStatistics(stats)
      } catch (error) {
        console.error('Failed to load call analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [user])

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getStatusColor = (status: CallLog['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'connected': return 'text-blue-600'
      case 'missed': return 'text-yellow-600'
      case 'failed': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'emergency': return 'bg-red-100 text-red-800'
      case 'incident': return 'bg-blue-100 text-blue-800'
      case 'volunteer': return 'bg-green-100 text-green-800'
      case 'reporter': return 'bg-purple-100 text-purple-800'
      case 'admin': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg mt-4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Calls</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.totalCalls}</p>
            </div>
            <Phone className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recent Calls</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.recentCalls}</p>
              <p className="text-xs text-gray-500">Last 7 days</p>
            </div>
            <Clock className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Duration</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(statistics.averageDuration)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Call Types</p>
              <p className="text-2xl font-bold text-gray-900">
                {Object.keys(statistics.callsByType).length}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recent">Recent Calls</TabsTrigger>
          <TabsTrigger value="types">By Type</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Call Types Distribution */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Calls by Type</h3>
              <div className="space-y-3">
                {Object.entries(statistics.callsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getTypeColor(type)}>
                        {type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ 
                            width: `${(count / statistics.totalCalls) * 100}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Call Status Distribution */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Status</h3>
              <div className="space-y-3">
                {['completed', 'connected', 'missed', 'failed'].map((status) => {
                  const count = callLogs.filter(log => log.status === status).length
                  const percentage = statistics.totalCalls > 0 
                    ? (count / statistics.totalCalls) * 100 
                    : 0
                  
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'completed' ? 'bg-green-500' :
                          status === 'connected' ? 'bg-blue-500' :
                          status === 'missed' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}></div>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              status === 'completed' ? 'bg-green-500' :
                              status === 'connected' ? 'bg-blue-500' :
                              status === 'missed' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Recent Calls Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Call Activity</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {callLogs.slice(0, 20).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{log.contact_name}</span>
                      <Badge className={getTypeColor(log.call_type)}>
                        {log.call_type}
                      </Badge>
                      <span className={`text-sm ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{log.contact_number}</p>
                      <p className="text-xs">
                        {formatTimeAgo(log.created_at)}
                        {log.duration && ` • ${formatDuration(log.duration)}`}
                        {log.incident_id && ` • Incident: ${log.incident_id.slice(0, 8)}...`}
                      </p>
                      {log.notes && (
                        <p className="text-xs text-gray-500 mt-1">{log.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* By Type Tab */}
        <TabsContent value="types" className="space-y-4">
          {Object.entries(statistics.callsByType).map(([type, count]) => (
            <Card key={type} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge className={getTypeColor(type)}>
                    {type}
                  </Badge>
                  <span className="text-lg font-semibold text-gray-900">
                    {count} calls
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {((count / statistics.totalCalls) * 100).toFixed(1)}% of total
                </div>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {callLogs
                  .filter(log => log.call_type === type)
                  .slice(0, 10)
                  .map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.contact_name}</span>
                          <span className={getStatusColor(log.status)}>
                            {log.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatTimeAgo(log.created_at)}
                          {log.duration && ` • ${formatDuration(log.duration)}`}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
