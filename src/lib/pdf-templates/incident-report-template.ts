/**
 * Enhanced Incident Report PDF Template
 * Professional HTML template with detailed classifications, full descriptions,
 * and Philippine DPA 2012 compliance
 */

export interface IncidentReportData {
  total: number
  startDate: string
  endDate: string
  statusCounts: Record<string, number>
  severityCounts: Record<string, number>
  typeCounts?: Record<string, number>
  barangayCounts?: Record<string, number>
  categoryCounts?: Record<string, number>
  severityLevelCounts?: Record<string, number>
  incidents: Array<{
    id: string
    type: string
    status: string
    severity: number
    priority?: number
    incident_category?: string
    trauma_subcategory?: string
    severity_level?: string
    location: string
    address?: string
    barangay: string
    city?: string
    province?: string
    created_at: string
    updated_at?: string
    assigned_at?: string
    resolved_at?: string
    reporter?: string
    reporterPhone?: string
    reporterEmail?: string
    description?: string
    fullDescription?: string
    assignedTo?: string
    assignedToPhone?: string
    resolutionNotes?: string
    photoCount?: number
    responseTimeMinutes?: number
    resolutionTimeMinutes?: number
    emergencyCategory?: string
    classification?: string
  }>
  reportClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'
  generatedBy?: string
}

// Helper function to classify emergency type
function classifyEmergencyType(incidentType: string): string {
  const type = (incidentType || '').toLowerCase()
  
  if (type.includes('medical') || type.includes('health') || type.includes('injury') || 
      type.includes('cardiac') || type.includes('respiratory') || type.includes('trauma')) {
    return 'Medical Emergency'
  }
  if (type.includes('fire') || type.includes('burn')) {
    return 'Fire Emergency'
  }
  if (type.includes('flood') || type.includes('earthquake') || type.includes('typhoon') || 
      type.includes('disaster') || type.includes('natural')) {
    return 'Disaster Response'
  }
  if (type.includes('rescue') || type.includes('water') || type.includes('extrication') || 
      type.includes('search')) {
    return 'Rescue Operations'
  }
  if (type.includes('traffic') || type.includes('accident') || type.includes('vehicle') || 
      type.includes('security') || type.includes('disturbance')) {
    return 'Public Safety'
  }
  return 'Other/Miscellaneous'
}

// Helper function to get severity label
function getSeverityLabel(severity: number): string {
  const labels: Record<number, string> = {
    1: 'Critical - Life-threatening, immediate response required',
    2: 'Urgent - Serious but stable, prompt response needed',
    3: 'Standard - Non-critical, routine response',
    4: 'Low Priority - Minor incidents, scheduled response acceptable'
  }
  return labels[severity] || `Level ${severity}`
}

