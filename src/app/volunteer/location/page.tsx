"use client"

import { AuthLayout } from '@/components/layout/auth-layout'
import { LocationTrackingToggle } from '@/components/volunteer/location-tracking-toggle'
import { MapPin, Info } from 'lucide-react' // Fixed import

export default function VolunteerLocationPage() {
  return (
    <AuthLayout allowedRoles={["volunteer"]}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Location Sharing</h1>
          </div>
          <p className="text-gray-600">
            Share your real-time location with the admin team for emergency response coordination
          </p>
        </div>

        {/* Information Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" /> {/* Fixed icon */}
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">How Location Sharing Works</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Your location is shared only when you enable it</li>
                <li>• Location updates only when you move more than 10 meters (battery-efficient)</li>
                <li>• Admins can see your position on a map for faster incident response</li>
                <li>• Your location is automatically removed after 30 days</li>
                <li>• You can disable sharing at any time</li>
                <li>• All data is encrypted and secure</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Location Tracking Toggle Component */}
        <LocationTrackingToggle />

        {/* Privacy Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Privacy & Data Protection</h3>
          <p className="text-sm text-gray-700">
            Your location data is used exclusively for emergency response coordination and volunteer management. 
            We comply with data protection regulations and never share your location with third parties. 
            Location history is automatically deleted after 30 days.
          </p>
        </div>

        {/* Help Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Troubleshooting</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <details className="group">
              <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                Location sharing not working?
              </summary>
              <p className="mt-2 text-gray-600 pl-4">
                Make sure location permissions are enabled in your browser settings. 
                On mobile, also check that location services are enabled in your phone's system settings.
              </p>
            </details>
            
            <details className="group">
              <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                Why is accuracy "Poor"?
              </summary>
              <p className="mt-2 text-gray-600 pl-4">
                Poor accuracy usually means you're indoors or GPS signal is weak. 
                Try moving to an area with better sky visibility or near a window.
              </p>
            </details>

            <details className="group">
              <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                Does this drain my battery?
              </summary>
              <p className="mt-2 text-gray-600 pl-4">
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
