"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Filter, MapPin, FileText, Download, BarChart3 } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { getAllIncidents } from "@/lib/incidents"
import { getAllVolunteers } from "@/lib/volunteers"
import { getAllSchedules } from "@/src/lib/schedules"
import { getIncidentsByBarangay, getIncidentsByStatus, getIncidentsByType, exportIncidentsToCSV } from "@/lib/reports"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PDFReportGenerator } from "@/components/admin/pdf-report-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminReports() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportType, setReportType] = useState<"incidents" | "volunteers" | "schedules">("incidents")
  const [dateRange, setDateRange] = useState<"week" | "month" | "year">("month")
  const [incidents, setIncidents] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [incidentsByBarangay, setIncidentsByBarangay] = useState<any[]>([])
  const [incidentsByType, setIncidentsByType] = useState<any[]>([])
  const [incidentsByStatus, setIncidentsByStatus] = useState<any[]>([])
  const [generatingReport, setGeneratingReport] = useState(false)
  const [submittingMonthly, setSubmittingMonthly] = useState(false)

  // Convert date range to actual dates for the reports API
  const getDateRangeParams = () => {
    const endDate = new Date().toISOString();
    const startDate = new Date();
    
    if (dateRange === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (dateRange === "year") {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const { startDate, endDate } = getDateRangeParams();

        // Fetch data based on report type
        if (reportType === "incidents") {
          // Fetch base incident data
          const result = await getAllIncidents()
          if (result.success) {
            setIncidents(result.data || [])
          } else {
            setError(result.message || "Failed to fetch incidents")
          }
          
          // Fetch specialized incident reports
          const barangayResult = await getIncidentsByBarangay(startDate, endDate);
          if (barangayResult.success) {
            setIncidentsByBarangay(barangayResult.data || []);
          }
          
          const typeResult = await getIncidentsByType(startDate, endDate);
          if (typeResult.success) {
            setIncidentsByType(typeResult.data || []);
          }
          
          const statusResult = await getIncidentsByStatus(startDate, endDate);
          if (statusResult.success) {
            setIncidentsByStatus(statusResult.data || []);
          }
        } else if (reportType === "volunteers") {
          const result = await getAllVolunteers()
          if (result.success) {
            setVolunteers(result.data || [])
          } else {
            setError(result.message || "Failed to fetch volunteers")
          }
        } else if (reportType === "schedules") {
          const result = await getAllSchedules()
          if (result.success) {
            setSchedules(result.data || [])
          } else {
            setError(result.message || "Failed to fetch schedules")
          }
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [reportType, dateRange])

  const filterDataByDateRange = (data: any[]) => {
    const now = new Date()
    const startDate = new Date()
    
    if (dateRange === "week") {
      startDate.setDate(now.getDate() - 7)
    } else if (dateRange === "month") {
      startDate.setMonth(now.getMonth() - 1)
    } else if (dateRange === "year") {
      startDate.setFullYear(now.getFullYear() - 1)
    }
    
    return data.filter(item => {
      const createdAt = new Date(item.created_at)
      return createdAt >= startDate && createdAt <= now
    })
  }

  const generateMonthlyIncidentsReport = async () => {
    if (!user?.id) return
    setSubmittingMonthly(true)
    try {
      const now = new Date()
      const title = `Monthly Incidents Report - ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`
      const body = {
        title,
        report_type: 'INCIDENT_REPORT',
        description: `Auto-generated monthly incidents summary for ${now.toISOString().slice(0,7)}`,
        created_by: user.id
      }
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to generate report')
    } catch (e) {
      console.error(e)
    } finally {
      setSubmittingMonthly(false)
    }
  }

  const generateReport = async () => {
    setGeneratingReport(true)
    
    try {
      // Generate a CSV report for incidents
      if (reportType === "incidents") {
        const { startDate, endDate } = getDateRangeParams();
        const result = await exportIncidentsToCSV(startDate, endDate);
        
        if (result.success && result.data) {
          // Create CSV content
          const headers = Object.keys(result.data[0]).join(',');
          const rows = result.data.map(item => Object.values(item).join(','));
          const csvContent = [headers, ...rows].join('\n');
          
          // Create download link
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `incidents-report-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err) {
      console.error("Error generating report:", err);
    } finally {
      setGeneratingReport(false)
    }
  }

  const getReportData = () => {
    if (reportType === "incidents") {
      // Use the specialized analytics data if available
      const byStatus = incidentsByStatus.length > 0 
        ? incidentsByStatus.map(item => [item.status, parseInt(item.count)])
        : [];
        
      const byType = incidentsByType.length > 0
        ? incidentsByType.map(item => [item.incident_type, parseInt(item.count)])
        : [];
        
      const byBarangay = incidentsByBarangay.length > 0
        ? incidentsByBarangay.map(item => [item.barangay, parseInt(item.count)])
        : [];

      // Calculate total from the status counts
      const total = byStatus.reduce((sum, [_, count]) => sum + (count as number), 0);

      return {
        total: total || filterDataByDateRange(incidents).length,
        byType,
        byStatus,
        byBarangay
      }
    } else if (reportType === "volunteers") {
      const filteredVolunteers = filterDataByDateRange(volunteers)
      
      // Count volunteers by status
      const volunteersByStatus = filteredVolunteers.reduce((acc: Record<string, number>, volunteer) => {
        const status = volunteer.volunteer_profiles?.status || "UNKNOWN"
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      return {
        total: filteredVolunteers.length,
        byStatus: Object.entries(volunteersByStatus)
      }
    } else {
      const filteredSchedules = filterDataByDateRange(schedules)
      return {
        total: filteredSchedules.length
      }
    }
  }

  const reportData = !loading ? getReportData() : null

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Reports</h1>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics Dashboard
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PDF Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
              <div className="mt-4 md:mt-0">
                <button
                  onClick={generateReport}
                  disabled={loading || generatingReport}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {generatingReport ? (
                    <LoadingSpinner size="sm" color="text-white" />
                  ) : (
                    <>
                      Export Report
                    </>
                  )}
                </button>
                <button
                  onClick={generateMonthlyIncidentsReport}
                  disabled={loading || submittingMonthly}
                  className="inline-flex items-center ml-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  {submittingMonthly ? (
                    <LoadingSpinner size="sm" color="text-white" />
                  ) : (
                    <>Generate Monthly Incidents Report</>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 mb-6">
                <div>
                  <label htmlFor="report-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Report Type
                  </label>
                  <select
                    id="report-type"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as any)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    disabled={loading}
                  >
                    <option value="incidents">Incidents Report</option>
                    <option value="volunteers">Volunteers Report</option>
                    <option value="schedules">Schedules Report</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 mb-1">
                    Date Range
                  </label>
                  <select
                    id="date-range"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    disabled={loading}
                  >
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>

                <div className="md:self-end">
                  <button
                    onClick={() => {
                      // Refresh report data
                      setLoading(true)
                      setTimeout(() => setLoading(false), 500)
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Apply Filters
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading report data..." />
                </div>
              ) : error ? (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="flex items-center">
                      <h2 className="text-lg font-medium text-blue-800">
                        {reportType === "incidents"
                          ? "Incidents Report"
                          : reportType === "volunteers"
                          ? "Volunteers Report"
                          : "Schedules Report"}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-blue-700">
                      Showing data for the last {dateRange === "week" ? "7 days" : dateRange === "month" ? "30 days" : "year"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border rounded-lg shadow p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Total {reportType}</h3>
                      <p className="text-3xl font-bold text-blue-600">{reportData?.total || 0}</p>
                    </div>

                    {reportType === "incidents" && (
                      <>
                        <div className="bg-white border rounded-lg shadow p-4">
                          <h3 className="text-lg font-medium text-gray-900 mb-2">By Status</h3>
                          <div className="space-y-2">
                            {reportData?.byStatus?.map(([status, count]) => (
                              <div key={status} className="flex justify-between items-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                  status === "ASSIGNED" ? "bg-blue-100 text-blue-800" :
                                  status === "RESPONDING" ? "bg-orange-100 text-orange-800" :
                                  status === "RESOLVED" ? "bg-green-100 text-green-800" :
                                  "bg-gray-100 text-gray-800"
                                }`}>
                                  {status}
                                </span>
                                <span className="text-sm font-bold">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white border rounded-lg shadow p-4">
                          <h3 className="text-lg font-medium text-gray-900 mb-2">By Type</h3>
                          <div className="space-y-2">
                            {reportData?.byType?.map(([type, count]) => (
                              <div key={type} className="flex justify-between items-center">
                                <span className="text-sm font-medium">
                                  {type}
                                </span>
                                <span className="text-sm font-bold">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {reportType === "volunteers" && (
                      <div className="bg-white border rounded-lg shadow p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">By Status</h3>
                        <div className="space-y-2">
                          {reportData?.byStatus?.map(([status, count]) => (
                            <div key={status} className="flex justify-between items-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                status === "ACTIVE" ? "bg-green-100 text-green-800" :
                                status === "INACTIVE" ? "bg-gray-100 text-gray-800" :
                                status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {status}
                              </span>
                              <span className="text-sm font-bold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {reportType === "incidents" && reportData?.byBarangay && reportData.byBarangay.length > 0 && (
                    <div className="bg-white border rounded-lg shadow p-4 mt-4">
                      <div className="flex items-center mb-2">
                        <MapPin className="h-5 w-5 text-blue-500 mr-2" />
                        <h3 className="text-lg font-medium text-gray-900">Incidents by Barangay</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {reportData.byBarangay.map(([barangay, count]) => (
                          <div key={barangay} className="flex justify-between bg-gray-50 p-3 rounded-md">
                            <span className="text-sm font-medium">{barangay || "Unknown"}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {reportType === "incidents"
                        ? "Recent Incidents"
                        : reportType === "volunteers"
                        ? "Recent Volunteers"
                        : "Recent Schedules"}
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {reportType === "incidents" && (
                              <>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                              </>
                            )}
                            
                            {reportType === "volunteers" && (
                              <>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                              </>
                            )}
                            
                            {reportType === "schedules" && (
                              <>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volunteers</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportType === "incidents" && 
                            filterDataByDateRange(incidents).slice(0, 5).map((incident) => (
                              <tr key={incident.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{incident.incident_type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(incident.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    incident.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                    incident.status === "ASSIGNED" ? "bg-blue-100 text-blue-800" :
                                    incident.status === "RESPONDING" ? "bg-orange-100 text-orange-800" :
                                    incident.status === "RESOLVED" ? "bg-green-100 text-green-800" :
                                    "bg-gray-100 text-gray-800"
                                  }`}>
                                    {incident.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{incident.location_address}</td>
                              </tr>
                            ))
                          }
                          
                          {reportType === "volunteers" && 
                            filterDataByDateRange(volunteers).slice(0, 5).map((volunteer) => (
                            <tr key={volunteer.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {volunteer.first_name} {volunteer.last_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{volunteer.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  volunteer.volunteer_profiles?.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                                  volunteer.volunteer_profiles?.status === "INACTIVE" ? "bg-gray-100 text-gray-800" :
                                  volunteer.volunteer_profiles?.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-gray-100 text-gray-800"
                                }`}>
                                  {volunteer.volunteer_profiles?.status || "UNKNOWN"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(volunteer.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                          }
                          
                          {reportType === "schedules" && 
                            filterDataByDateRange(schedules).slice(0, 5).map((schedule) => (
                              <tr key={schedule.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{schedule.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(schedule.start_time).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(schedule.end_time).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {(schedule.volunteers?.length || 0)}
                                </td>
                              </tr>
                            ))
                          }
                          
                          {(
                            (reportType === "incidents" && filterDataByDateRange(incidents).length === 0) ||
                            (reportType === "volunteers" && filterDataByDateRange(volunteers).length === 0) ||
                            (reportType === "schedules" && filterDataByDateRange(schedules).length === 0)
                          ) && (
                            <tr>
                              <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                No data available for the selected date range
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-6">
            <PDFReportGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
