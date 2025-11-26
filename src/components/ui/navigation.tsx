"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Enhanced Navigation Item Component
interface NavItemProps {
  href: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

const NavItem: React.FC<NavItemProps> = ({
  href,
  label,
  icon,
  badge,
  active = false,
  disabled = false,
  onClick
}) => {
  const pathname = usePathname()
  const isActive = active || pathname === href

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
        'hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500',
        isActive
          ? 'bg-red-100 text-red-700 border-r-2 border-red-600'
          : 'text-gray-600',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
      )}
    >
      {icon && <span className="mr-3 text-lg">{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
          {badge}
        </span>
      )}
    </Link>
  )
}

// Enhanced Sidebar Component
interface SidebarProps {
  children: React.ReactNode
  title?: string
  logo?: React.ReactNode
  footer?: React.ReactNode
  collapsed?: boolean
  onToggle?: () => void
}

const Sidebar: React.FC<SidebarProps> = ({
  children,
  title,
  logo,
  footer,
  collapsed = false,
  onToggle
}) => {
  return (
    <div className={cn(
      'flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            {logo && <div className="text-2xl">{logo}</div>}
            {title && (
              <h1 className="text-lg font-semibold text-gray-900">
                {title}
              </h1>
            )}
          </div>
        )}
        
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {children}
      </nav>

      {/* Footer */}
      {footer && (
        <div className="px-3 py-4 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  )
}

// Enhanced Breadcrumb Component
interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  maxItems?: number
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '>',
  maxItems = 5
}) => {
  const displayItems = items.length > maxItems
    ? [
        items[0],
        { label: '...', href: undefined },
        ...items.slice(-maxItems + 2)
      ]
    : items

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500">
      {displayItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-gray-500 mx-2">{separator}</span>
          )}
          
          {item.href ? (
            <Link
              href={item.href}
              className="flex items-center space-x-1 hover:text-gray-700 transition-colors duration-200"
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span className="flex items-center space-x-1">
              {item.icon && <span>{item.icon}</span>}
              <span className={item.label === '...' ? 'text-gray-500' : 'text-gray-900'}>
                {item.label}
              </span>
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

// Enhanced Tab Component
interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
  disabled?: boolean
}

interface TabsProps {
  items: TabItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
  variant?: 'default' | 'pills' | 'underline'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onTabChange,
  variant = 'default',
  size = 'md',
  fullWidth = false
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const variantClasses = {
    default: 'border-b-2 border-transparent hover:border-gray-300',
    pills: 'rounded-md',
    underline: 'border-b-2 border-transparent hover:border-gray-300'
  }

  const activeClasses = {
    default: 'border-red-600 text-red-600',
    pills: 'bg-red-100 text-red-700',
    underline: 'border-red-600 text-red-600'
  }

  return (
    <div className={cn(
      'flex space-x-1',
      fullWidth ? 'w-full' : ''
    )}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => !item.disabled && onTabChange(item.id)}
          disabled={item.disabled}
          className={cn(
            'flex items-center space-x-2 font-medium transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
            sizeClasses[size],
            variantClasses[variant],
            activeTab === item.id
              ? activeClasses[variant]
              : 'text-gray-600 hover:text-gray-900',
            item.disabled && 'opacity-50 cursor-not-allowed',
            fullWidth && 'flex-1 justify-center'
          )}
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
          {item.badge && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// Enhanced Pagination Component
interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showFirstLast?: boolean
  showPrevNext?: boolean
  maxVisiblePages?: number
  size?: 'sm' | 'md' | 'lg'
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  showPrevNext = true,
  maxVisiblePages = 5,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const getVisiblePages = () => {
    const pages: number[] = []
    const half = Math.floor(maxVisiblePages / 2)
    
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, start + maxVisiblePages - 1)
    
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1)
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    return pages
  }

  const visiblePages = getVisiblePages()

  return (
    <nav className="flex items-center justify-center space-x-1">
      {/* First Page */}
      {showFirstLast && currentPage > 1 && (
        <button
          onClick={() => onPageChange(1)}
          className={cn(
            'flex items-center px-2 py-2 text-sm font-medium text-gray-500',
            'hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-red-500'
          )}
        >
          First
        </button>
      )}

      {/* Previous Page */}
      {showPrevNext && currentPage > 1 && (
        <button
          onClick={() => onPageChange(currentPage - 1)}
          className={cn(
            'flex items-center px-2 py-2 text-sm font-medium text-gray-500',
            'hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-red-500'
          )}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>
      )}

      {/* Page Numbers */}
      {visiblePages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={cn(
            'font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500',
            sizeClasses[size],
            page === currentPage
              ? 'bg-red-600 text-white'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
            'rounded-md'
          )}
        >
          {page}
        </button>
      ))}

      {/* Next Page */}
      {showPrevNext && currentPage < totalPages && (
        <button
          onClick={() => onPageChange(currentPage + 1)}
          className={cn(
            'flex items-center px-2 py-2 text-sm font-medium text-gray-500',
            'hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-red-500'
          )}
        >
          Next
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Last Page */}
      {showFirstLast && currentPage < totalPages && (
        <button
          onClick={() => onPageChange(totalPages)}
          className={cn(
            'flex items-center px-2 py-2 text-sm font-medium text-gray-500',
            'hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-red-500'
          )}
        >
          Last
        </button>
      )}
    </nav>
  )
}

// Enhanced Mobile Menu Component
interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  children,
  title
}) => {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50 transform transition-transform duration-300">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          {title && (
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="px-3 py-4 space-y-1">
          {children}
        </nav>
      </div>
    </>
  )
}

// Export all navigation components
export {
  NavItem,
  Sidebar,
  Breadcrumb,
  Tabs,
  Pagination,
  MobileMenu
}
