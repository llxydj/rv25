"use client"

import { useEffect, useState } from "react"
import { WifiOff, RefreshCw, Home, AlertTriangle, Download, MapPin, FileText, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import { offlineStorageService } from "@/lib/offline-storage"

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)
  const [offlineStatus, setOfflineStatus] = useState({
    isOffline: true,
    pendingIncidents: 0,
    pendingLocations: 0,
    lastSync: null as string | null
  })
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const handleOnlineStatusChange = () => {
      setIsOnline(navigator.onLine)
    }

    const loadOfflineStatus = async () => {
      try {
        const status = await offlineStorageService.getOfflineStatus()
        setOfflineStatus(status)
      } catch (error) {
        console.error('Error loading offline status:', error)
      }
    }

    // Check initial online status
    setIsOnline(navigator.onLine)
    loadOfflineStatus()

    // Listen for online/offline events
    window.addEventListener("online", handleOnlineStatusChange)
    window.addEventListener("offline", handleOnlineStatusChange)

    // Update status periodically
    const interval = setInterval(loadOfflineStatus, 5000)

    return () => {
      window.removeEventListener("online", handleOnlineStatusChange)
      window.removeEventListener("offline", handleOnlineStatusChange)
      clearInterval(interval)
    }
  }, [])

  const handleRefresh = () => {
    if (isOnline) {
      window.location.reload()
    }
  }

  const handleGoHome = () => {
    router.push("/")
  }

  const handleDownloadOfflineData = async () => {
    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      // Simulate download progress
      const interval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            setIsDownloading(false)
            return 100
          }
          return prev + 10
        })
      }, 200)

      // Trigger map tile caching
      await fetch('/api/cache-map-tiles', { method: 'POST' })
    } catch (error) {
      console.error('Error downloading offline data:', error)
      setIsDownloading(false)
    }
  }

  const handleSyncData = async () => {
    if (!isOnline) return

    try {
      // Trigger background sync
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        if (registration.sync) {
          await registration.sync.register('incident-sync')
          await registration.sync.register('location-sync')
        }
      }
    } catch (error) {
      console.error('Error syncing data:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Main Offline Card */}
        <Card className="p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <WifiOff className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Offline</h1>
            <p className="text-gray-600">
              It looks like you're not connected to the internet. Some features are still available offline.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleRefresh}
              disabled={!isOnline}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {isOnline ? "Refresh Page" : "Waiting for Connection..."}
            </Button>

            <Button
              variant="outline"
              onClick={handleGoHome}
              className="w-full"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Home
            </Button>
          </div>
        </Card>

        {/* Offline Status */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Offline Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-900">Pending Incidents</p>
              <p className="text-2xl font-bold text-blue-600">{offlineStatus.pendingIncidents}</p>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <MapPin className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-900">Pending Locations</p>
              <p className="text-2xl font-bold text-green-600">{offlineStatus.pendingLocations}</p>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Wifi className="h-6 w-6 text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Last Sync</p>
              <p className="text-xs text-gray-600">
                {offlineStatus.lastSync 
                  ? new Date(offlineStatus.lastSync).toLocaleString()
                  : 'Never'
                }
              </p>
            </div>
          </div>

          {isOnline && (
            <Button
              onClick={handleSyncData}
              className="w-full"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Data Now
            </Button>
          )}
        </Card>

        {/* Offline Features */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Offline Features</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Map Tiles</p>
                  <p className="text-xs text-yellow-700">Cached for offline viewing</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleDownloadOfflineData}
                disabled={isDownloading}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </>
                )}
              </Button>
            </div>

            {isDownloading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Downloading map tiles...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-900">Incident Reports</p>
                  <p className="text-xs text-green-700">Save locally, sync when online</p>
                </div>
              </div>
              <div className="text-green-600 text-sm font-medium">✓ Available</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Location Tracking</p>
                  <p className="text-xs text-blue-700">Continue tracking offline</p>
                </div>
              </div>
              <div className="text-blue-600 text-sm font-medium">✓ Available</div>
            </div>
          </div>
        </Card>

        {/* Tips */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Offline Tips</h2>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Report Incidents Offline</p>
                <p className="text-xs text-gray-600">
                  You can still report incidents. They'll be saved locally and synced when you're back online.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Download Map Data</p>
                <p className="text-xs text-gray-600">
                  Download map tiles for better offline experience. This will cache the Talisay City area.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Automatic Sync</p>
                <p className="text-xs text-gray-600">
                  Your data will automatically sync when you're back online. No action needed.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}