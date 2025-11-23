"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { CheckCircle, Clock, AlertCircle, XCircle, ChevronDown } from "lucide-react"
import { updateIncidentStatus } from "@/lib/incidents"
import { useToast } from "@/hooks/use-toast"

const STATUS_CONFIG = {
  PENDING: { 
    label: "Pending", 
    color: "bg-yellow-100 text-yellow-800", 
    icon: Clock 
  },
  ASSIGNED: { 
    label: "Assigned", 
    color: "bg-blue-100 text-blue-800", 
    icon: AlertCircle 
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

interface IncidentStatusDropdownProps {
  currentStatus: IncidentStatus
  incidentId: string
  volunteerId: string
  onStatusUpdate?: (newStatus: IncidentStatus) => void
}

export default function IncidentStatusDropdown({ 
  currentStatus, 
  incidentId, 
  volunteerId,
  onStatusUpdate 
}: IncidentStatusDropdownProps) {
  const [localStatus, setLocalStatus] = useState<IncidentStatus>(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()
  
  // Use local status for display to ensure immediate UI feedback
  const displayStatus = localStatus
  const currentConfig = STATUS_CONFIG[displayStatus]

  const getAvailableStatuses = (status: IncidentStatus): IncidentStatus[] => {
    switch (status) {
      case 'ASSIGNED':
        return ['RESPONDING']
      case 'RESPONDING':
        return ['ARRIVED', 'RESOLVED']
      case 'ARRIVED':
        return ['RESOLVED']
      default:
        return []
    }
  }

  const handleStatusUpdate = async (newStatus: IncidentStatus) => {
    // Only allow specific transitions
    const availableStatuses = getAvailableStatuses(localStatus)
    if (!availableStatuses.includes(newStatus)) {
      toast({
        title: "Invalid Status Transition",
        description: `Cannot transition from ${displayStatus} to ${newStatus}`,
        variant: "destructive",
      })
      return
    }

    // Validate status type
    if (newStatus !== 'RESPONDING' && newStatus !== 'RESOLVED' && newStatus !== 'ARRIVED') {
      toast({
        title: "Invalid Status",
        description: `Status ${newStatus} cannot be updated directly`,
        variant: "destructive",
      })
      return
    }

    try {
      setIsUpdating(true)
      
      console.log(`Updating incident ${incidentId} from ${displayStatus} to ${newStatus}`)
      
      const result = await updateIncidentStatus(
        volunteerId,
        incidentId,
        newStatus as 'RESPONDING' | 'ARRIVED' | 'RESOLVED'
      )
      
      console.log('Update result:', result)
      
      if (result.success) {
        // Update local state immediately for instant UI feedback
        setLocalStatus(newStatus)
        
        // Call parent callback to sync state
        if (onStatusUpdate) {
          console.log('Calling onStatusUpdate with:', newStatus)
          onStatusUpdate(newStatus)
        }
        
        toast({
          title: "Success",
          description: `Incident status updated to ${STATUS_CONFIG[newStatus].label}. Resident and admins have been notified.`,
        })
      } else {
        console.error('Update failed:', result)
        toast({
          title: "Error",
          description: result.message || "Failed to update incident status",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('Exception during update:', error)
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const availableStatuses = getAvailableStatuses(displayStatus)
  const CurrentIcon = currentConfig.icon

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${currentConfig.color}`}>
        <CurrentIcon className="h-4 w-4 mr-1" />
        {currentConfig.label}
      </span>
      
      {availableStatuses.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={isUpdating}
              className="flex items-center gap-1"
            >
              {isUpdating ? 'Updating...' : 'Update Status'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableStatuses
              .filter(status => status === 'RESPONDING' || status === 'ARRIVED' || status === 'RESOLVED')
              .map((status) => {
                const config = STATUS_CONFIG[status]
                const Icon = config.icon
                return (
                  <DropdownMenuItem 
                    key={status} 
                    onClick={() => handleStatusUpdate(status)}
                    disabled={isUpdating}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {config.label}
                  </DropdownMenuItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}