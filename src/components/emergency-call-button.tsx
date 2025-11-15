"use client"

import { useState } from "react"
import { Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const EMERGENCY_NUMBERS = {
  "RVOIS Hotline": "09998064555",
  "Emergency Hotline": "911",
  "Fire Department": "(034) 495-1234",
  "Police Station": "(034) 495-5678",
  "City Disaster Risk Reduction": "(034) 495-9999",
  "City Health Office": "(034) 495-1111"
}

export default function EmergencyCallButton() {
  const [showNumbers, setShowNumbers] = useState(false)

  const handleCall = (number: string) => {
    // Remove any non-digit characters except + for international numbers
    const cleanNumber = number.replace(/[^\d+]/g, '')
    const telHref = `tel:${cleanNumber}`
    try {
      const a = document.createElement('a')
      a.href = telHref
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    } catch (_) { void 0 }

    try {
      window.location.href = telHref
      return
    } catch (_) { void 0 }

    try {
      window.open(telHref, '_self')
    } catch (_) { void 0 }
  }

  return (
    <>
      {/* Floating Emergency Call Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setShowNumbers(true)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full w-14 h-14 shadow-lg"
          size="lg"
        >
          <Phone className="h-6 w-6" />
        </Button>
      </div>

      {/* Emergency Numbers Modal */}
      {showNumbers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Emergency Contacts</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNumbers(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {Object.entries(EMERGENCY_NUMBERS).map(([name, number]) => (
                <div key={name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{name}</p>
                    <p className="text-sm text-gray-600">{number}</p>
                  </div>
                  <Button
                    onClick={() => handleCall(number)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> For life-threatening emergencies, call 911 immediately.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
