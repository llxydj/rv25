"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { 
  IncidentCategorySelector, 
  TraumaSubcategorySelector, 
  SeverityLevelSelector,
  type IncidentCategory,
  type TraumaSubcategory,
  type SeverityLevel
} from "@/components/incident"

interface IncidentTraumaClassificationUpdaterProps {
  incidentId: string
  incidentStatus: string
  currentCategory?: IncidentCategory | null
  currentTraumaSubcategory?: TraumaSubcategory | null
  currentSeverityLevel?: SeverityLevel | null
  onClassificationUpdate?: (data: {
    incident_category: IncidentCategory | null
    trauma_subcategory: TraumaSubcategory | null
    severity_level: SeverityLevel | null
  }) => void
}

export default function IncidentTraumaClassificationUpdater({
  incidentId,
  incidentStatus,
  currentCategory,
  currentTraumaSubcategory,
  currentSeverityLevel,
  onClassificationUpdate
}: IncidentTraumaClassificationUpdaterProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    incident_category: (currentCategory || '') as IncidentCategory | '',
    trauma_subcategory: (currentTraumaSubcategory || '') as TraumaSubcategory | '',
    severity_level: (currentSeverityLevel || '') as SeverityLevel | '',
  })
  const [errors, setErrors] = useState<{
    incident_category?: string
    trauma_subcategory?: string
    severity_level?: string
  }>({})
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Check if classification can be updated
  const canUpdateClassification = () => {
    if (user?.role === 'admin') return true
    if (user?.role === 'volunteer' && incidentStatus === 'ARRIVED') return true
    return false
  }

  const validateForm = () => {
    const newErrors: typeof errors = {}
    
    if (!formData.incident_category) {
      newErrors.incident_category = 'Incident category is required'
    }
    
    if (formData.incident_category === 'MEDICAL_TRAUMA' && !formData.trauma_subcategory) {
      newErrors.trauma_subcategory = 'Trauma subcategory is required for medical trauma incidents'
    }
    
    if (!formData.severity_level) {
      newErrors.severity_level = 'Severity level is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleClassificationUpdate = async () => {
    if (!validateForm()) {
      setError('Please fix the errors above')
      return
    }

    if (!canUpdateClassification()) {
      setError('Classification can only be updated when you have arrived at the scene (status must be ARRIVED)')
      return
    }

    setIsUpdating(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident_category: formData.incident_category || null,
          trauma_subcategory: formData.trauma_subcategory || null,
          severity_level: formData.severity_level || null,
          updated_by: user?.id,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update classification')
      }

      onClassificationUpdate?.({
        incident_category: formData.incident_category || null,
        trauma_subcategory: formData.trauma_subcategory || null,
        severity_level: formData.severity_level || null,
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error updating classification:', err)
      setError(err.message || 'Failed to update classification')
    } finally {
      setIsUpdating(false)
    }
  }

  if (!canUpdateClassification()) {
    return (
      <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <AlertCircle className="h-4 w-4" />
          <span>
            {currentCategory || currentSeverityLevel 
              ? 'Trauma classification can be updated after arriving at the scene (status: ARRIVED)'
              : 'Trauma classification will be available after arriving at the scene (status: ARRIVED)'}
          </span>
        </div>
        {(currentCategory || currentTraumaSubcategory || currentSeverityLevel) && (
          <div className="mt-2 space-y-1 text-sm">
            {currentCategory && (
              <div>
                <span className="font-medium">Category:</span> {currentCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
            )}
            {currentTraumaSubcategory && (
              <div>
                <span className="font-medium">Trauma Type:</span> {currentTraumaSubcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
            )}
            {currentSeverityLevel && (
              <div>
                <span className="font-medium">Severity Level:</span> {currentSeverityLevel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Assess Incident Classification
        </h4>
        {success && (
          <CheckCircle className="h-4 w-4 text-green-600" />
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded">
          Classification updated successfully!
        </div>
      )}

      <div className="space-y-3">
        <div>
          <IncidentCategorySelector
            value={formData.incident_category}
            onChange={(value) => {
              setFormData(prev => ({
                ...prev,
                incident_category: value,
                trauma_subcategory: value === 'MEDICAL_TRAUMA' ? prev.trauma_subcategory : '' as TraumaSubcategory | ''
              }))
              setErrors(prev => ({ ...prev, incident_category: undefined }))
            }}
            required
            disabled={isUpdating}
            error={errors.incident_category}
          />
        </div>

        {formData.incident_category === 'MEDICAL_TRAUMA' && (
          <div>
            <TraumaSubcategorySelector
              value={formData.trauma_subcategory}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, trauma_subcategory: value }))
                setErrors(prev => ({ ...prev, trauma_subcategory: undefined }))
              }}
              required
              disabled={isUpdating}
              error={errors.trauma_subcategory}
            />
          </div>
        )}

        <div>
          <SeverityLevelSelector
            value={formData.severity_level}
            onChange={(value) => {
              setFormData(prev => ({ ...prev, severity_level: value }))
              setErrors(prev => ({ ...prev, severity_level: undefined }))
            }}
            required
            disabled={isUpdating}
            error={errors.severity_level}
            variant="radio"
          />
        </div>

        <Button
          onClick={handleClassificationUpdate}
          disabled={isUpdating}
          size="sm"
          className="w-full"
        >
          {isUpdating ? 'Updating...' : 'Update Classification'}
        </Button>
      </div>

      {user?.role === 'volunteer' && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Classify the incident based on what you observe at the scene. This helps with proper categorization and analytics.
        </p>
      )}
    </div>
  )
}

