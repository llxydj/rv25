"use client"

import { useState, useEffect } from "react"
import { Calendar, X, Filter } from "lucide-react"
import { CITIES, getBarangays } from "@/lib/locations"

interface EnhancedReportFiltersProps {
  onFilterChange: (filters: ReportFilters) => void
  initialFilters?: Partial<ReportFilters>
}

export interface ReportFilters {
  dateRanges: Array<{ start: string; end: string; label: string }>
  incidentTypes: string[]
  barangays: string[]
  statuses: string[]
  volunteerIds: string[]
  dateRange: { start: string; end: string }
}

const INCIDENT_TYPES = [
  'FIRE', 'MEDICAL', 'FLOOD', 'EARTHQUAKE', 'TRAFFIC', 'CRIME', 'OTHER'
]

const STATUSES = [
  'PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'
]

export function EnhancedReportFilters({ onFilterChange, initialFilters }: EnhancedReportFiltersProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    dateRanges: [],
    incidentTypes: [],
    barangays: [],
    statuses: [],
    volunteerIds: [],
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    ...initialFilters
  })

  const [selectedCity, setSelectedCity] = useState("")
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([])

  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: value }
    }))
  }

  const toggleFilter = (type: 'incidentTypes' | 'barangays' | 'statuses', value: string) => {
    setFilters(prev => {
      const current = prev[type]
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [type]: updated }
    })
  }

  const clearFilter = (type: 'incidentTypes' | 'barangays' | 'statuses', value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].filter(v => v !== value)
    }))
  }

  const clearAllFilters = () => {
    setFilters({
      dateRanges: [],
      incidentTypes: [],
      barangays: [],
      statuses: [],
      volunteerIds: [],
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      }
    })
    setSelectedCity("")
    setAvailableBarangays([])
  }

  const handleCityChange = (city: string) => {
    setSelectedCity(city)
    if (city) {
      const barangays = getBarangays(city)
      setAvailableBarangays(barangays)
    } else {
      setAvailableBarangays([])
      setFilters(prev => ({ ...prev, barangays: [] }))
    }
  }

  const activeFiltersCount = 
    filters.incidentTypes.length + 
    filters.barangays.length + 
    filters.statuses.length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Report Filters
        </h3>
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Clear All ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            Start Date
          </label>
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => handleDateRangeChange('start', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            End Date
          </label>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => handleDateRangeChange('end', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Incident Types - Multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Incident Types
        </label>
        <div className="flex flex-wrap gap-2">
          {INCIDENT_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => toggleFilter('incidentTypes', type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.incidentTypes.includes(type)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type}
              {filters.incidentTypes.includes(type) && (
                <X className="h-3 w-3 inline ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Status - Multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => toggleFilter('statuses', status)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.statuses.includes(status)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {status}
              {filters.statuses.includes(status) && (
                <X className="h-3 w-3 inline ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Barangay - Multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          City
        </label>
        <select
          value={selectedCity}
          onChange={(e) => handleCityChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-3"
        >
          <option value="">Select City</option>
          {CITIES.map(city => (
            <option key={city.name} value={city.name}>{city.name}</option>
          ))}
        </select>

        {availableBarangays.length > 0 && (
          <>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Barangays
            </label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {availableBarangays.map(barangay => (
                <button
                  key={barangay}
                  type="button"
                  onClick={() => toggleFilter('barangays', barangay)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filters.barangays.includes(barangay)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {barangay}
                  {filters.barangays.includes(barangay) && (
                    <X className="h-3 w-3 inline ml-1" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Active Filter Chips */}
      {(filters.incidentTypes.length > 0 || filters.barangays.length > 0 || filters.statuses.length > 0) && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {filters.incidentTypes.map(type => (
              <span
                key={type}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
              >
                Type: {type}
                <button
                  onClick={() => clearFilter('incidentTypes', type)}
                  className="ml-2 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {filters.barangays.map(barangay => (
              <span
                key={barangay}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
              >
                Barangay: {barangay}
                <button
                  onClick={() => clearFilter('barangays', barangay)}
                  className="ml-2 hover:text-purple-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {filters.statuses.map(status => (
              <span
                key={status}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
              >
                Status: {status}
                <button
                  onClick={() => clearFilter('statuses', status)}
                  className="ml-2 hover:text-green-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

