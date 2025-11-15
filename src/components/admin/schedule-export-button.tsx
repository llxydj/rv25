"use client"

import { useState } from "react"
import { Download, FileText, FileSpreadsheet, Calendar } from "lucide-react"
import { getSchedules } from "@/lib/schedules"
import { schedulesToCSV, downloadCSV, downloadJSON, formatScheduleForExport, generateScheduleSummary } from "@/lib/export-schedules"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "sonner"

interface ScheduleExportButtonProps {
  filters?: {
    volunteer_id?: string
    start_date?: Date
    end_date?: Date
    status?: string
    barangay?: string
  }
}

export function ScheduleExportButton({ filters }: ScheduleExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true)
      setShowMenu(false)

      // Fetch schedules with filters
      const result = await getSchedules(filters)
      
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to fetch schedules')
      }

      // Format schedules for export
      const exportData = result.data.map(formatScheduleForExport)
      
      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0]
      const filterSuffix = filters?.volunteer_id ? '-volunteer' : filters?.barangay ? `-${filters.barangay}` : ''
      
      if (format === 'csv') {
        const csv = schedulesToCSV(exportData)
        downloadCSV(csv, `schedules-${dateStr}${filterSuffix}.csv`)
        toast.success(`Exported ${exportData.length} schedules to CSV`)
      } else {
        const summary = generateScheduleSummary(exportData)
        const jsonData = {
          metadata: {
            exportDate: new Date().toISOString(),
            totalRecords: exportData.length,
            filters: filters || {},
            summary
          },
          schedules: exportData
        }
        downloadJSON(jsonData, `schedules-${dateStr}${filterSuffix}.json`)
        toast.success(`Exported ${exportData.length} schedules to JSON`)
      }
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error(error.message || 'Failed to export schedules')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {exporting ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export
          </>
        )}
      </button>

      {showMenu && !exporting && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1" role="menu">
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                role="menuitem"
              >
                <FileSpreadsheet className="mr-3 h-4 w-4 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">Export as CSV</div>
                  <div className="text-xs text-gray-500">Excel-compatible format</div>
                </div>
              </button>
              
              <button
                onClick={() => handleExport('json')}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                role="menuitem"
              >
                <FileText className="mr-3 h-4 w-4 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Export as JSON</div>
                  <div className="text-xs text-gray-500">With metadata & summary</div>
                </div>
              </button>

              <div className="border-t border-gray-100 my-1"></div>
              
              <div className="px-4 py-2 text-xs text-gray-500">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-3 w-3" />
                  Exports current filtered view
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
