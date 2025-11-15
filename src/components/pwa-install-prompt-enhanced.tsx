"use client"

import { useState, useEffect } from "react"
import { Download, X, Smartphone, Monitor, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPromptEnhanced() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [showOfflineSettings, setShowOfflineSettings] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return true
      }
      
      // Check if running in PWA mode
      if (window.navigator.standalone === true) {
        setIsInstalled(true)
        return true
      }
      
      return false
    }

    const installed = checkIfInstalled()
    if (installed) return

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser mini-infobar
      e.preventDefault()
      console.log('✅ beforeinstallprompt event captured')
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Don't show if user dismissed in this session
      if (sessionStorage.getItem('rvois_install_dismissed') !== 'true') {
        setShowInstallPrompt(true)
      }
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('✅ App installed successfully')
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
      toast({
        title: "App Installed!",
        description: "RVOIS has been installed on your device"
      })
    }

    // Listen for online/offline status
    const handleOnlineStatusChange = () => {
      setIsOffline(!navigator.onLine)
    }

    // Load offline mode preference
    const loadOfflineMode = () => {
      const saved = localStorage.getItem('rvois_offline_mode')
      setOfflineMode(saved === 'true')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnlineStatusChange)
    window.addEventListener('offline', handleOnlineStatusChange)

    loadOfflineMode()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnlineStatusChange)
      window.removeEventListener('offline', handleOnlineStatusChange)
    }
  }, [toast])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.error('❌ No install prompt available')
      toast({
        variant: "destructive",
        title: "Installation Not Available",
        description: "Please try again later or check if the app is already installed."
      })
      return
    }

    try {
      console.log('⚙️ Showing install prompt...')
      // Show the browser's install prompt
      await deferredPrompt.prompt()
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('✅ User accepted the install prompt')
        toast({
          title: "Installing...",
          description: "RVOIS is being installed on your device"
        })
      } else {
        console.log('❌ User dismissed the install prompt')
      }
      
      // Clear the deferredPrompt
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error('❌ Error during installation:', error)
      toast({
        variant: "destructive",
        title: "Installation Failed",
        description: "Failed to install the app. Please try again."
      })
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    // Don't show again for this session
    sessionStorage.setItem('rvois_install_dismissed', 'true')
  }

  const handleOfflineModeToggle = (enabled: boolean) => {
    setOfflineMode(enabled)
    localStorage.setItem('rvois_offline_mode', enabled.toString())
    
    toast({
      title: enabled ? "Offline Mode Enabled" : "Offline Mode Disabled",
      description: enabled 
        ? "The app will work offline and sync when online"
        : "The app will require internet connection"
    })
  }

  // Don't show if already installed or dismissed this session
  if (isInstalled || !showInstallPrompt || sessionStorage.getItem('rvois_install_dismissed')) {
    return null
  }

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
          <Card className="bg-white shadow-xl border-2 border-blue-200">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Download className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Install RVOIS</h3>
                    <p className="text-xs text-gray-600">Get quick access to emergency services</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Smartphone className="h-4 w-4" />
                  <span>Works on mobile and desktop</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <WifiOff className="h-4 w-4" />
                  <span>Works offline with sync</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Monitor className="h-4 w-4" />
                  <span>Native app experience</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleInstallClick}
                    className="flex-1"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Install App
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDismiss}
                    size="sm"
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Offline Status Indicator */}
      <div className="fixed top-4 right-4 z-40">
        <Card className={`p-2 ${isOffline ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2">
            {isOffline ? (
              <>
                <WifiOff className="h-4 w-4 text-yellow-600" />
                <span className="text-xs text-yellow-700">Offline</span>
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-700">Online</span>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Offline Settings */}
      {showOfflineSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Offline Settings</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOfflineSettings(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Enable Offline Mode</p>
                    <p className="text-xs text-gray-500">Allow the app to work without internet</p>
                  </div>
                  <Switch
                    checked={offlineMode}
                    onCheckedChange={handleOfflineModeToggle}
                  />
                </div>

                <div className="text-xs text-gray-500">
                  <p>When offline mode is enabled:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Incident reports are saved locally</li>
                    <li>Location tracking continues</li>
                    <li>Data syncs when online</li>
                    <li>Maps work with cached tiles</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Offline Settings Button */}
      <div className="fixed bottom-4 left-4 z-40">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowOfflineSettings(true)}
          className="bg-white shadow-lg"
        >
          <WifiOff className="h-4 w-4 mr-2" />
          Offline Settings
        </Button>
      </div>
    </>
  )
}
