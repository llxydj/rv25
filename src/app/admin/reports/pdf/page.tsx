"use client"

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { PDFReportGenerator } from '@/components/admin/pdf-report-generator'
import { ScheduledReports } from '@/components/admin/scheduled-reports'
import { ReportHistory } from '@/components/admin/report-history'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Download, Calendar, BarChart3 } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function AdminPDFReportsPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh] p-4">
          <LoadingSpinner size="lg" text="Loading PDF reports..." />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
            PDF Report Generation
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            Generate comprehensive PDF reports for incidents, volunteers, and analytics
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="generator" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-800 p-1">
            <TabsTrigger 
              value="generator" 
              className="flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 text-gray-600 dark:text-gray-400"
            >
              <FileText className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Report Generator</span>
              <span className="sm:hidden">Generator</span>
            </TabsTrigger>
            <TabsTrigger 
              value="scheduled" 
              className="flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 text-gray-600 dark:text-gray-400"
            >
              <Calendar className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Scheduled Reports</span>
              <span className="sm:hidden">Scheduled</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-100 text-gray-600 dark:text-gray-400"
            >
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Report History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
          </TabsList>

          {/* Generator Tab */}
          <TabsContent value="generator" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
            <PDFReportGenerator />
          </TabsContent>

          {/* Scheduled Tab */}
          <TabsContent value="scheduled" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
            <ScheduledReports />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 md:space-y-6 mt-4 md:mt-6">
            <ReportHistory />
          </TabsContent>
        </Tabs>

        {/* Quick Actions Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
          {/* Incident Reports Card */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-200">
            <CardHeader className="pb-3 space-y-1">
              <CardTitle className="text-base md:text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span>Incident Reports</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                Generate detailed incident reports with status, severity, and location data.
              </p>
              <ul className="text-xs md:text-sm text-gray-500 dark:text-gray-500 space-y-1">
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">•</span>
                  <span>Status distribution</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">•</span>
                  <span>Severity analysis</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">•</span>
                  <span>Location mapping</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">•</span>
                  <span>Timeline tracking</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Volunteer Performance Card */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-200">
            <CardHeader className="pb-3 space-y-1">
              <CardTitle className="text-base md:text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Download className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span>Volunteer Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                Analyze volunteer performance metrics and response times.
              </p>
              <ul className="text-xs md:text-sm text-gray-500 dark:text-gray-500 space-y-1">
                <li className="flex items-start gap-1">
                  <span className="text-green-600 dark:text-green-400 flex-shrink-0">•</span>
                  <span>Response times</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 dark:text-green-400 flex-shrink-0">•</span>
                  <span>Completion rates</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 dark:text-green-400 flex-shrink-0">•</span>
                  <span>Skill analysis</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-green-600 dark:text-green-400 flex-shrink-0">•</span>
                  <span>Performance trends</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Analytics Dashboard Card */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-200 sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-3 space-y-1">
              <CardTitle className="text-base md:text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <span>Analytics Dashboard</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                Comprehensive analytics with trends and insights.
              </p>
              <ul className="text-xs md:text-sm text-gray-500 dark:text-gray-500 space-y-1">
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 dark:text-purple-400 flex-shrink-0">•</span>
                  <span>Trend analysis</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 dark:text-purple-400 flex-shrink-0">•</span>
                  <span>Distribution charts</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 dark:text-purple-400 flex-shrink-0">•</span>
                  <span>Performance metrics</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-purple-600 dark:text-purple-400 flex-shrink-0">•</span>
                  <span>Predictive insights</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}