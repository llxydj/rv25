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
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()
  const currentConfig = STATUS_CONFIG[currentStatus]

  const getAvailableStatuses = (currentStatus: IncidentStatus): IncidentStatus[] => {
    switch (currentStatus) {
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

  const handleStatusUpdate = async (newStatus: 'RESPONDING' | 'ARRIVED' | 'RESOLVED') => {
    // Only allow specific transitions
    const availableStatuses = getAvailableStatuses(currentStatus)
    if (!availableStatuses.includes(newStatus)) {
      toast({
        title: "Invalid Status Transition",
        description: `Cannot transition from ${currentStatus} to ${newStatus}`,
        variant: "destructive",
      })
      return
    }

    // Only pass valid statuses to updateIncidentStatus
    if (newStatus !== 'RESPONDING' && newStatus !== 'RESOLVED') {
      toast({
        title: "Invalid Status",
        description: `Status ${newStatus} cannot be updated directly`,
        variant: "destructive",
      })
      return
    }

    try {
      setIsUpdating(true)
      
      const result = await updateIncidentStatus(
        volunteerId,
        incidentId,
        newStatus
      )
      
      if (result.success) {
        onStatusUpdate?.(newStatus)
        toast({
          title: "Success",
          description: `Incident status updated to ${STATUS_CONFIG[newStatus].label}. Resident and admins have been notified.`,
        })
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update incident status",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const availableStatuses = getAvailableStatuses(currentStatus)
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
              Update Status
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableStatuses.filter(status => status === 'RESPONDING' || status === 'ARRIVED' || status === 'RESOLVED').map((status) => {
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