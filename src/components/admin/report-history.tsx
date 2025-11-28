"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileText, Calendar, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { format } from 'date-fns'

interface ReportHistoryItem {
  id: string
  report_type: string
  title: string
  file_name: string
  file_url: string
  file_size?: number
  generated_at: string
  download_count: number
  filters: any
}

export function ReportHistory() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportHistory()
  }, [])

  const fetchReportHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/reports/history?limit=50')
      const json = await res.json()
      
      if (json.success) {
        setReports(json.data || [])
      } else {
        throw new Error(json.message || 'Failed to fetch report history')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load report history')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (report: ReportHistoryItem) => {
    try {
      // Increment download count
      await fetch('/api/reports/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id })
      })

      // Download the file
      const link = document.createElement('a')
      link.href = report.file_url
      link.download = report.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Report downloaded')
      fetchReportHistory() // Refresh to update download count
    } catch (error: any) {
      toast.error(error.message || 'Failed to download report')
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Report History</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">View and download previously generated reports</p>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Report History
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generated reports will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                    <CardDescription>
                      {report.report_type} • {formatFileSize(report.file_size)}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => handleDownload(report)}
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>Generated: {format(new Date(report.generated_at), 'PPp')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Download className="h-4 w-4" />
                    <span>Downloads: {report.download_count}</span>
                  </div>
                  {report.filters?.startDate && report.filters?.endDate && (
                    <div className="text-gray-600 dark:text-gray-400">
                      Period: {format(new Date(report.filters.startDate), 'PP')} - {format(new Date(report.filters.endDate), 'PP')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

