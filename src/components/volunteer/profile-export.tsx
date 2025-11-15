"use client"

import React, { useState } from "react"
import { Download, FileText, Table } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useToast } from "@/components/ui/use-toast"
import { UserWithVolunteerProfile } from "@/types/volunteer"

interface ProfileExportProps {
  profile: UserWithVolunteerProfile
}

export const ProfileExport: React.FC<ProfileExportProps> = ({ profile }) => {
  const { toast } = useToast()
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)

  const exportToCSV = () => {
    try {
      setExporting('csv')

      const csvData = [
        ['Field', 'Value'],
        ['Full Name', `${profile.first_name} ${profile.last_name}`],
        ['Email', profile.email],
        ['Phone Number', profile.phone_number || 'N/A'],
        ['Address', profile.address || 'N/A'],
        ['Barangay', profile.barangay || 'N/A'],
        ['Gender', profile.gender || 'N/A'],
        ['Emergency Contact Name', profile.emergency_contact_name || 'N/A'],
        ['Emergency Contact Phone', profile.emergency_contact_phone || 'N/A'],
        ['Emergency Contact Relationship', profile.emergency_contact_relationship || 'N/A'],
        ['Status', profile.volunteer_profiles?.status || 'N/A'],
        ['Available for Assignments', profile.volunteer_profiles?.is_available ? 'Yes' : 'No'],
        ['Skills', profile.volunteer_profiles?.skills?.join(', ') || 'N/A'],
        ['Availability Days', profile.volunteer_profiles?.availability?.join(', ') || 'N/A'],
        ['Total Incidents Resolved', profile.volunteer_profiles?.total_incidents_resolved?.toString() || '0'],
        ['Assigned Barangays', profile.volunteer_profiles?.assigned_barangays?.join(', ') || 'N/A'],
        ['Notes', profile.volunteer_profiles?.notes || 'N/A'],
      ]

      const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `volunteer_profile_${profile.first_name}_${profile.last_name}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export successful",
        description: "Your profile has been exported to CSV",
        variant: "default",
      })
    } catch (error) {
      console.error('CSV export error:', error)
      toast({
        title: "Export failed",
        description: "Failed to export profile to CSV",
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }

  const exportToPDF = () => {
    try {
      setExporting('pdf')

      // Create a simple HTML document for printing/PDF
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('Please allow popups to export PDF')
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Volunteer Profile - ${profile.first_name} ${profile.last_name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              color: #333;
            }
            h1 {
              color: #dc2626;
              border-bottom: 3px solid #dc2626;
              padding-bottom: 10px;
              margin-bottom: 30px;
            }
            h2 {
              color: #374151;
              margin-top: 30px;
              margin-bottom: 15px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 8px;
            }
            .field {
              display: flex;
              margin-bottom: 12px;
              padding: 8px;
              border-radius: 4px;
            }
            .field:nth-child(even) {
              background-color: #f9fafb;
            }
            .label {
              font-weight: 600;
              width: 220px;
              color: #4b5563;
            }
            .value {
              flex: 1;
              color: #1f2937;
            }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 500;
            }
            .badge-active {
              background-color: #dcfce7;
              color: #166534;
            }
            .badge-inactive {
              background-color: #f3f4f6;
              color: #4b5563;
            }
            .skills-list, .availability-list {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 8px;
            }
            .skill-tag, .day-tag {
              padding: 4px 12px;
              background-color: #dbeafe;
              color: #1e40af;
              border-radius: 12px;
              font-size: 13px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body {
                margin: 0;
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <h1>🚨 Volunteer Profile</h1>
          
          <h2>Personal Information</h2>
          <div class="field">
            <div class="label">Full Name:</div>
            <div class="value">${profile.first_name} ${profile.last_name}</div>
          </div>
          <div class="field">
            <div class="label">Email:</div>
            <div class="value">${profile.email}</div>
          </div>
          <div class="field">
            <div class="label">Phone Number:</div>
            <div class="value">${profile.phone_number || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="label">Gender:</div>
            <div class="value">${profile.gender ? profile.gender.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}</div>
          </div>
          <div class="field">
            <div class="label">Address:</div>
            <div class="value">${profile.address || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="label">Barangay:</div>
            <div class="value">${profile.barangay || 'N/A'}</div>
          </div>

          <h2>Emergency Contact</h2>
          <div class="field">
            <div class="label">Contact Name:</div>
            <div class="value">${profile.emergency_contact_name || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="label">Contact Phone:</div>
            <div class="value">${profile.emergency_contact_phone || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="label">Relationship:</div>
            <div class="value">${profile.emergency_contact_relationship || 'N/A'}</div>
          </div>

          <h2>Volunteer Status</h2>
          <div class="field">
            <div class="label">Status:</div>
            <div class="value">
              <span class="badge ${profile.volunteer_profiles?.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">
                ${profile.volunteer_profiles?.status || 'INACTIVE'}
              </span>
            </div>
          </div>
          <div class="field">
            <div class="label">Available for Assignments:</div>
            <div class="value">${profile.volunteer_profiles?.is_available ? 'Yes' : 'No'}</div>
          </div>
          <div class="field">
            <div class="label">Total Incidents Resolved:</div>
            <div class="value">${profile.volunteer_profiles?.total_incidents_resolved || 0}</div>
          </div>

          <h2>Skills & Certifications</h2>
          <div class="skills-list">
            ${profile.volunteer_profiles?.skills?.length 
              ? profile.volunteer_profiles.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')
              : '<span>No skills listed</span>'
            }
          </div>

          <h2>Availability</h2>
          <div class="availability-list">
            ${profile.volunteer_profiles?.availability?.length
              ? profile.volunteer_profiles.availability.map(day => `<span class="day-tag">${day}</span>`).join('')
              : '<span>No availability set</span>'
            }
          </div>

          ${profile.volunteer_profiles?.assigned_barangays?.length ? `
            <h2>Assigned Barangays</h2>
            <div class="value">${profile.volunteer_profiles.assigned_barangays.join(', ')}</div>
          ` : ''}

          ${profile.volunteer_profiles?.notes ? `
            <h2>Notes</h2>
            <div class="value">${profile.volunteer_profiles.notes}</div>
          ` : ''}

          <div class="footer">
            Generated on ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })} | RVOIS - Resident Volunteer Operations & Information System
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `

      printWindow.document.write(htmlContent)
      printWindow.document.close()

      toast({
        title: "Export successful",
        description: "Opening print dialog for PDF export",
        variant: "default",
      })
    } catch (error: any) {
      console.error('PDF export error:', error)
      toast({
        title: "Export failed",
        description: error.message || "Failed to export profile to PDF",
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={exportToPDF}
        disabled={exporting !== null}
        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {exporting === 'pdf' ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Exporting...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </>
        )}
      </button>

      <button
        type="button"
        onClick={exportToCSV}
        disabled={exporting !== null}
        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {exporting === 'csv' ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Exporting...
          </>
        ) : (
          <>
            <Table className="w-4 h-4 mr-2" />
            Export CSV
          </>
        )}
      </button>
    </div>
  )
}
