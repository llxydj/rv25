"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import { updateIncidentStatus } from "@/lib/incidents"
import { useToast } from "@/hooks/use-toast"

interface IncidentOTWButtonProps {
  incidentId: string
  currentStatus: string
  volunteerId: string
  onStatusUpdate?: (newStatus: string) => void
}

export default function IncidentOTWButton({ 
  incidentId, 
  currentStatus, 
  volunteerId,
  onStatusUpdate 
}: IncidentOTWButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  const handleMarkOTW = async () => {
    if (currentStatus !== "ASSIGNED" && currentStatus !== "RESPONDING") return

    try {
      setIsUpdating(true)
      
      const result = await updateIncidentStatus(
        volunteerId,
        incidentId,
        "RESPONDING"
      )
      
      if (result.success) {
        onStatusUpdate?.("RESPONDING")
        toast({
          title: "Success",
          description: "Incident status updated to Responding. Resident and admins have been notified.",
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

  // Show the button for both ASSIGNED and RESPONDING statuses to allow re-notifications
  if (currentStatus !== "ASSIGNED" && currentStatus !== "RESPONDING") {
    return null
  }

  return (
    <Button
      onClick={handleMarkOTW}
      disabled={isUpdating}
      className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-gray-900 bg-white rounded-md shadow-sm hover:bg-gray-50"
    >
      {isUpdating ? (
        <div className="h-4 w-4 mr-2 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
      ) : (
        <Clock className="h-4 w-4 mr-2" />
      )}
      {currentStatus === "RESPONDING" ? "Re-send OTW Notification" : "Mark as On The Way (OTW)"}
    </Button>
  )
}