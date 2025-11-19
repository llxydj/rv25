"use client"

import React, { useState, useEffect } from "react"
import { Calendar, Filter, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRange } from "react-day-picker"

interface IncidentsFilterProps {
  onFilterChange: (filters: {
    searchTerm: string
    barangay: string
    status: string
    incidentType: string
    priority: string
    dateRange: { from: Date | undefined; to: Date | undefined }
  }) => void
  barangays: string[]
  incidentTypes: string[]
}

export function IncidentsFilter({ onFilterChange, barangays, incidentTypes }: IncidentsFilterProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [barangay, setBarangay] = useState("")
  const [status, setStatus] = useState("ALL")
  const [incidentType, setIncidentType] = useState("")
  const [priority, setPriority] = useState("")
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  })
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)

  // Apply filters when any filter changes
  useEffect(() => {
    onFilterChange({
      searchTerm,
      barangay,
      status,
      incidentType,
      priority,
      dateRange: {
        from: dateRange.from,
        to: dateRange.to
      }
    })
  }, [searchTerm, barangay, status, incidentType, priority, dateRange, onFilterChange])

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range || { from: undefined, to: undefined })
    setDatePopoverOpen(false)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setBarangay("")
    setStatus("ALL")
    setIncidentType("")
    setPriority("")
    setDateRange({ from: undefined, to: undefined })
  }

  const clearFilter = (filterType: string) => {
    switch (filterType) {
      case 'searchTerm':
        setSearchTerm("")
        break
      case 'barangay':
        setBarangay("")
        break
      case 'status':
        setStatus("ALL")
        break
      case 'incidentType':
        setIncidentType("")
        break
      case 'priority':
        setPriority("")
        break
      case 'dateRange':
        setDateRange({ from: undefined, to: undefined })
        break
    }
  }

  const hasActiveFilters = searchTerm || barangay || status !== "ALL" || incidentType || priority || dateRange.from || dateRange.to

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) return "All dates"
    if (dateRange.from && !dateRange.to) return format(dateRange.from, "MMM d, yyyy")
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
    }
    return "All dates"
  }

  const presetRanges = [
    { label: "Today", range: { from: startOfDay(new Date()), to: endOfDay(new Date()) } },
    { label: "Last 7 days", range: { from: subDays(new Date(), 7), to: endOfDay(new Date()) } },
    { label: "Last 30 days", range: { from: subDays(new Date(), 30), to: endOfDay(new Date()) } },
  ]

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Input
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 text-sm sm:text-base"
            />
            {searchTerm && (
              <button
                onClick={() => clearFilter('searchTerm')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-auto justify-start text-left font-normal text-sm sm:text-base min-h-[2.5rem]",
                !dateRange.from && !dateRange.to && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{formatDateRange()}</span>
              {(dateRange.from || dateRange.to) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFilter('dateRange')
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600 touch-manipulation flex-shrink-0"
                  aria-label="Clear date range"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={5}>
            <div className="p-3 border-b">
              <div className="flex flex-wrap gap-2">
                {presetRanges.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDateRangeSelect(preset.range)}
                    className="text-xs sm:text-sm"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange}
              onSelect={handleDateRangeSelect}
              numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2}
            />
          </PopoverContent>
        </Popover>
        
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            onClick={clearFilters}
            className="w-full sm:w-auto text-sm sm:text-base min-h-[2.5rem]"
          >
            Clear All
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <select
            value={barangay}
            onChange={(e) => setBarangay(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-sm sm:text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md appearance-none bg-white min-h-[2.5rem] touch-manipulation"
          >
            <option value="">All Barangays</option>
            {barangays.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          {barangay && (
            <button
              onClick={() => clearFilter('barangay')}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation z-10"
              aria-label="Clear barangay filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="relative">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-sm sm:text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md appearance-none bg-white min-h-[2.5rem] touch-manipulation"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RESPONDING">Responding</option>
            <option value="ACTIVE">Active (Assigned & Responding)</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          {status !== "ALL" && (
            <button
              onClick={() => clearFilter('status')}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation z-10"
              aria-label="Clear status filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="relative">
          <select
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-sm sm:text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md appearance-none bg-white min-h-[2.5rem] touch-manipulation"
          >
            <option value="">All Types</option>
            {incidentTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          {incidentType && (
            <button
              onClick={() => clearFilter('incidentType')}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation z-10"
              aria-label="Clear incident type filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="relative">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="block w-full pl-3 pr-10 py-2.5 text-sm sm:text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md appearance-none bg-white min-h-[2.5rem] touch-manipulation"
          >
            <option value="">All Priorities</option>
            <option value="1">Critical</option>
            <option value="2">High</option>
            <option value="3">Medium</option>
            <option value="4">Low</option>
            <option value="5">Info</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          {priority && (
            <button
              onClick={() => clearFilter('priority')}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation z-10"
              aria-label="Clear priority filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}