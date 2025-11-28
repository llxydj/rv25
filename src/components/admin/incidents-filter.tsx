"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Calendar, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { DateRange } from "react-day-picker"

type FilterType = 'searchTerm' | 'barangay' | 'status' | 'incidentType' | 'priority' | 'dateRange' | 'dataFormat'

interface IncidentsFilterProps {
  onFilterChange: (filters: {
    searchTerm: string
    barangay: string
    status: string
    incidentType: string
    priority: string
    dateRange: { from: Date | undefined; to: Date | undefined }
    dataFormat: string
  }) => void
  barangays: string[]
  incidentTypes: string[]
}

const STATUS_OPTIONS = ["ALL", "PENDING", "ASSIGNED", "RESPONDING", "ACTIVE", "RESOLVED", "CANCELLED"] as const
const PRIORITY_OPTIONS = ["", "1", "2", "3", "4", "5"] as const

export function IncidentsFilter({ onFilterChange, barangays, incidentTypes }: IncidentsFilterProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [barangay, setBarangay] = useState("")
  const [status, setStatus] = useState("ALL")
  const [incidentType, setIncidentType] = useState("")
  const [priority, setPriority] = useState("")
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [dataFormat, setDataFormat] = useState("ALL")

  const notifyFilterChange = useCallback(() => {
    onFilterChange({
      searchTerm: searchTerm.trim(),
      barangay,
      status,
      incidentType,
      priority,
      dateRange: { from: dateRange.from, to: dateRange.to },
      dataFormat
    })
  }, [searchTerm, barangay, status, incidentType, priority, dateRange, dataFormat, onFilterChange])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      notifyFilterChange()
    }, searchTerm ? 300 : 0)

    return () => clearTimeout(timeoutId)
  }, [notifyFilterChange, searchTerm])

  const handleDateRangeSelect = useCallback((range: DateRange | undefined) => {
    setDateRange(range || { from: undefined, to: undefined })
    setDatePopoverOpen(false)
  }, [])

  const clearFilters = useCallback(() => {
    setSearchTerm("")
    setBarangay("")
    setStatus("ALL")
    setIncidentType("")
    setPriority("")
    setDateRange({ from: undefined, to: undefined })
    setDataFormat("ALL")
  }, [])

  const clearFilter = useCallback((filterType: FilterType) => {
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
      case 'dataFormat':
        setDataFormat("ALL")
        break
    }
  }, [])

  const hasActiveFilters = useMemo(() => 
    Boolean(searchTerm.trim() || barangay || status !== "ALL" || incidentType || priority || dateRange.from || dateRange.to || dataFormat !== "ALL"),
    [searchTerm, barangay, status, incidentType, priority, dateRange, dataFormat]
  )

  const formatDateRange = useCallback(() => {
    if (!dateRange.from && !dateRange.to) return "All dates"
    if (dateRange.from && !dateRange.to) {
      try {
        return format(dateRange.from, "MMM d, yyyy")
      } catch {
        return "All dates"
      }
    }
    if (dateRange.from && dateRange.to) {
      try {
        return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
      } catch {
        return "All dates"
      }
    }
    return "All dates"
  }, [dateRange])

  const presetRanges = useMemo(() => [
    { label: "Today", range: { from: startOfDay(new Date()), to: endOfDay(new Date()) } },
    { label: "Last 7 days", range: { from: subDays(new Date(), 7), to: endOfDay(new Date()) } },
    { label: "Last 30 days", range: { from: subDays(new Date(), 30), to: endOfDay(new Date()) } },
  ], [])

  const filterConfigs = useMemo(() => [
    { value: barangay, set: setBarangay, label: "All Barangays", options: barangays, name: 'barangay' as const },
    { value: status, set: setStatus, label: "All Statuses", options: STATUS_OPTIONS, name: 'status' as const },
    { value: incidentType, set: setIncidentType, label: "All Types", options: incidentTypes, name: 'incidentType' as const },
    { value: priority, set: setPriority, label: "All Priorities", options: PRIORITY_OPTIONS, name: 'priority' as const },
    { value: dataFormat, set: setDataFormat, label: "All Formats", options: ["ALL", "CURRENT"], name: 'dataFormat' as const }
  ], [barangay, status, incidentType, priority, dataFormat, barangays, incidentTypes])

  return (
    <div className="space-y-4 p-4 bg-background" role="search" aria-label="Incident filters">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Input
              type="search"
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 text-sm sm:text-base"
              aria-label="Search incidents"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => clearFilter('searchTerm')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground touch-manipulation transition-colors"
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
              type="button"
              variant="outline"
              className={cn(
                "w-full sm:w-auto justify-start text-left font-normal text-sm sm:text-base min-h-[2.5rem]",
                !dateRange.from && !dateRange.to && "text-muted-foreground"
              )}
              aria-label="Select date range"
            >
              <Calendar className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{formatDateRange()}</span>
              {(dateRange.from || dateRange.to) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFilter('dateRange') }}
                  className="ml-2 text-muted-foreground hover:text-foreground touch-manipulation flex-shrink-0 transition-colors"
                  aria-label="Clear date range"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={5}>
            <div className="p-3 border-b border-border flex flex-wrap gap-2">
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeSelect(preset.range)}
                  className="text-xs sm:text-sm"
                >
                  {preset.label}
                </Button>
              ))}
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
            type="button"
            variant="outline" 
            onClick={clearFilters}
            className="w-full sm:w-auto text-sm sm:text-base min-h-[2.5rem]"
            aria-label="Clear all filters"
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filterConfigs.map(({ value, set, label, options, name }) => (
          <div key={name} className="relative">
            <select
              value={value}
              onChange={(e) => set(e.target.value)}
              className="block w-full pl-3 pr-10 py-2.5 text-sm sm:text-base text-foreground bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring focus:border-input rounded-md appearance-none min-h-[2.5rem] touch-manipulation transition-colors"
              aria-label={`Filter by ${label}`}
            >
              <option value="" className="bg-popover text-popover-foreground">{label}</option>
              {options.map((opt) => (
                <option key={opt} value={opt} className="bg-popover text-popover-foreground">
                  {opt === "" ? "None" : opt}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            {value && (
              <button
                type="button"
                onClick={() => set("")}
                className="absolute right-8 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground touch-manipulation z-10 transition-colors"
                aria-label={`Clear ${label} filter`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}