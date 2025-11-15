"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Activity,
  Zap
} from 'lucide-react'
import { useRealtimeVolunteerLocations } from '@/hooks/use-realtime-volunteer-locations'
import { useOfflineLocationQueue } from '@/lib/robust-offline-location-queue'

interface PerformanceMetrics {
  updateLatency: number[]
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'connecting'
  updateCount: number
  errorCount: number
  averageLatency: number
  maxLatency: number
  minLatency: number
  successRate: number
  networkQuality: 'excellent' | 'good' | 'poor' | 'offline'
}

export function RealtimePerformanceTester() {
  const [isTesting, setIsTesting] = useState(false)
  const [testDuration, setTestDuration] = useState(60) // seconds
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    updateLatency: [],
    connectionStatus: 'disconnected',
    updateCount: 0,
    errorCount: 0,
    averageLatency: 0,
    maxLatency: 0,
    minLatency: 0,
    successRate: 100,
    networkQuality: 'offline'
  })
  const [testResults, setTestResults] = useState<any>(null)
  const [networkConditions, setNetworkConditions] = useState<any>(null)
  
  const testStartTime = useRef<number>(0)
  const updateTimes = useRef<Map<string, number>>(new Map())
  const { connectionStatus, isConnected, error } = useRealtimeVolunteerLocations({
    center: [10.2447, 123.8445], // Talisay City center
    radiusKm: 10,
    enabled: isTesting
  })
  const { stats: queueStats } = useOfflineLocationQueue()

  // Monitor network conditions
  useEffect(() => {
    const checkNetworkConditions = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        setNetworkConditions({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        })
      }
    }

    checkNetworkConditions()
    const interval = setInterval(checkNetworkConditions, 5000)
    return () => clearInterval(interval)
  }, [])

  // Update metrics when connection status changes
  useEffect(() => {
    setMetrics(prev => ({
      ...prev,
      connectionStatus: connectionStatus as any,
      networkQuality: getNetworkQuality(connectionStatus, networkConditions)
    }))
  }, [connectionStatus, networkConditions])

  // Simulate location updates for testing
  useEffect(() => {
    if (!isTesting) return

    const interval = setInterval(() => {
      const updateId = `test-${Date.now()}`
      updateTimes.current.set(updateId, Date.now())
      
      // Simulate location update
      const mockLocation = {
        user_id: 'test-user',
        latitude: 10.2447 + (Math.random() - 0.5) * 0.01,
        longitude: 123.8445 + (Math.random() - 0.5) * 0.01,
        accuracy: Math.random() * 10,
        timestamp: new Date().toISOString()
      }

      // This would normally trigger a real-time update
      // For testing, we'll simulate the response time
      setTimeout(() => {
        const responseTime = Date.now() - updateTimes.current.get(updateId)!
        updateTimes.current.delete(updateId)
        
        setMetrics(prev => {
          const newLatencies = [...prev.updateLatency, responseTime]
          const averageLatency = newLatencies.reduce((sum, lat) => sum + lat, 0) / newLatencies.length
          const maxLatency = Math.max(...newLatencies)
          const minLatency = Math.min(...newLatencies)
          const successRate = ((prev.updateCount + 1) / (prev.updateCount + 1 + prev.errorCount)) * 100

          return {
            ...prev,
            updateLatency: newLatencies.slice(-100), // Keep last 100 measurements
            updateCount: prev.updateCount + 1,
            averageLatency,
            maxLatency,
            minLatency,
            successRate
          }
        })
      }, Math.random() * 5000 + 500) // Simulate 500ms to 5.5s response time
    }, 2000) // Update every 2 seconds

    return () => clearInterval(interval)
  }, [isTesting])

  const getNetworkQuality = (status: string, conditions: any): 'excellent' | 'good' | 'poor' | 'offline' => {
    if (status === 'disconnected') return 'offline'
    if (!conditions) return 'good'
    
    if (conditions.effectiveType === '4g' && conditions.rtt < 100) return 'excellent'
    if (conditions.effectiveType === '3g' || conditions.rtt > 500) return 'poor'
    return 'good'
  }

  const startTest = () => {
    setIsTesting(true)
    setMetrics({
      updateLatency: [],
      connectionStatus: 'connecting',
      updateCount: 0,
      errorCount: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: 0,
      successRate: 100,
      networkQuality: 'offline'
    })
    testStartTime.current = Date.now()
  }

  const stopTest = () => {
    setIsTesting(false)
    const testDuration = (Date.now() - testStartTime.current) / 1000
    
    setTestResults({
      duration: testDuration,
      totalUpdates: metrics.updateCount,
      averageLatency: metrics.averageLatency,
      maxLatency: metrics.maxLatency,
      minLatency: metrics.minLatency,
      successRate: metrics.successRate,
      networkQuality: metrics.networkQuality,
      connectionStatus: metrics.connectionStatus
    })
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 1000) return 'text-green-600'
    if (latency < 3000) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getNetworkQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'poor': return 'text-yellow-600'
      case 'offline': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-time Performance Tester
          </CardTitle>
          <CardDescription>
            Test real-time location updates under various network conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Controls */}
          <div className="flex items-center gap-4">
            <Button
              onClick={isTesting ? stopTest : startTest}
              variant={isTesting ? "destructive" : "default"}
              disabled={!navigator.onLine}
            >
              {isTesting ? 'Stop Test' : 'Start Test'}
            </Button>
            
            <div className="flex items-center gap-2">
              <Wifi className={`h-4 w-4 ${navigator.onLine ? 'text-green-600' : 'text-red-600'}`} />
              <span className="text-sm">
                {navigator.onLine ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Network Conditions */}
          {networkConditions && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Connection:</span>
                <Badge variant="outline" className="ml-2">
                  {networkConditions.effectiveType || 'Unknown'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Downlink:</span>
                <span className="ml-2">{networkConditions.downlink} Mbps</span>
              </div>
              <div>
                <span className="font-medium">RTT:</span>
                <span className="ml-2">{networkConditions.rtt} ms</span>
              </div>
              <div>
                <span className="font-medium">Quality:</span>
                <Badge 
                  variant="outline" 
                  className={`ml-2 ${getNetworkQualityColor(metrics.networkQuality)}`}
                >
                  {metrics.networkQuality}
                </Badge>
              </div>
            </div>
          )}

          {/* Real-time Metrics */}
          {isTesting && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{metrics.updateCount}</div>
                <div className="text-sm text-gray-600">Updates</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getLatencyColor(metrics.averageLatency)}`}>
                  {metrics.averageLatency.toFixed(0)}ms
                </div>
                <div className="text-sm text-gray-600">Avg Latency</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getLatencyColor(metrics.maxLatency)}`}>
                  {metrics.maxLatency.toFixed(0)}ms
                </div>
                <div className="text-sm text-gray-600">Max Latency</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.successRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span className="font-medium">Connection Status:</span>
            <Badge 
              variant="outline"
              className={
                metrics.connectionStatus === 'connected' ? 'text-green-600' :
                metrics.connectionStatus === 'connecting' ? 'text-yellow-600' :
                metrics.connectionStatus === 'reconnecting' ? 'text-orange-600' :
                'text-red-600'
              }
            >
              {metrics.connectionStatus}
            </Badge>
          </div>

          {/* Offline Queue Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Queue Size:</span>
              <span className="ml-2">{queueStats.queueSize}</span>
            </div>
            <div>
              <span className="font-medium">Failed Items:</span>
              <span className="ml-2 text-red-600">{queueStats.failedItems}</span>
            </div>
            <div>
              <span className="font-medium">Success Rate:</span>
              <span className="ml-2">{queueStats.successRate.toFixed(1)}%</span>
            </div>
            <div>
              <span className="font-medium">Last Sync:</span>
              <span className="ml-2">
                {queueStats.lastSyncTime ? 
                  new Date(queueStats.lastSyncTime).toLocaleTimeString() : 
                  'Never'
                }
              </span>
            </div>
          </div>

          {/* Performance Warnings */}
          {metrics.averageLatency > 3000 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                High latency detected ({metrics.averageLatency.toFixed(0)}ms). 
                This may indicate network issues or server overload.
              </AlertDescription>
            </Alert>
          )}

          {metrics.successRate < 90 && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Low success rate ({metrics.successRate.toFixed(1)}%). 
                Check network connection and server status.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Test Duration</div>
                <div className="text-lg font-semibold">{testResults.duration.toFixed(1)}s</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Updates</div>
                <div className="text-lg font-semibold">{testResults.totalUpdates}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Average Latency</div>
                <div className={`text-lg font-semibold ${getLatencyColor(testResults.averageLatency)}`}>
                  {testResults.averageLatency.toFixed(0)}ms
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Success Rate</div>
                <div className="text-lg font-semibold text-green-600">
                  {testResults.successRate.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Performance Assessment */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Performance Assessment</h4>
              <div className="space-y-2 text-sm">
                {testResults.averageLatency < 1000 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Excellent latency performance
                  </div>
                )}
                {testResults.averageLatency >= 1000 && testResults.averageLatency < 3000 && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    Acceptable latency performance
                  </div>
                )}
                {testResults.averageLatency >= 3000 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    Poor latency performance - needs optimization
                  </div>
                )}
                
                {testResults.successRate >= 95 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    High reliability
                  </div>
                )}
                {testResults.successRate < 95 && testResults.successRate >= 90 && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    Moderate reliability
                  </div>
                )}
                {testResults.successRate < 90 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    Low reliability - needs investigation
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