export function generateIncidentReportHTML(data: IncidentReportData, logoBase64?: string): string {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila'
    })
  }

  const formatTime = (minutes?: number) => {
    if (!minutes || minutes < 0) return 'N/A'
    if (minutes < 60) return `${Math.round(minutes)} min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const statusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': '#f59e0b',
      'ASSIGNED': '#3b82f6',
      'RESPONDING': '#3b82f6',
      'RESOLVED': '#10b981',
      'CANCELLED': '#ef4444',
      'pending': '#f59e0b',
      'in_progress': '#3b82f6',
      'resolved': '#10b981',
      'closed': '#6b7280',
      'cancelled': '#ef4444'
    }
    return colors[status.toUpperCase()] || '#6b7280'
  }

  const severityColor = (severity: number) => {
    const colors: Record<number, string> = {
      1: '#dc2626', // Critical - Red
      2: '#f97316', // Urgent - Orange
      3: '#3b82f6', // Standard - Blue
      4: '#6b7280'  // Low - Gray
    }
    return colors[severity] || '#6b7280'
  }

  const classification = data.reportClassification || 'INTERNAL'
  const classificationColor = classification === 'CONFIDENTIAL' ? '#dc2626' : 
                             classification === 'INTERNAL' ? '#f59e0b' : '#10b981'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RVOIS Incident Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      background: #ffffff;
    }
    
    .privacy-notice {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 20px;
      margin-bottom: 30px;
      border-radius: 8px;
      font-size: 11px;
      line-height: 1.8;
    }
    
    .privacy-notice h3 {
      color: #92400e;
      font-size: 13px;
      margin-bottom: 10px;
      font-weight: 700;
    }
    
    .privacy-notice p {
      color: #78350f;
      margin: 5px 0;
    }
    
    .classification-banner {
      background: ${classificationColor};
      color: white;
      padding: 12px 20px;
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 1px;
      margin-bottom: 20px;
    }
    
    .header {
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    
    .header .subtitle {
      font-size: 16px;
      opacity: 0.95;
      margin-bottom: 8px;
    }
    
    .header .meta {
      font-size: 14px;
      opacity: 0.85;
      margin-top: 15px;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .summary-section {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      border-left: 5px solid #dc2626;
      padding: 30px;
      margin-bottom: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .summary-section h2 {
      color: #dc2626;
      font-size: 24px;
      margin-bottom: 20px;
      font-weight: 600;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      border-top: 3px solid #dc2626;
    }
    
    .summary-card-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    
    .summary-card-value {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    
    .stat-box {
      background: white;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .stat-box-title {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 15px;
      font-weight: 600;
    }
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .stat-item:last-child {
      border-bottom: none;
    }
    
    .stat-label {
      color: #4b5563;
      font-size: 13px;
    }
    
    .stat-value {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
    }
    
    .section-title {
      font-size: 22px;
      font-weight: 600;
      color: #111827;
      margin: 40px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .incident-detail-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 25px;
      margin-bottom: 25px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      page-break-inside: avoid;
    }
    
    .incident-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .incident-id {
      font-family: monospace;
      font-size: 14px;
      color: #6b7280;
      font-weight: 600;
    }
    
    .incident-type {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin: 10px 0 5px 0;
    }
    
    .incident-category {
      display: inline-block;
      background: #eff6ff;
      color: #1e40af;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 5px;
    }
    
    .incident-badges {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-assigned { background: #dbeafe; color: #1e40af; }
    .badge-responding { background: #dbeafe; color: #1e40af; }
    .badge-resolved { background: #d1fae5; color: #065f46; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    
    .severity-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }
    
    .incident-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    
    .detail-item {
      margin-bottom: 15px;
    }
    
    .detail-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
      font-weight: 600;
    }
    
    .detail-value {
      font-size: 14px;
      color: #111827;
      line-height: 1.6;
    }
    
    .description-box {
      background: #f9fafb;
      border-left: 4px solid #dc2626;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    
    .description-box .detail-label {
      margin-bottom: 10px;
    }
    
    .description-text {
      font-size: 13px;
      color: #374151;
      line-height: 1.8;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .timeline {
      margin: 20px 0;
      padding-left: 20px;
      border-left: 2px solid #e5e7eb;
    }
    
    .timeline-item {
      margin-bottom: 15px;
      position: relative;
    }
    
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -26px;
      top: 5px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #dc2626;
      border: 2px solid white;
      box-shadow: 0 0 0 2px #dc2626;
    }
    
    .timeline-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 3px;
    }
    
    .timeline-value {
      font-size: 13px;
      color: #111827;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      background: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    
    thead {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
    }
    
    th {
      padding: 14px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 13px;
      color: #4b5563;
    }
    
    tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    
    tbody tr:hover {
      background: #f3f4f6;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    
    .footer p {
      margin: 5px 0;
    }
    
    @media print {
      .header { page-break-after: avoid; }
      .summary-section { page-break-after: avoid; }
      .incident-detail-card { page-break-inside: avoid; }
      .privacy-notice { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="classification-banner">
    REPORT CLASSIFICATION: ${classification} USE ONLY
  </div>
  
  <div class="privacy-notice">
    <h3>DATA PRIVACY NOTICE</h3>
    <p><strong>This report contains personal and sensitive information protected under Republic Act No. 10173 (Data Privacy Act of 2012).</strong></p>
    <p><strong>CLASSIFICATION:</strong> ${classification} | <strong>ACCESS LEVEL:</strong> Authorized Personnel Only</p>
    <p><strong>COLLECTED DATA INCLUDES:</strong> Personal Information (Names, Contact Info), Location Data, Medical Information (when applicable), Response Activity Logs</p>
    <p><strong>PURPOSE OF COLLECTION:</strong> Emergency response coordination, statistical analysis, and operational improvement.</p>
    <p><strong>UNAUTHORIZED DISCLOSURE PROHIBITED</strong> - Violations subject to penalties under RA 10173</p>
  </div>
  
  <div class="header">
    <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 15px;">
      ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Radiant Logo" style="height: 60px; width: auto; background: white; padding: 8px; border-radius: 8px; object-fit: contain;" />` : ''}
      <div style="text-align: ${logoBase64 ? 'left' : 'center'}; flex: 1;">
        <h1 style="margin: 0; font-size: 28px;">INCIDENT RESPONSE REPORT</h1>
        <div class="subtitle" style="font-size: 14px; margin-top: 5px;">RVOIS - Rescue Volunteers Operations Information System</div>
      </div>
    </div>
    <div class="meta">
      <div>Report ID: RPT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}</div>
      <div>Generated: ${new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      })}</div>
      <div>Period Covered: ${formatDate(data.startDate)} to ${formatDate(data.endDate)}</div>
      ${data.generatedBy ? `<div>Prepared By: ${data.generatedBy}</div>` : ''}
    </div>
  </div>
  
  <div class="content">
    <div class="summary-section">
      <h2>EXECUTIVE SUMMARY</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-card-label">Total Incidents</div>
          <div class="summary-card-value">${data.total}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Report Period</div>
          <div class="summary-card-value" style="font-size: 18px;">${formatDate(data.startDate)}<br>to ${formatDate(data.endDate)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Date Range</div>
          <div class="summary-card-value" style="font-size: 16px;">${Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24))} days</div>
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-box-title">Status Distribution</div>
          ${Object.entries(data.statusCounts).map(([status, count]) => `
            <div class="stat-item">
              <span class="stat-label">${status}</span>
              <span class="stat-value">${count}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="stat-box">
          <div class="stat-box-title">Severity Distribution</div>
          ${Object.entries(data.severityCounts).map(([severity, count]) => `
            <div class="stat-item">
              <span class="stat-label">${getSeverityLabel(parseInt(severity))}</span>
              <span class="stat-value">${count}</span>
            </div>
          `).join('')}
        </div>
        
        ${data.typeCounts && Object.keys(data.typeCounts).length > 0 ? `
        <div class="stat-box">
          <div class="stat-box-title">Incident Type Distribution</div>
          ${Object.entries(data.typeCounts).slice(0, 10).map(([type, count]) => `
            <div class="stat-item">
              <span class="stat-label">${type}</span>
              <span class="stat-value">${count}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        ${data.categoryCounts && Object.keys(data.categoryCounts).length > 0 ? `
        <div class="stat-box">
          <div class="stat-box-title">Incident Category Distribution</div>
          ${Object.entries(data.categoryCounts).slice(0, 10).map(([category, count]) => `
            <div class="stat-item">
              <span class="stat-label">${category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              <span class="stat-value">${count}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
        ${data.severityLevelCounts && Object.keys(data.severityLevelCounts).length > 0 ? `
        <div class="stat-box">
          <div class="stat-box-title">Severity Level Distribution</div>
          ${Object.entries(data.severityLevelCounts).slice(0, 10).map(([level, count]) => `
            <div class="stat-item">
              <span class="stat-label">${level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              <span class="stat-value">${count}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
    </div>
    
    <h2 class="section-title">DETAILED INCIDENT INFORMATION</h2>
    
    ${data.incidents.map((incident, index) => {
      const emergencyCategory = incident.emergencyCategory || classifyEmergencyType(incident.type)
      const description = incident.fullDescription || incident.description || 'No description provided'
      
      return `
      <div class="incident-detail-card">
        <div class="incident-header">
          <div style="flex: 1;">
            <div class="incident-id">Incident #${index + 1} | ID: ${incident.id.slice(0, 8).toUpperCase()}</div>
            <div class="incident-type">${incident.type || 'Unspecified Incident'}</div>
            <div class="incident-category">${emergencyCategory}</div>
            ${incident.incident_category && incident.incident_category !== 'N/A' ? `
            <div style="margin: 8px 0; font-size: 13px; color: #4b5563;">
              <strong>Category:</strong> ${incident.incident_category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              ${incident.trauma_subcategory && incident.trauma_subcategory !== 'N/A' ? ` | <strong>Trauma Type:</strong> ${incident.trauma_subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}` : ''}
            </div>
            ` : ''}
            <div class="incident-badges">
              <span class="badge badge-${incident.status.toLowerCase().replace(' ', '-')}">
                ${incident.status}
              </span>
              ${incident.severity_level && incident.severity_level !== 'N/A' ? `
              <span class="severity-badge" style="background: ${severityColor(incident.severity)};">
                ${incident.severity_level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              ` : `
              <span class="severity-badge" style="background: ${severityColor(incident.severity)};">
                Severity Level ${incident.severity}
              </span>
              `}
              ${incident.priority ? `<span class="badge" style="background: #e0e7ff; color: #3730a3;">Priority: ${incident.priority}</span>` : ''}
            </div>
          </div>
        </div>
        
        <div class="description-box">
          <div class="detail-label">INCIDENT DESCRIPTION</div>
          <div class="description-text">${description}</div>
        </div>
        
        <div class="incident-details-grid">
          <div class="detail-item">
            <div class="detail-label">Location</div>
            <div class="detail-value">
              ${incident.address || incident.location || 'N/A'}<br>
              ${incident.barangay ? `<strong>Barangay:</strong> ${incident.barangay}` : ''}
              ${incident.city ? ` | <strong>City:</strong> ${incident.city}` : ''}
              ${incident.province ? ` | <strong>Province:</strong> ${incident.province}` : ''}
            </div>
          </div>
          
          <div class="detail-item">
            <div class="detail-label">Reporter Information</div>
            <div class="detail-value">
              ${incident.reporter || 'Anonymous'}<br>
              ${incident.reporterPhone ? `Phone: ${incident.reporterPhone}` : ''}
              ${incident.reporterEmail ? `<br>Email: ${incident.reporterEmail}` : ''}
            </div>
          </div>
          
          ${incident.assignedTo ? `
          <div class="detail-item">
            <div class="detail-label">Assigned Volunteer</div>
            <div class="detail-value">
              ${incident.assignedTo}<br>
              ${incident.assignedToPhone ? `Phone: ${incident.assignedToPhone}` : ''}
            </div>
          </div>
          ` : ''}
          
          <div class="detail-item">
            <div class="detail-label">Severity Classification</div>
            <div class="detail-value">
              ${incident.severity_level && incident.severity_level !== 'N/A' 
                ? incident.severity_level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                : getSeverityLabel(incident.severity)}
              ${incident.incident_category && incident.incident_category !== 'N/A' ? `<br><small style="color: #6b7280;">Category: ${incident.incident_category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</small>` : ''}
              ${incident.trauma_subcategory && incident.trauma_subcategory !== 'N/A' ? `<br><small style="color: #6b7280;">Trauma: ${incident.trauma_subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</small>` : ''}
            </div>
          </div>
        </div>
        
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-label">Reported</div>
            <div class="timeline-value">${formatDateTime(incident.created_at)}</div>
          </div>
          ${incident.assigned_at ? `
          <div class="timeline-item">
            <div class="timeline-label">Assigned</div>
            <div class="timeline-value">${formatDateTime(incident.assigned_at)} ${incident.responseTimeMinutes ? `(${formatTime(incident.responseTimeMinutes)} response time)` : ''}</div>
          </div>
          ` : ''}
          ${incident.resolved_at ? `
          <div class="timeline-item">
            <div class="timeline-label">Resolved</div>
            <div class="timeline-value">${formatDateTime(incident.resolved_at)} ${incident.resolutionTimeMinutes ? `(${formatTime(incident.resolutionTimeMinutes)} total time)` : ''}</div>
          </div>
          ` : ''}
          ${incident.updated_at && incident.updated_at !== incident.created_at ? `
          <div class="timeline-item">
            <div class="timeline-label">Last Updated</div>
            <div class="timeline-value">${formatDateTime(incident.updated_at)}</div>
          </div>
          ` : ''}
        </div>
        
        ${incident.resolutionNotes ? `
        <div class="description-box" style="background: #f0fdf4; border-left-color: #10b981;">
          <div class="detail-label">RESOLUTION NOTES</div>
          <div class="description-text">${incident.resolutionNotes}</div>
        </div>
        ` : ''}
        
        ${incident.photoCount && incident.photoCount > 0 ? `
        <div class="detail-item">
          <div class="detail-label">Attachments</div>
          <div class="detail-value">${incident.photoCount} photo(s) attached</div>
        </div>
        ` : ''}
      </div>
      `
    }).join('')}
    
    <div class="footer">
      <p style="margin-bottom: 10px;"><strong>RVOIS - Rescue Volunteers Operations Information System</strong></p>
      <p style="margin-bottom: 5px;">Talisay City, Negros Occidental, Philippines</p>
      <p style="font-size: 11px; color: #9ca3af; margin-top: 10px;">This is an official automated report generated by the RVOIS system. For inquiries, please contact the system administrator.</p>
      <p style="font-size: 10px; color: #9ca3af; margin-top: 5px;">Report Period: ${formatDate(data.startDate)} to ${formatDate(data.endDate)} | Classification: ${classification}</p>
      <p style="font-size: 9px; color: #9ca3af; margin-top: 5px;">Protected under Republic Act No. 10173 (Data Privacy Act of 2012)</p>
    </div>
  </div>
</body>
</html>
  `
}
