"use client"

import { AuthLayout } from '@/components/layout/auth-layout'
import { LocationTrackingToggle } from '@/components/volunteer/location-tracking-toggle'
import { MapPin, Info, HelpCircle, Shield, AlertCircle } from 'lucide-react'

export default function VolunteerLocationPage() {
  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <MapPin className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              Location Sharing
            </h1>
          </div>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            Share your real-time location with the admin team for emergency response coordination
          </p>
        </div>

        {/* Information Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 md:p-4">
          <div className="flex items-start gap-2 md:gap-3">
            <Info className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm md:text-base font-semibold text-blue-900 dark:text-blue-200 mb-2">
                How Location Sharing Works
              </h3>
              <ul className="space-y-1 md:space-y-1.5 text-xs md:text-sm text-blue-800 dark:text-blue-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Your location is shared only when you enable it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Location updates only when you move more than 10 meters (battery-efficient)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Admins can see your position on a map for faster incident response</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>Your location is automatically removed after 30 days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>You can disable sharing at any time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span>All data is encrypted and secure</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Location Tracking Toggle Component */}
        <LocationTrackingToggle />

        {/* Privacy Notice */}
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 md:p-4">
          <div className="flex items-start gap-2 md:gap-3 mb-2">
            <Shield className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">
              Privacy & Data Protection
            </h3>
          </div>
          <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            Your location data is used exclusively for emergency response coordination and volunteer management. 
            We comply with data protection regulations and never share your location with third parties. 
            Location history is automatically deleted after 30 days.
          </p>
        </div>

        {/* Help Section */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <HelpCircle className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-white">
              Troubleshooting
            </h3>
          </div>
          <div className="space-y-2 md:space-y-3 text-xs md:text-sm text-gray-700 dark:text-gray-300">
            <details className="group">
              <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1 list-none flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                <span>Location sharing not working?</span>
              </summary>
              <p className="mt-2 text-gray-600 dark:text-gray-400 pl-5 md:pl-6 leading-relaxed">
                Make sure location permissions are enabled in your browser settings. 
                On mobile, also check that location services are enabled in your phone's system settings.
              </p>
            </details>
            
            <details className="group">
              <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1 list-none flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                <span>Why is accuracy "Poor"?</span>
              </summary>
              <p className="mt-2 text-gray-600 dark:text-gray-400 pl-5 md:pl-6 leading-relaxed">
                Poor accuracy usually means you're indoors or GPS signal is weak. 
                Try moving to an area with better sky visibility or near a window.
              </p>
            </details>

            <details className="group">
              <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1 list-none flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                <span>Does this drain my battery?</span>
              </summary>
              <p className="mt-2 text-gray-600 dark:text-gray-400 pl-5 md:pl-6 leading-relaxed">
                No. The system only updates when you move more than 10 meters and uses 
                battery-optimized location tracking to minimize power consumption.
              </p>
            </details>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}