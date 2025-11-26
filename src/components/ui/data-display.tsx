"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

// Enhanced Data Table Component
interface Column {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps {
  data: any[]
  columns: Column[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: any) => void
  onSort?: (column: string, direction: 'asc' | 'desc') => void
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  striped?: boolean
  hoverable?: boolean
  selectable?: boolean
  selectedRows?: string[]
  onSelectionChange?: (selectedRows: string[]) => void
  className?: string
}

const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  onSort,
  sortColumn,
  sortDirection,
  striped = true,
  hoverable = true,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  className
}) => {
  const [internalSortColumn, setInternalSortColumn] = useState<string | null>(null)
  const [internalSortDirection, setInternalSortDirection] = useState<'asc' | 'desc'>('asc')

  const currentSortColumn = sortColumn || internalSortColumn
  const currentSortDirection = sortDirection || internalSortDirection

  const handleSort = (column: string) => {
    if (!columns.find(col => col.key === column)?.sortable) return

    const newDirection = currentSortColumn === column && currentSortDirection === 'asc' ? 'desc' : 'asc'
    
    if (onSort) {
      onSort(column, newDirection)
    } else {
      setInternalSortColumn(column)
      setInternalSortDirection(newDirection)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (!selectable || !onSelectionChange) return
    
    const allIds = data.map(row => row.id)
    onSelectionChange(checked ? allIds : [])
  }

  const handleSelectRow = (rowId: string, checked: boolean) => {
    if (!selectable || !onSelectionChange) return
    
    if (checked) {
      onSelectionChange([...selectedRows, rowId])
    } else {
      onSelectionChange(selectedRows.filter(id => id !== rowId))
    }
  }

  const isAllSelected = selectable && data.length > 0 && selectedRows.length === data.length
  const isIndeterminate = selectable && selectedRows.length > 0 && selectedRows.length < data.length

  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No data</h3>
          <p className="mt-1 text-sm text-gray-500">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                </th>
              )}
              
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
                    column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left',
                    column.sortable && 'cursor-pointer hover:bg-gray-100',
                    column.width && `w-${column.width}`
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        <svg
                          className={cn(
                            'w-3 h-3',
                            currentSortColumn === column.key && currentSortDirection === 'asc'
                              ? 'text-red-600'
                              : 'text-gray-400'
                          )}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        <svg
                          className={cn(
                            'w-3 h-3 -mt-1',
                            currentSortColumn === column.key && currentSortDirection === 'desc'
                              ? 'text-red-600'
                              : 'text-gray-400'
                          )}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className={cn(
            'bg-white divide-y divide-gray-200',
            striped && 'divide-y divide-gray-200'
          )}>
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                className={cn(
                  'transition-colors duration-150',
                  striped && index % 2 === 1 && 'bg-gray-50',
                  hoverable && 'hover:bg-gray-50',
                  onRowClick && 'cursor-pointer',
                  selectedRows.includes(row.id) && 'bg-red-50'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row.id)}
                      onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                  </td>
                )}
                
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 whitespace-nowrap text-sm',
                      column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    {column.render 
                      ? column.render(row[column.key], row) 
                      : row[column.key] !== null && row[column.key] !== undefined 
                        ? String(row[column.key]) 
                        : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Enhanced Stats Card Component
interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
    period?: string
  }
  icon?: React.ReactNode
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  loading?: boolean
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  color = 'primary',
  loading = false
}) => {
  const colorClasses = {
    primary: 'bg-red-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500'
  }

  const iconColorClasses = {
    primary: 'text-red-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
    info: 'text-blue-600'
  }

  const changeColorClasses = {
    increase: 'text-green-600',
    decrease: 'text-red-600',
    neutral: 'text-gray-600'
  }

  const changeIcons = {
    increase: '↗',
    decrease: '↘',
    neutral: '→'
  }

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
        <div className="p-5">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {icon && (
              <div className={cn('p-3 rounded-md', iconColorClasses[color])}>
                {icon}
              </div>
            )}
          </div>
          
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {value}
                </div>
                
                {change && (
                  <div className={cn(
                    'ml-2 flex items-baseline text-sm font-semibold',
                    changeColorClasses[change.type]
                  )}>
                    <span className="mr-1">{changeIcons[change.type]}</span>
                    {Math.abs(change.value)}%
                    {change.period && (
                      <span className="ml-1 text-gray-500">
                        {change.period}
                      </span>
                    )}
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

// Enhanced Timeline Component
interface TimelineItem {
  id: string
  title: string
  description?: string
  timestamp: string
  status?: 'completed' | 'current' | 'upcoming'
  icon?: React.ReactNode
}

interface TimelineProps {
  items: TimelineItem[]
  orientation?: 'vertical' | 'horizontal'
}

const Timeline: React.FC<TimelineProps> = ({
  items,
  orientation = 'vertical'
}) => {
  const statusClasses = {
    completed: 'bg-green-500 border-green-500',
    current: 'bg-red-500 border-red-500',
    upcoming: 'bg-gray-300 border-gray-300'
  }

  if (orientation === 'horizontal') {
    return (
      <div className="flex items-center space-x-4 overflow-x-auto pb-4">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-sm font-medium',
                statusClasses[item.status || 'upcoming']
              )}>
                {item.icon || (index + 1)}
              </div>
              <div className="mt-2 text-center max-w-32">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.title}
                </p>
                <p className="text-xs text-gray-500">
                  {item.timestamp}
                </p>
              </div>
            </div>
            
            {index < items.length - 1 && (
              <div className="w-16 h-0.5 bg-gray-300 mx-2"></div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {items.map((item, index) => (
          <li key={item.id}>
            <div className="relative pb-8">
              {index !== items.length - 1 && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              
              <div className="relative flex space-x-3">
                <div>
                  <span className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white',
                    statusClasses[item.status || 'upcoming']
                  )}>
                    {item.icon || (
                      <span className="text-white text-sm font-medium">
                        {index + 1}
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right text-sm whitespace-nowrap text-gray-500">
                    {item.timestamp}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Enhanced Empty State Component
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16'
  }

  const iconSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      sizeClasses[size]
    )}>
      {icon && (
        <div className={cn('text-gray-400 mb-4', iconSizeClasses[size])}>
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-gray-500 mb-6 max-w-sm">
          {description}
        </p>
      )}
      
      {action && action}
    </div>
  )
}

// Export all data display components
export {
  DataTable,
  StatCard,
  Timeline,
  EmptyState
}
