"use client"

import React from 'react'
import { cn } from '@/lib/utils'

// Enhanced Status Badge Component with consistent styling
interface StatusBadgeProps {
  status: 'PENDING' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showIcon?: boolean
  variant?: 'default' | 'outlined' | 'filled'
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  variant = 'default'
}) => {
  const statusConfig = {
    PENDING: {
      label: 'Pending',
      icon: '⏳',
      colors: {
        default: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        outlined: 'border-yellow-300 text-yellow-700 bg-transparent',
        filled: 'bg-yellow-600 text-white border-yellow-600'
      }
    },
    ASSIGNED: {
      label: 'Assigned',
      icon: '👤',
      colors: {
        default: 'bg-blue-100 text-blue-800 border-blue-200',
        outlined: 'border-blue-300 text-blue-700 bg-transparent',
        filled: 'bg-blue-600 text-white border-blue-600'
      }
    },
    RESPONDING: {
      label: 'Responding',
      icon: '🚀',
      colors: {
        default: 'bg-purple-100 text-purple-800 border-purple-200',
        outlined: 'border-purple-300 text-purple-700 bg-transparent',
        filled: 'bg-purple-600 text-white border-purple-600'
      }
    },
    RESOLVED: {
      label: 'Resolved',
      icon: '✅',
      colors: {
        default: 'bg-green-100 text-green-800 border-green-200',
        outlined: 'border-green-300 text-green-700 bg-transparent',
        filled: 'bg-green-600 text-white border-green-600'
      }
    },
    CANCELLED: {
      label: 'Cancelled',
      icon: '❌',
      colors: {
        default: 'bg-gray-100 text-gray-800 border-gray-200',
        outlined: 'border-gray-300 text-gray-700 bg-transparent',
        filled: 'bg-gray-600 text-white border-gray-600'
      }
    },
    ACTIVE: {
      label: 'Active',
      icon: '🟢',
      colors: {
        default: 'bg-green-100 text-green-800 border-green-200',
        outlined: 'border-green-300 text-green-700 bg-transparent',
        filled: 'bg-green-600 text-white border-green-600'
      }
    },
    INACTIVE: {
      label: 'Inactive',
      icon: '⚪',
      colors: {
        default: 'bg-gray-100 text-gray-800 border-gray-200',
        outlined: 'border-gray-300 text-gray-700 bg-transparent',
        filled: 'bg-gray-600 text-white border-gray-600'
      }
    },
    SUSPENDED: {
      label: 'Suspended',
      icon: '🔴',
      colors: {
        default: 'bg-red-100 text-red-800 border-red-200',
        outlined: 'border-red-300 text-red-700 bg-transparent',
        filled: 'bg-red-600 text-white border-red-600'
      }
    }
  }

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  const config = statusConfig[status]

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full border transition-colors duration-200',
      config.colors[variant],
      sizeClasses[size]
    )}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </span>
  )
}

// Enhanced Priority Badge Component
interface PriorityBadgeProps {
  priority: 1 | 2 | 3 | 4 | 5
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showIcon?: boolean
  variant?: 'default' | 'outlined' | 'filled'
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  size = 'md',
  showIcon = true,
  variant = 'default'
}) => {
  const priorityConfig = {
    1: { 
      label: 'Critical', 
      icon: '🔴',
      colors: {
        default: 'bg-red-100 text-red-800 border-red-200',
        outlined: 'border-red-300 text-red-700 bg-transparent',
        filled: 'bg-red-600 text-white border-red-600'
      }
    },
    2: { 
      label: 'High', 
      icon: '🟠',
      colors: {
        default: 'bg-orange-100 text-orange-800 border-orange-200',
        outlined: 'border-orange-300 text-orange-700 bg-transparent',
        filled: 'bg-orange-600 text-white border-orange-600'
      }
    },
    3: { 
      label: 'Medium', 
      icon: '🟡',
      colors: {
        default: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        outlined: 'border-yellow-300 text-yellow-700 bg-transparent',
        filled: 'bg-yellow-600 text-white border-yellow-600'
      }
    },
    4: { 
      label: 'Low', 
      icon: '🔵',
      colors: {
        default: 'bg-blue-100 text-blue-800 border-blue-200',
        outlined: 'border-blue-300 text-blue-700 bg-transparent',
        filled: 'bg-blue-600 text-white border-blue-600'
      }
    },
    5: { 
      label: 'Very Low', 
      icon: '⚪',
      colors: {
        default: 'bg-gray-100 text-gray-800 border-gray-200',
        outlined: 'border-gray-300 text-gray-700 bg-transparent',
        filled: 'bg-gray-600 text-white border-gray-600'
      }
    }
  }

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  const config = priorityConfig[priority]

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full border transition-colors duration-200',
      config.colors[variant],
      sizeClasses[size]
    )}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </span>
  )
}

