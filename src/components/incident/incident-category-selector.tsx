"use client"

import React from 'react'
import { cn } from '@/lib/utils'

export type IncidentCategory = 
  | 'MEDICAL_TRAUMA'
  | 'MEDICAL_NON_TRAUMA'
  | 'NON_MEDICAL_SAFETY'
  | 'NON_MEDICAL_SECURITY'
  | 'NON_MEDICAL_ENVIRONMENTAL'
  | 'NON_MEDICAL_BEHAVIORAL'
  | 'OTHER'

export interface IncidentCategoryOption {
  value: IncidentCategory
  label: string
  description: string
}

export const INCIDENT_CATEGORIES: IncidentCategoryOption[] = [
  {
    value: 'MEDICAL_TRAUMA',
    label: 'Medical - Trauma',
    description: 'Injuries requiring immediate medical attention'
  },
  {
    value: 'MEDICAL_NON_TRAUMA',
    label: 'Medical - Non-Trauma',
    description: 'Illness, allergic reaction, or other medical condition'
  },
  {
    value: 'NON_MEDICAL_SAFETY',
    label: 'Non-Medical - Safety',
    description: 'Slip/fall, equipment failure, or safety hazard'
  },
  {
    value: 'NON_MEDICAL_SECURITY',
    label: 'Non-Medical - Security',
    description: 'Theft, trespass, or security incident'
  },
  {
    value: 'NON_MEDICAL_ENVIRONMENTAL',
    label: 'Non-Medical - Environmental',
    description: 'Fire, flood, power outage, or environmental hazard'
  },
  {
    value: 'NON_MEDICAL_BEHAVIORAL',
    label: 'Non-Medical - Behavioral',
    description: 'Conflict, disturbance, or behavioral issue'
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Other type of incident not listed above'
  }
]

interface IncidentCategorySelectorProps {
  value: IncidentCategory | ''
  onChange: (value: IncidentCategory) => void
  required?: boolean
  disabled?: boolean
  className?: string
  error?: string
}

export const IncidentCategorySelector: React.FC<IncidentCategorySelectorProps> = ({
  value,
  onChange,
  required = true,
  disabled = false,
  className,
  error
}) => {
  return (
    <div className={cn('w-full', className)}>
      <label htmlFor="incident_category" className="block text-sm font-medium text-gray-700 mb-1">
        Incident Category {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id="incident_category"
        value={value}
        onChange={(e) => onChange(e.target.value as IncidentCategory)}
        required={required}
        disabled={disabled}
        className={cn(
          'mt-1 block w-full border rounded-md shadow-sm py-2 px-3',
          'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500',
          'sm:text-sm text-gray-900 bg-white',
          error ? 'border-red-500' : 'border-gray-300',
          disabled && 'bg-gray-100 cursor-not-allowed'
        )}
      >
        <option value="">Select Category</option>
        {INCIDENT_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
      {value && (
        <p className="mt-1 text-xs text-gray-500">
          {INCIDENT_CATEGORIES.find(c => c.value === value)?.description}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}

