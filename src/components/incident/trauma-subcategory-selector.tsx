"use client"

import React from 'react'
import { cn } from '@/lib/utils'

export type TraumaSubcategory = 
  | 'FALL_RELATED'
  | 'BLUNT_FORCE'
  | 'PENETRATING'
  | 'BURN'
  | 'FRACTURE_DISLOCATION'
  | 'HEAD_INJURY'
  | 'SPINAL_INJURY'
  | 'MULTI_SYSTEM'
  | 'OTHER_TRAUMA'

export interface TraumaSubcategoryOption {
  value: TraumaSubcategory
  label: string
  description: string
}

export const TRAUMA_SUBCATEGORIES: TraumaSubcategoryOption[] = [
  {
    value: 'FALL_RELATED',
    label: 'Fall-related Injury',
    description: 'Injury from falling or being dropped'
  },
  {
    value: 'BLUNT_FORCE',
    label: 'Blunt Force Trauma',
    description: 'Injury from impact with blunt object'
  },
  {
    value: 'PENETRATING',
    label: 'Penetrating Trauma',
    description: 'Injury from sharp object or projectile'
  },
  {
    value: 'BURN',
    label: 'Burn Injury',
    description: 'Thermal, chemical, or electrical burn'
  },
  {
    value: 'FRACTURE_DISLOCATION',
    label: 'Fracture/Dislocation',
    description: 'Broken bone or joint dislocation'
  },
  {
    value: 'HEAD_INJURY',
    label: 'Head Injury/Concussion',
    description: 'Trauma to head, face, or brain'
  },
  {
    value: 'SPINAL_INJURY',
    label: 'Spinal Injury',
    description: 'Injury to spine or spinal cord'
  },
  {
    value: 'MULTI_SYSTEM',
    label: 'Multi-system Trauma',
    description: 'Multiple body systems affected'
  },
  {
    value: 'OTHER_TRAUMA',
    label: 'Other Trauma',
    description: 'Other trauma type not listed above'
  }
]

interface TraumaSubcategorySelectorProps {
  value: TraumaSubcategory | ''
  onChange: (value: TraumaSubcategory) => void
  required?: boolean
  disabled?: boolean
  className?: string
  error?: string
}

export const TraumaSubcategorySelector: React.FC<TraumaSubcategorySelectorProps> = ({
  value,
  onChange,
  required = true,
  disabled = false,
  className,
  error
}) => {
  return (
    <div className={cn('w-full', className)}>
      <label htmlFor="trauma_subcategory" className="block text-sm font-medium text-gray-700 mb-1">
        Trauma Sub-Category {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id="trauma_subcategory"
        value={value}
        onChange={(e) => onChange(e.target.value as TraumaSubcategory)}
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
        <option value="">Select Trauma Type</option>
        {TRAUMA_SUBCATEGORIES.map((subcategory) => (
          <option key={subcategory.value} value={subcategory.value}>
            {subcategory.label}
          </option>
        ))}
      </select>
      {value && (
        <p className="mt-1 text-xs text-gray-500">
          {TRAUMA_SUBCATEGORIES.find(s => s.value === value)?.description}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}

