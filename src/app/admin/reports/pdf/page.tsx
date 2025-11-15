"use client"

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { PDFReportGenerator } from '@/components/admin/pdf-report-generator'
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
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PDF Report Generation</h1>
            <p className="text-gray-600">Generate comprehensive PDF reports for incidents, volunteers, and analytics</p>
          </div>
        </div>

        <Tabs defaultValue="generator" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="generator" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Report Generator
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Reports
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Report History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="space-y-6">
            <PDFReportGenerator />
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Scheduled Reports
                </CardTitle>
                <CardDescription>
                  Set up automatic report generation and email distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Scheduled Reports Coming Soon</h3>
                  <p className="text-gray-600">
                    This feature will allow you to set up automatic report generation and email distribution.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Report History
                </CardTitle>
                <CardDescription>
                  View and manage previously generated reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Report History Coming Soon</h3>
                  <p className="text-gray-600">
                    This feature will show you a history of all generated reports with download links.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Incident Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Generate detailed incident reports with status, severity, and location data.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Status distribution</li>
                <li>• Severity analysis</li>
                <li>• Location mapping</li>
                <li>• Timeline tracking</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5 text-green-600" />
                Volunteer Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Analyze volunteer performance metrics and response times.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Response times</li>
                <li>• Completion rates</li>
                <li>• Skill analysis</li>
                <li>• Performance trends</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Analytics Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Comprehensive analytics with trends and insights.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Trend analysis</li>
                <li>• Distribution charts</li>
                <li>• Performance metrics</li>
                <li>• Predictive insights</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