// Enhanced Role Badge Component
interface RoleBadgeProps {
  role: 'admin' | 'volunteer' | 'resident' | 'barangay'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showIcon?: boolean
  variant?: 'default' | 'outlined' | 'filled'
}

const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'md',
  showIcon = true,
  variant = 'default'
}) => {
  const roleConfig = {
    admin: {
      label: 'Admin',
      icon: '👨‍💼',
      colors: {
        default: 'bg-purple-100 text-purple-800 border-purple-200',
        outlined: 'border-purple-300 text-purple-700 bg-transparent',
        filled: 'bg-purple-600 text-white border-purple-600'
      }
    },
    volunteer: {
      label: 'Volunteer',
      icon: '🧑‍🚒',
      colors: {
        default: 'bg-blue-100 text-blue-800 border-blue-200',
        outlined: 'border-blue-300 text-blue-700 bg-transparent',
        filled: 'bg-blue-600 text-white border-blue-600'
      }
    },
    resident: {
      label: 'Resident',
      icon: '👤',
      colors: {
        default: 'bg-green-100 text-green-800 border-green-200',
        outlined: 'border-green-300 text-green-700 bg-transparent',
        filled: 'bg-green-600 text-white border-green-600'
      }
    },
    barangay: {
      label: 'Barangay',
      icon: '🏘️',
      colors: {
        default: 'bg-orange-100 text-orange-800 border-orange-200',
        outlined: 'border-orange-300 text-orange-700 bg-transparent',
        filled: 'bg-orange-600 text-white border-orange-600'
      }
    }
  }

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  const config = roleConfig[role]

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full border transition-colors duration-200',
      config.colors[variant],
      sizeClasses[size]
    )}>
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </span>
  )
}

// Enhanced Avatar Component
interface AvatarProps {
  src?: string
  alt?: string
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'busy' | 'away'
  showStatus?: boolean
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = 'md',
  status,
  showStatus = false
}) => {
  const sizeClasses = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl'
  }

  const statusClasses = {
    online: 'bg-green-400',
    offline: 'bg-gray-400',
    busy: 'bg-red-400',
    away: 'bg-yellow-400'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="relative inline-block">
      <div className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-gray-500 text-white font-medium',
        sizeClasses[size]
      )}>
        {src ? (
          <img
            src={src}
            alt={alt || name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="text-current">
            {name ? getInitials(name) : '?'}
          </span>
        )}
      </div>
      
      {showStatus && status && (
        <span className={cn(
          'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white',
          statusClasses[status]
        )} />
      )}
    </div>
  )
}

// Enhanced Progress Bar Component
interface ProgressBarProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  label?: string
  animated?: boolean
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showLabel = false,
  label,
  animated = false
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const colorClasses = {
    primary: 'bg-red-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600'
  }

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
          <span>{label || `${value}/${max}`}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      
      <div className={cn(
        'w-full bg-gray-200 rounded-full overflow-hidden',
        sizeClasses[size]
      )}>
        <div
          className={cn(
            'h-full transition-all duration-300 ease-in-out',
            colorClasses[color],
            animated ? 'animate-pulse' : ''
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Enhanced Tooltip Component
interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200
}) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-900',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-900',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-gray-900',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-gray-900'
  }

  return (
    <div className="relative group">
      {children}
      <div className={cn(
        'absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 invisible transition-all duration-200',
        'group-hover:opacity-100 group-hover:visible',
        positionClasses[position]
      )}>
        {content}
        <div className={cn(
          'absolute w-0 h-0 border-4 border-transparent',
          arrowClasses[position]
        )} />
      </div>
    </div>
  )
}

// Export all badge components
export {
  StatusBadge,
  PriorityBadge,
  RoleBadge,
  Avatar,
  ProgressBar,
  Tooltip
}
