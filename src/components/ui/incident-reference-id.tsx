"use client"

import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IncidentReferenceIdProps {
  incidentId: string
  className?: string
  showCopyButton?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'badge' | 'inline'
}

export const IncidentReferenceId: React.FC<IncidentReferenceIdProps> = ({
  incidentId,
  className,
  showCopyButton = true,
  showLabel = true,
  size = 'md',
  variant = 'default'
}) => {
  const [referenceId, setReferenceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchReferenceId = async () => {
      if (!incidentId) {
        setError('No incident ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        // Use API route instead of direct service call (server-side with service role key)
        const response = await fetch(`/api/reference-ids?incident_id=${encodeURIComponent(incidentId)}`)
        const result = await response.json()
        
        if (result.success && result.referenceId) {
          setReferenceId(result.referenceId)
        } else {
          setError(result.error || 'Failed to get reference ID')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load reference ID')
      } finally {
        setLoading(false)
      }
    }

    fetchReferenceId()
  }, [incidentId])

  const handleCopy = async () => {
    if (!referenceId) return

    try {
      await navigator.clipboard.writeText(referenceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy reference ID:', err)
    }
  }

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const variantClasses = {
    default: 'bg-gray-100 text-gray-800 px-2 py-1 rounded',
    badge: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold',
    inline: 'text-gray-600'
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showLabel && <span className="text-gray-500">ID:</span>}
        <div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div>
      </div>
    )
  }

  if (error) {
    // Fallback: Show the incident ID directly if reference ID fails to load
    const shortId = incidentId ? incidentId.slice(0, 8).toUpperCase() : 'N/A'
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showLabel && (
          <span className="text-gray-500 text-sm">ID:</span>
        )}
        <div className={cn(
          'flex items-center gap-2',
          variantClasses[variant],
          sizeClasses[size]
        )}>
          <span className="font-mono font-semibold">
            {shortId}
          </span>
        </div>
      </div>
    )
  }

  if (!referenceId) {
    return (
      <div className={cn('flex items-center gap-2 text-gray-500', className)}>
        <span className="text-sm">No ID available</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="text-gray-500 text-sm">ID:</span>
      )}
      
      <div className={cn(
        'flex items-center gap-2',
        variantClasses[variant],
        sizeClasses[size]
      )}>
        <span className="font-mono font-semibold">
          {referenceId}
        </span>
        
        {showCopyButton && (
          <button
            onClick={handleCopy}
            className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors text-xs"
            title="Copy reference ID"
            aria-label="Copy reference ID to clipboard"
          >
            {copied ? '✓' : '📋'}
          </button>
        )}
      </div>
    </div>
  )
}

// Hook for getting reference ID
export const useReferenceId = (incidentId: string) => {
  const [referenceId, setReferenceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReferenceId = async () => {
      if (!incidentId) {
        setError('No incident ID provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        // Use API route instead of direct service call (server-side with service role key)
        const response = await fetch(`/api/reference-ids?incident_id=${encodeURIComponent(incidentId)}`)
        const result = await response.json()
        
        if (result.success && result.referenceId) {
          setReferenceId(result.referenceId)
        } else {
          setError(result.error || 'Failed to get reference ID')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load reference ID')
      } finally {
        setLoading(false)
      }
    }

    fetchReferenceId()
  }, [incidentId])

  return { referenceId, loading, error }
}
