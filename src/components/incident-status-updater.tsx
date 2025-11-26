"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, AlertCircle, XCircle, User } from "lucide-react"

const STATUS_CONFIG = {
  PENDING: { 
    label: "Pending", 
    color: "bg-yellow-100 text-yellow-800", 
    icon: Clock 
  },
  ASSIGNED: { 
    label: "Assigned", 
    color: "bg-blue-100 text-blue-800", 
    icon: User 
  },
  RESPONDING: { 
    label: "On The Way (OTW)", 
    color: "bg-orange-100 text-orange-800", 
    icon: AlertCircle 
  },
  ARRIVED: { 
    label: "Arrived", 
    color: "bg-purple-100 text-purple-800", 
    icon: AlertCircle 
  },
  RESOLVED: { 
    label: "Resolved", 
    color: "bg-green-100 text-green-800", 
    icon: CheckCircle 
  },
  CANCELLED: { 
    label: "Cancelled", 
    color: "bg-red-100 text-red-800", 
    icon: XCircle 
  }
}

type IncidentStatus = 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED'

interface IncidentStatusUpdaterProps {
  currentStatus: IncidentStatus
  incidentId: string
  onStatusUpdate?: (newStatus: IncidentStatus) => void
  userRole: 'admin' | 'volunteer' | 'resident'
}

export default function IncidentStatusUpdater({ 
  currentStatus, 
  incidentId, 
  onStatusUpdate,
  userRole 
}: IncidentStatusUpdaterProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const getAvailableStatuses = (currentStatus: IncidentStatus, userRole: string): IncidentStatus[] => {
    if (userRole === 'admin') {
      return ['PENDING', 'ASSIGNED', 'RESPONDING', 'RESOLVED', 'CANCELLED']
    }
    
    if (userRole === 'volunteer') {
      switch (currentStatus) {
        case 'ASSIGNED':
          return ['RESPONDING', 'CANCELLED']
        case 'RESPONDING':
          return ['ARRIVED', 'RESOLVED', 'CANCELLED']
        case 'ARRIVED':
          return ['RESOLVED', 'CANCELLED']
        default:
          return []
      }
    }
    
    return [] // Residents can't update status
  }

  const handleStatusUpdate = async (newStatus: IncidentStatus) => {
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: newStatus,
          updated_by: typeof window !== 'undefined' ? localStorage.getItem('user_id') : null,
          notes: `Status updated to ${newStatus} by ${userRole}`
        }),
      })

      if (response.ok) {
        onStatusUpdate?.(newStatus)
      } else {
        const errorData = await response.json()
        console.error('Failed to update status:', errorData.message)
        alert(`Failed to update status: ${errorData.message}`)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const currentConfig = STATUS_CONFIG[currentStatus]
  const CurrentIcon = currentConfig.icon
  const availableStatuses = getAvailableStatuses(currentStatus, userRole)

  return (
    <div className="flex items-center gap-3">
      <Badge className={`${currentConfig.color} flex items-center gap-1`}>
        <CurrentIcon className="h-3 w-3" />
        {currentConfig.label}
      </Badge>
      
      {availableStatuses.length > 0 && (
        <div className="flex gap-2">
          {availableStatuses.map((status) => {
            const config = STATUS_CONFIG[status]
            const Icon = config.icon
            return (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => handleStatusUpdate(status)}
                disabled={isUpdating}
                className="flex items-center gap-1"
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
