"use client"

import React from 'react'
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react'

interface RealtimeStatusIndicatorProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function RealtimeStatusIndicator({ 
  status, 
  className = '', 
  showText = true,
  size = 'md'
}: RealtimeStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          pulseColor: 'bg-green-500',
          text: 'Live',
          textColor: 'text-green-700'
        }
      case 'connecting':
      case 'reconnecting':
        return {
          icon: Loader2,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          pulseColor: 'bg-yellow-500',
          text: status === 'connecting' ? 'Connecting...' : 'Reconnecting...',
          textColor: 'text-yellow-700'
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          pulseColor: 'bg-red-500',
          text: 'Offline',
          textColor: 'text-red-700'
        }
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          pulseColor: 'bg-gray-500',
          text: 'Unknown',
          textColor: 'text-gray-700'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  const sizeClasses = {
    sm: {
      container: 'px-2 py-1',
      icon: 'h-3 w-3',
      text: 'text-xs',
      pulse: 'h-2 w-2'
    },
    md: {
      container: 'px-3 py-1.5',
      icon: 'h-4 w-4',
      text: 'text-sm',
      pulse: 'h-2.5 w-2.5'
    },
    lg: {
      container: 'px-4 py-2',
      icon: 'h-5 w-5',
      text: 'text-base',
      pulse: 'h-3 w-3'
    }
  }

  const sizeConfig = sizeClasses[size]

  return (
    <div className={`inline-flex items-center gap-2 rounded-full ${config.bgColor} ${sizeConfig.container} ${className}`}>
      {/* Status Icon */}
      <div className="relative">
        <Icon 
          className={`${config.color} ${sizeConfig.icon} ${
            status === 'connecting' || status === 'reconnecting' ? 'animate-spin' : ''
          }`} 
        />
        
        {/* Pulse animation for connected status */}
        {status === 'connected' && (
          <div 
            className={`absolute -top-1 -right-1 ${config.pulseColor} ${sizeConfig.pulse} rounded-full animate-pulse`}
            style={{
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          />
        )}
      </div>

      {/* Status Text */}
      {showText && (
        <span className={`font-medium ${config.textColor} ${sizeConfig.text}`}>
          {config.text}
        </span>
      )}
    </div>
  )
}

// Compact version for toolbars/headers
export function RealtimeStatusDot({ 
  status, 
  className = '' 
}: { 
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  className?: string 
}) {
  const getDotColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500'
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div 
        className={`h-3 w-3 rounded-full ${getDotColor()} ${
          status === 'connected' ? 'animate-pulse' : ''
        }`}
      />
      {status === 'connecting' || status === 'reconnecting' ? (
        <div className="absolute inset-0 h-3 w-3 rounded-full bg-yellow-500 animate-ping" />
      ) : null}
    </div>
  )
}

// Connection quality indicator
export function ConnectionQualityIndicator({ 
  latency, 
  className = '' 
}: { 
  latency?: number
  className?: string 
}) {
  if (!latency) return null

  const getQuality = () => {
    if (latency < 100) return { color: 'text-green-500', text: 'Excellent' }
    if (latency < 300) return { color: 'text-yellow-500', text: 'Good' }
    if (latency < 1000) return { color: 'text-orange-500', text: 'Fair' }
    return { color: 'text-red-500', text: 'Poor' }
  }

  const quality = getQuality()

  return (
    <div className={`text-xs ${quality.color} ${className}`}>
      {latency}ms - {quality.text}
    </div>
  )
}