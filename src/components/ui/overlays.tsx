"use client"

import React, { useEffect } from 'react'
import { cn } from '@/lib/utils'

// Enhanced Modal Component
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  footer?: React.ReactNode
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  footer
}) => {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, closeOnEscape, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            'relative w-full bg-white rounded-lg shadow-xl transform transition-all',
            sizeClasses[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              {title && (
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          
          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>
          
          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Enhanced Drawer Component
interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  position?: 'left' | 'right' | 'top' | 'bottom'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
}

const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true
}) => {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, closeOnEscape, onClose])

  if (!isOpen) return null

  const positionClasses = {
    left: 'left-0 top-0 h-full',
    right: 'right-0 top-0 h-full',
    top: 'top-0 left-0 w-full',
    bottom: 'bottom-0 left-0 w-full'
  }

  const sizeClasses = {
    sm: position === 'left' || position === 'right' ? 'w-80' : 'h-80',
    md: position === 'left' || position === 'right' ? 'w-96' : 'h-96',
    lg: position === 'left' || position === 'right' ? 'w-1/2' : 'h-1/2',
    xl: position === 'left' || position === 'right' ? 'w-2/3' : 'h-2/3'
  }

  const transformClasses = {
    left: 'transform -translate-x-full',
    right: 'transform translate-x-full',
    top: 'transform -translate-y-full',
    bottom: 'transform translate-y-full'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      
      {/* Drawer */}
      <div
        className={cn(
          'fixed bg-white shadow-xl transition-transform duration-300',
          positionClasses[position],
          sizeClasses[size],
          isOpen ? 'transform-none' : transformClasses[position]
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
            )}
            
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// Enhanced Toast Component
interface ToastProps {
  id: string
  title?: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onClose: (id: string) => void
  action?: {
    label: string
    onClick: () => void
  }
}

const Toast: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  duration = 5000,
  onClose,
  action
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const typeClasses = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const iconClasses = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400'
  }

  const defaultIcons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }

  return (
    <div className={cn(
      'max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto',
      'ring-1 ring-black ring-opacity-5 overflow-hidden',
      'transform transition-all duration-300 ease-in-out'
    )}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className={cn('text-lg', iconClasses[type])}>
              {defaultIcons[type]}
            </span>
          </div>
          
          <div className="ml-3 w-0 flex-1">
            {title && (
              <p className="text-sm font-medium text-gray-900">
                {title}
              </p>
            )}
            <p className={cn(
              'text-sm',
              title ? 'mt-1 text-gray-500' : 'text-gray-900'
            )}>
              {message}
            </p>
            
            {action && (
              <div className="mt-3">
                <button
                  onClick={action.onClick}
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>
          
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onClose(id)}
              className="bg-white rounded-md inline-flex text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Close notification"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Enhanced Toast Container Component
interface ToastContainerProps {
  toasts: Array<{
    id: string
    title?: string
    message: string
    type?: 'success' | 'error' | 'warning' | 'info'
    duration?: number
    action?: {
      label: string
      onClick: () => void
    }
  }>
  onClose: (id: string) => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onClose,
  position = 'top-right'
}) => {
  const positionClasses = {
    'top-right': 'top-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'top-center': 'top-0 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-0 left-1/2 transform -translate-x-1/2'
  }

  return (
    <div className={cn(
      'fixed z-50 w-full max-w-sm px-4 py-6 pointer-events-none',
      positionClasses[position]
    )}>
      <div className="space-y-4">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  )
}

// Enhanced Popover Component
interface PopoverProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  trigger: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  offset?: number
}

const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  children,
  trigger,
  position = 'bottom',
  offset = 8
}) => {
  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-white',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-white',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-white',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-white'
  }

  return (
    <div className="relative inline-block">
      {trigger}
      
      {isOpen && (
        <div className={cn(
          'absolute z-50 w-64 bg-white rounded-lg shadow-lg border border-gray-200',
          'transform transition-all duration-200',
          positionClasses[position]
        )}>
          <div className="p-4">
            {children}
          </div>
          
          {/* Arrow */}
          <div className={cn(
            'absolute w-0 h-0 border-4 border-transparent',
            arrowClasses[position]
          )} />
        </div>
      )}
    </div>
  )
}

// Export all modal and overlay components
export {
  Modal,
  Drawer,
  Toast,
  ToastContainer,
  Popover
}
