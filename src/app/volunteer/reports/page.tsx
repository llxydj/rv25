"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { VolunteerLayout } from "@/components/layout/volunteer-layout"
import { useAuth } from "@/lib/auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { 
  AlertTriangle, 
  Calendar, 
  ClipboardList, 
  Download, 
  FileText, 
  Filter, 
  Plus, 
  Search 
} from "lucide-react"
import { getVolunteerReports, getVolunteerActiveIncidents, createReport } from "@/lib/reports"

interface Report {
  id: string
  title: string
  report_type: string
  incident_id: string | null
  description: string
  created_at: string
  created_by: string
  status: string
  incident?: {
    incident_type: string
    barangay: string
  }
}

export default function VolunteerReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [filteredReports, setFilteredReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [showNewReportForm, setShowNewReportForm] = useState(false)
  
  // New report form state
  const [newReportTitle, setNewReportTitle] = useState("")
  const [newReportType, setNewReportType] = useState("INCIDENT_REPORT")
  const [newReportDescription, setNewReportDescription] = useState("")
  const [newReportIncidentId, setNewReportIncidentId] = useState<string | null>(null)
  const [incidents, setIncidents] = useState<any[]>([])
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  useEffect(() => {
    const fetchReports = async () => {
      if (!user) return

      try {
        setLoading(true)
        
        // Fetch volunteer reports using the new function
        const reportsResult = await getVolunteerReports(user.id)
        if (!reportsResult.success) {
          throw new Error(reportsResult.message || "Failed to fetch reports")
        }
        
        setReports(reportsResult.data || [])
        setFilteredReports(reportsResult.data || [])
        
        // Fetch incidents for the new report form
        const incidentsResult = await getVolunteerActiveIncidents(user.id)
        if (!incidentsResult.success) {
          throw new Error(incidentsResult.message || "Failed to fetch incidents")
        }
        
        setIncidents(incidentsResult.data || [])

      } catch (err: any) {
        console.error("Error in fetchReports:", err)
        setError(err.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [user])

  // Apply filters and search
  useEffect(() => {
    let filtered = reports

    // Apply type filter
    if (typeFilter !== "ALL") {
      filtered = filtered.filter(report => report.report_type === typeFilter)
    }

    // Apply search
    if (searchTerm.trim() !== "") {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(report => 
        report.title.toLowerCase().includes(search) || 
        report.description.toLowerCase().includes(search) ||
        (report.incident?.barangay && report.incident.barangay.toLowerCase().includes(search))
      )
    }

    setFilteredReports(filtered)
  }, [reports, typeFilter, searchTerm])

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    try {
      setFormLoading(true)
      setFormError(null)
      setFormSuccess(false)
      
      // Validation
      if (!newReportTitle.trim()) {
        throw new Error("Please enter a report title")
      }
      
      if (!newReportDescription.trim()) {
        throw new Error("Please enter a report description")
      }
      
      // Create report using the new function
      const result = await createReport(
        newReportTitle,
        newReportType,
        newReportDescription,
        user.id,
        newReportIncidentId
      )
      
      if (!result.success) {
        throw new Error(result.message || "Failed to create report")
      }
      
      // Reset form
      setNewReportTitle("")
      setNewReportType("INCIDENT_REPORT")
      setNewReportDescription("")
      setNewReportIncidentId(null)
      setFormSuccess(true)
      
      // Add new report to list
      setReports(prev => [result.data, ...prev])
      
      // Hide form after 2 seconds
      setTimeout(() => {
        setShowNewReportForm(false)
        setFormSuccess(false)
      }, 2000)
      
    } catch (err: any) {
      console.error("Error in handleSubmitReport:", err)
      setFormError(err.message || "Failed to submit report")
    } finally {
      setFormLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    })
  }

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Submitted
          </span>
        )
      case "REVIEWED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Reviewed
          </span>
        )
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case "INCIDENT_REPORT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Incident Report
          </span>
        )
      case "ACTIVITY_REPORT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Activity Report
          </span>
        )
      case "SITUATION_REPORT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            Situation Report
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {type}
          </span>
        )
    }
  }

  return (
    <VolunteerLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Your Reports</h1>
            <p className="text-gray-600 mt-1">Manage and submit reports about incidents and activities</p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => setShowNewReportForm(!showNewReportForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showNewReportForm ? "Cancel" : "Create Report"}
            </button>
          </div>
        </div>

        {showNewReportForm && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Create New Report</h2>
            
            {formSuccess && (
              <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ClipboardList className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">Report submitted successfully!</p>
                  </div>
                </div>
              </div>
            )}
            
            {formError && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{formError}</p>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label htmlFor="report-title" className="block text-sm font-medium text-gray-700">
                  Report Title
                </label>
                <input
                  type="text"
                  id="report-title"
                  value={newReportTitle}
                  onChange={(e) => setNewReportTitle(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                  placeholder="Enter report title"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="report-type" className="block text-sm font-medium text-gray-700">
                  Report Type
                </label>
                <select
                  id="report-type"
                  value={newReportType}
                  onChange={(e) => setNewReportType(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                >
                  <option value="INCIDENT_REPORT">Incident Report</option>
                  <option value="ACTIVITY_REPORT">Activity Report</option>
                  <option value="SITUATION_REPORT">Situation Report</option>
                </select>
              </div>
              
              {incidents.length > 0 && (
                <div>
                  <label htmlFor="incident-id" className="block text-sm font-medium text-gray-700">
                    Related Incident (Optional)
                  </label>
                  <select
                    id="incident-id"
                    value={newReportIncidentId || ""}
                    onChange={(e) => setNewReportIncidentId(e.target.value || null)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                  >
                    <option value="">None</option>
                    {incidents.map((incident) => (
                      <option key={incident.id} value={incident.id}>
                        {incident.incident_type} in {incident.barangay}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label htmlFor="report-description" className="block text-sm font-medium text-gray-700">
                  Report Details
                </label>
                <textarea
                  id="report-description"
                  value={newReportDescription}
                  onChange={(e) => setNewReportDescription(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                  placeholder="Provide details of the report..."
                  required
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewReportForm(false)}
                  className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {formLoading ? (
                    <LoadingSpinner size="sm" color="text-white" />
                  ) : (
                    <>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Submit Report
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex flex-col md:flex-row mb-6 gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-64">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  className="pl-10 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-black"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="ALL">All Report Types</option>
                  <option value="INCIDENT_REPORT">Incident Reports</option>
                  <option value="ACTIVITY_REPORT">Activity Reports</option>
                  <option value="SITUATION_REPORT">Situation Reports</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text="Loading reports..." />
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900">No reports found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || typeFilter !== "ALL"
                  ? "Try adjusting your search or filter"
                  : "You haven't submitted any reports yet"}
              </p>
              {!showNewReportForm && (
                <button
                  onClick={() => setShowNewReportForm(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Report
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Report
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Submitted
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{report.title}</div>
                        <div className="text-xs text-gray-500">
                          {report.incident ? (
                            <>Related to: {report.incident.incident_type} in {report.incident.barangay}</>
                          ) : (
                            "No related incident"
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getReportTypeBadge(report.report_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="mr-1 h-4 w-4" />
                          {formatDate(report.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getReportStatusBadge(report.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/volunteer/report/${report.id}`}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          View
                        </Link>
                        <button
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </VolunteerLayout>
  )
} 