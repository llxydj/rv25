"use client"

import { useState, useEffect } from "react"
import { Phone, User, AlertTriangle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { callService, CallLog } from "@/lib/call-service"
import { useAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"

interface IncidentCallActionsProps {
  incident: {
    id: string
    reporter?: {
      id: string
      first_name: string
      last_name: string
      phone_number?: string
    }
    assigned_to?: {
      id: string
      first_name: string
      last_name: string
      phone_number?: string
    }
    status: string
    incident_type: string
    priority: number
  }
  userRole: 'admin' | 'volunteer' | 'resident'
  onCallComplete?: (callLog: CallLog) => void
}

export function IncidentCallActions({ 
  incident, 
  userRole, 
  onCallComplete 
}: IncidentCallActionsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadCallLogs = async () => {
      if (!user?.id) return

      try {
        await callService.initialize(user.id)
        const logs = callService.getCallLogs(10)
        setCallLogs(logs.filter(log => log.incident_id === incident.id))
      } catch (error) {
        console.error('Failed to load call logs:', error)
      }
    }

    loadCallLogs()
  }, [user, incident.id])

  const handleCall = async (
    number: string, 
    name: string, 
    callType: CallLog['call_type'],
    notes?: string
  ) => {
    if (!number) {
      toast({
        variant: "destructive",
        title: "No Phone Number",
        description: "Phone number not available for this contact"
      })
      return
    }

    try {
      setLoading(true)
      const result = await callService.makeCallToNumber(
        number, 
        name, 
        callType, 
        incident.id,
        notes
      )

      if (result.success) {
        toast({
          title: "Call Initiated",
          description: result.message
        })

        // Refresh call logs
        const logs = callService.getCallLogs(10)
        setCallLogs(logs.filter(log => log.incident_id === incident.id))
        
        if (onCallComplete && result.callId) {
          const newLog = logs.find(log => log.id === result.callId)
          if (newLog) onCallComplete(newLog)
        }
      } else {
        toast({
          variant: "destructive",
          title: "Call Failed",
          description: result.message
        })
      }
    } catch (error) {
      console.error('Error making call:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to make call"
      })
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'bg-red-100 text-red-800'
    if (priority >= 3) return 'bg-orange-100 text-orange-800'
    if (priority >= 2) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getPriorityText = (priority: number) => {
    if (priority >= 4) return 'Critical'
    if (priority >= 3) return 'High'
    if (priority >= 2) return 'Medium'
    return 'Low'
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

  return (
    <div className="space-y-4">
      {/* Incident Info */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Incident Details</h3>
          <Badge className={getPriorityColor(incident.priority)}>
            {getPriorityText(incident.priority)} Priority
          </Badge>
        </div>
        <div className="text-sm text-gray-600">
          <p><strong>Type:</strong> {incident.incident_type}</p>
          <p><strong>Status:</strong> {incident.status}</p>
        </div>
      </Card>

      {/* Call Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Call Reporter */}
        {incident.reporter && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-gray-900">Reporter</h4>
              </div>
              {incident.reporter.phone_number && (
                <Badge variant="outline" className="text-green-600">
                  Available
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 mb-3">
              <p><strong>Name:</strong> {[incident.reporter.first_name, incident.reporter.last_name].filter(Boolean).join(' ') || 'Anonymous Reporter'}</p>
              <p><strong>Phone:</strong> {incident.reporter.phone_number || 'Not provided'}</p>
            </div>
            {incident.reporter.phone_number && (
              <Button
                onClick={() => handleCall(
                  incident.reporter!.phone_number!,
                  [incident.reporter!.first_name, incident.reporter!.last_name].filter(Boolean).join(' ') || 'Anonymous Reporter',
                  'reporter',
                  `Calling reporter about ${incident.incident_type} incident`
                )}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Reporter
              </Button>
            )}
          </Card>
        )}

        {/* Call Assigned Volunteer */}
        {incident.assigned_to && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-gray-900">Assigned Volunteer</h4>
              </div>
              {incident.assigned_to.phone_number && (
                <Badge variant="outline" className="text-green-600">
                  Available
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 mb-3">
              <p><strong>Name:</strong> {incident.assigned_to.first_name} {incident.assigned_to.last_name}</p>
              <p><strong>Phone:</strong> {incident.assigned_to.phone_number || 'Not provided'}</p>
            </div>
            {incident.assigned_to.phone_number && (
              <Button
                onClick={() => handleCall(
                  incident.assigned_to!.phone_number!,
                  `${incident.assigned_to!.first_name} ${incident.assigned_to!.last_name}`,
                  'volunteer',
                  `Calling assigned volunteer about ${incident.incident_type} incident`
                )}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Volunteer
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Emergency Contacts Quick Access */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h4 className="font-medium text-gray-900">Emergency Contacts</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button
            onClick={() => handleCall('911', 'Emergency Hotline', 'emergency', 'Emergency call from incident')}
            disabled={loading}
            variant="outline"
            className="w-full text-red-600 border-red-600 hover:bg-red-50"
            size="sm"
          >
            <Phone className="h-4 w-4 mr-2" />
            911 Emergency
          </Button>
          <Button
            onClick={() => handleCall('09998064555', 'RVOIS Hotline', 'emergency', 'RVOIS emergency call from incident')}
            disabled={loading}
            variant="outline"
            className="w-full text-red-600 border-red-600 hover:bg-red-50"
            size="sm"
          >
            <Phone className="h-4 w-4 mr-2" />
            RVOIS Hotline
          </Button>
        </div>
      </Card>

      {/* Call History for this Incident */}
      {callLogs.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Call History</h4>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {callLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{log.contact_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.call_type}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        log.status === 'completed' ? 'text-green-600' :
                        log.status === 'connected' ? 'text-blue-600' :
                        log.status === 'missed' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}
                    >
                      {log.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatTimeAgo(log.created_at)}
                    {log.notes && ` • ${log.notes}`}
                  </p>
                </div>
                <Button
                  onClick={() => handleCall(log.contact_number, log.contact_name, log.call_type)}
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Phone className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
          <span className="ml-2 text-sm text-gray-600">Initiating call...</span>
        </div>
      )}
    </div>
  )
}
