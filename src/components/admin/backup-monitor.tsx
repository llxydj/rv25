"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface BackupLog {
  id: string
  action: string
  details: string
  error_message?: string
  created_at: string
}

export function BackupMonitor() {
  const [logs, setLogs] = useState<BackupLog[]>([])
  const [loading, setLoading] = useState(true)
  const [triggeringBackup, setTriggeringBackup] = useState(false)

  const fetchBackupLogs = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .or('action.eq.BACKUP_SUCCESS,action.eq.BACKUP_FAILURE,action.eq.BACKUP_ALERT')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) {
        console.error('Failed to fetch backup logs:', error)
        return
      }
      
      setLogs(data || [])
    } catch (error) {
      console.error('Error fetching backup logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerManualBackup = async () => {
    try {
      setTriggeringBackup(true)
      const response = await fetch('/api/backup', { method: 'POST' })
      const result = await response.json()
      
      if (result.success) {
        console.log('Manual backup triggered successfully')
      } else {
        console.error('Failed to trigger manual backup:', result.message)
      }
      
      // Refresh logs after triggering backup
      await fetchBackupLogs()
    } catch (error) {
      console.error('Error triggering manual backup:', error)
    } finally {
      setTriggeringBackup(false)
    }
  }

  useEffect(() => {
    fetchBackupLogs()
    
    // Refresh logs every 30 seconds
    const interval = setInterval(fetchBackupLogs, 30000)
    return () => clearInterval(interval)
  }, [])

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'BACKUP_SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'BACKUP_FAILURE':
      case 'BACKUP_ALERT':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-blue-500" />
    }
  }

  const getLogVariant = (action: string) => {
    switch (action) {
      case 'BACKUP_SUCCESS':
        return 'default'
      case 'BACKUP_FAILURE':
      case 'BACKUP_ALERT':
        return 'destructive'
      default:
        return 'default'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getLastSuccess = () => {
    const lastSuccess = logs.find(log => log.action === 'BACKUP_SUCCESS')
    return lastSuccess ? formatDate(lastSuccess.created_at) : 'Never'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Backup Monitor</CardTitle>
            <CardDescription>Automated incident data backups</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchBackupLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              onClick={triggerManualBackup}
              disabled={triggeringBackup}
            >
              {triggeringBackup ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Backing Up...
                </>
              ) : (
                'Manual Backup'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-800">Last Success</div>
            <div className="text-lg font-semibold text-green-900">{getLastSuccess()}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-800">Backup Interval</div>
            <div className="text-lg font-semibold text-blue-900">Every hour</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-800">Retention</div>
            <div className="text-lg font-semibold text-purple-900">30 days</div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Recent Backup Activity</h3>
          {loading ? (
            <div className="text-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
              <p className="mt-2 text-sm text-gray-500">Loading backup logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No backup activity found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Alert key={log.id} variant={getLogVariant(log.action)}>
                  <div className="flex items-start">
                    {getLogIcon(log.action)}
                    <div className="ml-3 flex-1">
                      <AlertDescription>
                        <div className="font-medium">{log.details}</div>
                        <div className="text-xs mt-1 text-gray-500">
                          {formatDate(log.created_at)}
                        </div>
                        {log.error_message && (
                          <div className="text-xs mt-1 text-red-600">
                            Error: {log.error_message}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}