"use client"

import { useState, useEffect } from "react"
import { Download, X, Smartphone, Monitor, Wifi, WifiOff, Settings } from "lucide-react"
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
  const [isDismissed, setIsDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
    
    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return true
      }
      
      // Check if running in PWA mode (iOS)
      if (window.navigator.standalone === true) {
        setIsInstalled(true)
        return true
      }
      
      return false
    }

    const installed = checkIfInstalled()
    if (installed) return

    // Check if dismissed this session
    const dismissed = sessionStorage.getItem('rvois_install_dismissed') === 'true'
    setIsDismissed(dismissed)

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      console.log('✅ beforeinstallprompt event captured')
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      if (!dismissed) {
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
      const offline = !navigator.onLine
      setIsOffline(offline)
      
      // Show toast on status change
      if (offline) {
        toast({
          title: "You're Offline",
          description: "Some features may be limited",
          variant: "default"
        })
      } else {
        toast({
          title: "Back Online",
          description: "All features are now available"
        })
      }
    }

    // Load offline mode preference
    const loadOfflineMode = () => {
      const saved = localStorage.getItem('rvois_offline_mode')
      setOfflineMode(saved === 'true')
    }

    // Check initial online status
    setIsOffline(!navigator.onLine)

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
      await deferredPrompt.prompt()
      
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
    setIsDismissed(true)
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

  // Don't render until mounted (avoid hydration issues)
  if (!mounted) return null

  // Don't show if already installed or dismissed
  if (isInstalled || isDismissed) {
    return null
  }

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-in slide-in-from-bottom-5 duration-300">
          <Card className="bg-white dark:bg-gray-800 shadow-xl border-2 border-blue-200 dark:border-blue-800">
            <div className="p-3 md:p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Download className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm md:text-base text-gray-900 dark:text-white truncate">
                      Install RVOIS
                    </h3>
                    <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400">
                      Quick access to emergency services
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-6 w-6 p-0 flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </Button>
              </div>

              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  <Smartphone className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Works on mobile and desktop</span>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  <WifiOff className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Works offline with sync</span>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  <Monitor className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Native app experience</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleInstallClick}
                    className="flex-1 text-xs md:text-sm h-8 md:h-9"
                    size="sm"
                  >
                    <Download className="h-3 w-3 md:h-4 md:w-4 mr-1.5" />
                    Install App
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDismiss}
                    size="sm"
                    className="text-xs md:text-sm h-8 md:h-9 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    Later
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Offline Status Indicator - Only show when offline */}
      {isOffline && (
        <div className="fixed top-4 right-4 z-40 animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 shadow-lg">
            <div className="flex items-center gap-2 px-3 py-2">
              <WifiOff className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <span className="text-xs md:text-sm font-medium text-yellow-700 dark:text-yellow-300">
                Offline Mode
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOfflineSettings(true)}
                className="h-6 w-6 p-0 ml-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                aria-label="Offline settings"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Offline Settings Modal */}
      {showOfflineSettings && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowOfflineSettings(false)}
        >
          <Card
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                  Offline Settings
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOfflineSettings(false)}
                  className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Offline Mode
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Allow the app to work without internet
                    </p>
                  </div>
                  <Switch
                    checked={offlineMode}
                    onCheckedChange={handleOfflineModeToggle}
                    className="flex-shrink-0"
                  />
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 md:p-4">
                  <p className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    When offline mode is enabled:
                  </p>
                  <ul className="space-y-1.5 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span>Incident reports are saved locally</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span>Location tracking continues</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span>Data syncs when online</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span>Maps work with cached tiles</span>
                    </li>
                  </ul>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => setShowOfflineSettings(false)}
                    className="text-xs md:text-sm"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}