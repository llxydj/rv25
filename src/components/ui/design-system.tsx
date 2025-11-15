"use client"

import React from 'react'
import { cn } from '@/lib/utils'

// Design System Constants
const DESIGN_TOKENS = {
  colors: {
    primary: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626', // Main primary
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    }
  },
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },
  typography: {
    fontSizes: {
      xs: '0.75rem',   // 12px
      sm: '0.875rem',  // 14px
      base: '1rem',    // 16px
      lg: '1.125rem',  // 18px
      xl: '1.25rem',   // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    }
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  }
}

// Enhanced Button Component with Design System
interface EnhancedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const EnhancedButton: React.FC<EnhancedButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center font-medium transition-all duration-200 
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    active:scale-95 transform
    ${fullWidth ? 'w-full' : ''}
    min-h-[44px] min-w-[44px] /* Better touch targets */
  `
  
  const variantClasses = {
    primary: `
      bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 
      shadow-sm hover:shadow-md active:shadow-sm
    `,
    secondary: `
      bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 
      shadow-sm hover:shadow-md active:shadow-sm
    `,
    danger: `
      bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 
      shadow-sm hover:shadow-md active:shadow-sm
    `,
    success: `
      bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 
      shadow-sm hover:shadow-md active:shadow-sm
    `,
    warning: `
      bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500 
      shadow-sm hover:shadow-md active:shadow-sm
    `,
    ghost: `
      text-gray-700 hover:bg-gray-100 focus:ring-gray-500 
      hover:text-gray-900
    `,
    outline: `
      border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 
      hover:border-gray-400 shadow-sm hover:shadow-md active:shadow-sm
    `
  }
  
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs rounded-sm',
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-md',
    lg: 'px-6 py-3 text-base rounded-lg',
    xl: 'px-8 py-4 text-lg rounded-lg'
  }

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      
      {!loading && icon && iconPosition === 'left' && (
        <span className="mr-2">{icon}</span>
      )}
      
      {children}
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="ml-2">{icon}</span>
      )}
    </button>
  )
}

// Enhanced Card Component with Design System
interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'filled'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  hover?: boolean
  interactive?: boolean
}

const EnhancedCard: React.FC<EnhancedCardProps> = ({
  variant = 'default',
  padding = 'md',
  hover = false,
  interactive = false,
  className,
  children,
  ...props
}) => {
  const baseClasses = `
    rounded-lg transition-all duration-200
    ${interactive ? 'cursor-pointer' : ''}
  `
  
  const variantClasses = {
    default: 'bg-white border border-gray-200 shadow-sm',
    elevated: 'bg-white shadow-lg border border-gray-100',
    outlined: 'bg-white border-2 border-gray-200',
    filled: 'bg-gray-50 border border-gray-200'
  }
  
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  }
  
  const hoverClasses = hover || interactive ? 
    'hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5' : ''

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        paddingClasses[padding],
        hoverClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Enhanced Input Component with Design System
interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const EnhancedInput: React.FC<EnhancedInputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  ...props
}) => {
  const inputClasses = `
    block w-full px-3 py-2 text-sm border rounded-md transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}
    ${leftIcon ? 'pl-10' : ''}
    ${rightIcon ? 'pr-10' : ''}
    ${fullWidth ? 'w-full' : ''}
  `

  return (
    <div className={cn('space-y-1', fullWidth ? 'w-full' : '')}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400 text-sm">{leftIcon}</span>
          </div>
        )}
        
        <input
          className={cn(inputClasses, className)}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-400 text-sm">{rightIcon}</span>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

// Enhanced Textarea Component
interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
}

const EnhancedTextarea: React.FC<EnhancedTextareaProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  ...props
}) => {
  const textareaClasses = `
    block w-full px-3 py-2 text-sm border rounded-md transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    resize-vertical
    ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}
    ${fullWidth ? 'w-full' : ''}
  `

  return (
    <div className={cn('space-y-1', fullWidth ? 'w-full' : '')}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <textarea
        className={cn(textareaClasses, className)}
        {...props}
      />
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

// Enhanced Select Component
interface EnhancedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
  fullWidth?: boolean
}

const EnhancedSelect: React.FC<EnhancedSelectProps> = ({
  label,
  error,
  helperText,
  options,
  placeholder,
  fullWidth = false,
  className,
  ...props
}) => {
  const selectClasses = `
    block w-full px-3 py-2 text-sm border rounded-md transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}
    ${fullWidth ? 'w-full' : ''}
  `

  return (
    <div className={cn('space-y-1', fullWidth ? 'w-full' : '')}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <select
        className={cn(selectClasses, className)}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

// Enhanced Checkbox Component
interface EnhancedCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
}

const EnhancedCheckbox: React.FC<EnhancedCheckboxProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  ...props
}) => {
  return (
    <div className={cn('space-y-1', fullWidth ? 'w-full' : '')}>
      <label className="flex items-start space-x-3 cursor-pointer">
        <input
          type="checkbox"
          className={cn(
            'mt-1 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500',
            'transition-colors duration-200',
            error ? 'border-red-300' : '',
            className
          )}
          {...props}
        />
        {label && (
          <span className="text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </span>
        )}
      </label>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

// Enhanced Radio Component
interface EnhancedRadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  fullWidth?: boolean
}

const EnhancedRadio: React.FC<EnhancedRadioProps> = ({
  label,
  error,
  helperText,
  options,
  fullWidth = false,
  className,
  name,
  ...props
}) => {
  return (
    <div className={cn('space-y-1', fullWidth ? 'w-full' : '')}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                'h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500',
                'transition-colors duration-200',
                error ? 'border-red-300' : '',
                className
              )}
              {...props}
            />
            <span className="text-sm text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
}

// Enhanced Loading Spinner with Design System
interface EnhancedLoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white' | 'gray'
  text?: string
  fullScreen?: boolean
}

const EnhancedLoadingSpinner: React.FC<EnhancedLoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  text,
  fullScreen = false
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  const colorClasses = {
    primary: 'text-red-600',
    secondary: 'text-gray-600',
    white: 'text-white',
    gray: 'text-gray-400'
  }

  const spinner = (
    <div className="flex flex-col items-center justify-center space-y-2">
      <svg
        className={cn(
          'animate-spin',
          sizeClasses[size],
          colorClasses[color]
        )}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && (
        <p className={cn(
          'text-sm font-medium',
          colorClasses[color]
        )}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

// Enhanced Alert Component
interface EnhancedAlertProps {
  variant?: 'success' | 'warning' | 'error' | 'info'
  title?: string
  message: string
  dismissible?: boolean
  onDismiss?: () => void
  icon?: React.ReactNode
}

const EnhancedAlert: React.FC<EnhancedAlertProps> = ({
  variant = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  icon
}) => {
  const variantClasses = {
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const iconClasses = {
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
    info: 'text-blue-400'
  }

  const defaultIcons = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
  }

  return (
    <div className={cn(
      'border rounded-md p-4 transition-all duration-200',
      variantClasses[variant]
    )}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className={cn('text-lg', iconClasses[variant])}>
            {icon || defaultIcons[variant]}
          </span>
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">
              {title}
            </h3>
          )}
          <p className="text-sm">
            {message}
          </p>
        </div>
        {dismissible && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className={cn(
                'inline-flex rounded-md p-1.5 transition-colors duration-200',
                'hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2',
                iconClasses[variant]
              )}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Export all components
export {
  DESIGN_TOKENS,
  EnhancedButton as Button,
  EnhancedCard as Card,
  EnhancedInput as Input,
  EnhancedTextarea as Textarea,
  EnhancedSelect as Select,
  EnhancedCheckbox as Checkbox,
  EnhancedRadio as Radio,
  EnhancedLoadingSpinner as LoadingSpinner,
  EnhancedAlert as Alert
}
