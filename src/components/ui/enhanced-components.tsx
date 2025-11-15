"use client"

import React from 'react'
import { cn } from '@/lib/utils'

// Re-export all enhanced components from the new design system
export {
  DESIGN_TOKENS,
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  LoadingSpinner,
  Alert
} from './design-system'

export {
  StatusBadge,
  PriorityBadge,
  RoleBadge,
  Avatar,
  ProgressBar,
  Tooltip
} from './badges'

export {
  Container,
  Grid,
  Flex,
  Stack,
  Section,
  Header,
  Text,
  Divider,
  Spacer
} from './layout'

export {
  NavItem,
  Sidebar,
  Breadcrumb,
  Tabs,
  Pagination,
  MobileMenu
} from './navigation'

export {
  Modal,
  Drawer,
  Toast,
  ToastContainer,
  Popover
} from './overlays'

export {
  DataTable,
  StatCard,
  Timeline,
  EmptyState
} from './data-display'

// Additional UI components
export interface FormFieldProps {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required,
  children,
  className
}) => {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Error",
  message,
  onRetry,
  className
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 space-y-4', className)}>
      <div className="text-red-500">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

export interface SuccessStateProps {
  title?: string
  message: string
  onContinue?: () => void
  className?: string
}

export const SuccessState: React.FC<SuccessStateProps> = ({
  title = "Success",
  message,
  onContinue,
  className
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 space-y-4', className)}>
      <div className="text-green-500">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
      {onContinue && (
        <button
          onClick={onContinue}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Continue
        </button>
      )}
    </div>
  )
}

// Legacy exports for backward compatibility
export { Button as EnhancedButton } from './design-system'
export { Card as EnhancedCard } from './design-system'
export { Input as EnhancedInput } from './design-system'
export { LoadingSpinner as EnhancedLoadingSpinner } from './design-system'