"use client"

import React from 'react'
import { cn } from '@/lib/utils'

export type SeverityLevel = 
  | 'CRITICAL'
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'INFORMATIONAL'

export interface SeverityLevelOption {
  value: SeverityLevel
  label: string
  description: string
  icon: string
  color: string
}

export const SEVERITY_LEVELS: SeverityLevelOption[] = [
  {
    value: 'CRITICAL',
    label: 'Critical',
    description: 'Immediate life threat, requires emergency response',
    icon: '🔴',
    color: 'text-red-600'
  },
  {
    value: 'HIGH',
    label: 'High',
    description: 'Serious injury/incident, urgent medical attention needed',
    icon: '🟠',
    color: 'text-orange-600'
  },
  {
    value: 'MODERATE',
    label: 'Moderate',
    description: 'Non-life threatening, requires medical evaluation',
    icon: '🟡',
    color: 'text-yellow-600'
  },
  {
    value: 'LOW',
    label: 'Low',
    description: 'Minor injury/incident, basic first aid sufficient',
    icon: '🟢',
    color: 'text-green-600'
  },
  {
    value: 'INFORMATIONAL',
    label: 'Informational',
    description: 'No injury, documentation purposes only',
    icon: 'ℹ️',
    color: 'text-blue-600'
  }
]

interface SeverityLevelSelectorProps {
  value: SeverityLevel | ''
  onChange: (value: SeverityLevel) => void
  required?: boolean
  disabled?: boolean
  className?: string
  error?: string
  variant?: 'radio' | 'select'
}

export const SeverityLevelSelector: React.FC<SeverityLevelSelectorProps> = ({
  value,
  onChange,
  required = true,
  disabled = false,
  className,
  error,
  variant = 'radio'
}) => {
  if (variant === 'select') {
    return (
      <div className={cn('w-full', className)}>
        <label htmlFor="severity_level" className="block text-sm font-medium text-gray-700 mb-1">
          Severity Level {required && <span className="text-red-500">*</span>}
        </label>
        <select
          id="severity_level"
          value={value}
          onChange={(e) => onChange(e.target.value as SeverityLevel)}
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
          <option value="">Select Severity</option>
          {SEVERITY_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.icon} {level.label} - {level.description}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>
    )
  }

  // Radio button variant (default)
  return (
    <div className={cn('w-full', className)}>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Severity Level {required && <span className="text-red-500">*</span>}
      </label>
      <div className="space-y-2">
        {SEVERITY_LEVELS.map((level) => (
          <label
            key={level.value}
            className={cn(
              'flex items-start p-3 border rounded-md cursor-pointer transition-colors',
              'hover:bg-gray-50',
              value === level.value 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-300',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              name="severity_level"
              value={level.value}
              checked={value === level.value}
              onChange={(e) => onChange(e.target.value as SeverityLevel)}
              required={required}
              disabled={disabled}
              className="mt-1 mr-3 h-4 w-4 text-green-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{level.icon}</span>
                <span className={cn('font-medium', level.color)}>
                  {level.label}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {level.description}
              </p>
            </div>
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}

