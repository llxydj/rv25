"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle } from "lucide-react"
import { useAuth } from "@/lib/auth"

type IncidentSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL'

interface IncidentSeverityUpdaterProps {
  currentSeverity: IncidentSeverity | null
  incidentId: string
  incidentStatus: string
  onSeverityUpdate?: (newSeverity: IncidentSeverity) => void
}

const SEVERITY_CONFIG = {
  MINOR: { 
    label: "Minor", 
    color: "bg-green-100 text-green-800",
    description: "Low priority, minimal impact"
  },
  MODERATE: { 
    label: "Moderate", 
    color: "bg-yellow-100 text-yellow-800",
    description: "Medium priority, moderate impact"
  },
  SEVERE: { 
    label: "Severe", 
    color: "bg-orange-100 text-orange-800",
    description: "High priority, significant impact"
  },
  CRITICAL: { 
    label: "Critical", 
    color: "bg-red-100 text-red-800",
    description: "Emergency, immediate response required"
  }
}

export default function IncidentSeverityUpdater({ 
  currentSeverity, 
  incidentId,
  incidentStatus,
  onSeverityUpdate
}: IncidentSeverityUpdaterProps) {
  const { user } = useAuth()
  const [selectedSeverity, setSelectedSeverity] = useState<IncidentSeverity | ''>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if severity can be updated
  const canUpdateSeverity = () => {
    if (user?.role === 'admin') return true
    if (user?.role === 'volunteer' && incidentStatus === 'ARRIVED') return true
    return false
  }

  const handleSeverityUpdate = async () => {
    if (!selectedSeverity) {
      setError('Please select a severity level')
      return
    }

    if (!canUpdateSeverity()) {
      setError('Severity can only be updated when you have arrived at the scene (status must be ARRIVED)')
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/incidents/${incidentId}/severity`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          severity: selectedSeverity,
          updated_by: user?.id,
          notes: `Severity updated to ${selectedSeverity}${currentSeverity ? ` (was ${currentSeverity})` : ''}`
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update severity')
      }

      onSeverityUpdate?.(selectedSeverity)
      setSelectedSeverity('')
      alert(`Severity updated to ${selectedSeverity}`)
    } catch (err: any) {
      console.error('Error updating severity:', err)
      setError(err.message || 'Failed to update severity')
    } finally {
      setIsUpdating(false)
    }
  }

  const currentConfig = currentSeverity ? SEVERITY_CONFIG[currentSeverity] : null

  if (!canUpdateSeverity()) {
    return (
      <div className="flex items-center gap-2">
        {currentSeverity ? (
          <Badge className={currentConfig?.color || 'bg-gray-100 text-gray-800'}>
            {currentConfig?.label || currentSeverity}
          </Badge>
        ) : (
          <span className="text-sm text-gray-500">No severity set</span>
        )}
        {user?.role === 'volunteer' && incidentStatus !== 'ARRIVED' && (
          <span className="text-xs text-gray-500 italic">
            (Update severity after arriving at scene)
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {currentSeverity ? (
          <Badge className={currentConfig?.color || 'bg-gray-100 text-gray-800'}>
            {currentConfig?.label || currentSeverity}
          </Badge>
        ) : (
          <span className="text-sm text-gray-500">No severity set</span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select
          value={selectedSeverity}
          onValueChange={(value) => setSelectedSeverity(value as IncidentSeverity)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select severity" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span className={config.color}>{config.label}</span>
                  <span className="text-xs text-gray-500">- {config.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleSeverityUpdate}
          disabled={!selectedSeverity || isUpdating || selectedSeverity === currentSeverity}
          size="sm"
        >
          {isUpdating ? 'Updating...' : 'Update Severity'}
        </Button>
      </div>

      {user?.role === 'volunteer' && (
        <p className="text-xs text-gray-500">
          You can update severity after arriving at the scene (status: ARRIVED)
        </p>
      )}
    </div>
  )
}

