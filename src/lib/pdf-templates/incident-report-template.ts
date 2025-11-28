/**
 * Incident Report PDF Template
 * Beautiful HTML template for incident reports
 */

export interface IncidentReportData {
  total: number
  startDate: string
  endDate: string
  statusCounts: Record<string, number>
  severityCounts: Record<string, number>
  incidents: Array<{
    id: string
    type: string
    status: string
    severity: number
    location: string
    barangay: string
    created_at: string
    reporter?: string
    reporterPhone?: string
    description?: string
    assignedTo?: string
    resolved_at?: string
  }>
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

  const statusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': '#f59e0b',
      'in_progress': '#3b82f6',
      'resolved': '#10b981',
      'closed': '#6b7280',
      'cancelled': '#ef4444'
    }
    return colors[status.toLowerCase()] || '#6b7280'
  }

  const severityColor = (severity: number) => {
    const colors: Record<number, string> = {
      1: '#ef4444', // Critical - Red
      2: '#f59e0b', // High - Orange
      3: '#eab308', // Medium - Yellow
      4: '#3b82f6', // Low - Blue
      5: '#10b981'  // Info - Green
    }
    return colors[severity] || '#6b7280'
  }

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
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-in-progress { background: #dbeafe; color: #1e40af; }
    .badge-resolved { background: #d1fae5; color: #065f46; }
    .badge-closed { background: #f3f4f6; color: #374151; }
    
    .severity-badge {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 6px;
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
      table { page-break-inside: avoid; }
      tbody tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 15px;">
      ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Radiant Logo" style="height: 60px; width: auto; background: white; padding: 8px; border-radius: 8px; object-fit: contain;" />` : ''}
      <div style="text-align: ${logoBase64 ? 'left' : 'center'}; flex: 1;">
        <h1 style="margin: 0; font-size: 28px;">RVOIS Incident Report</h1>
        <div class="subtitle" style="font-size: 14px; margin-top: 5px;">Rescue Volunteers Operations Information System</div>
      </div>
    </div>
    <div class="meta">
      Generated: ${new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      })}
    </div>
  </div>
  
  <div class="content">
    <div class="summary-section">
      <h2>Report Summary</h2>
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
              <span class="stat-label">Level ${severity}</span>
              <span class="stat-value">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    
    <h2 class="section-title">Incident Details</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Severity</th>
          <th>Barangay</th>
          <th>Location</th>
          <th>Reporter</th>
          <th>Created</th>
          <th>Resolved</th>
        </tr>
      </thead>
      <tbody>
        ${data.incidents.map(incident => `
          <tr>
            <td style="font-family: monospace; font-size: 11px;">${incident.id.slice(0, 8)}</td>
            <td>${incident.type}</td>
            <td>
              <span class="badge badge-${incident.status.toLowerCase().replace(' ', '-')}">
                ${incident.status}
              </span>
            </td>
            <td>
              <span class="severity-badge" style="background: ${severityColor(incident.severity)};"></span>
              Level ${incident.severity}
            </td>
            <td>${incident.barangay || 'N/A'}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${incident.location || 'N/A'}</td>
            <td>${incident.reporter || 'Anonymous'}</td>
            <td style="font-size: 11px;">${formatDateTime(incident.created_at)}</td>
            <td style="font-size: 11px;">${incident.resolved_at ? formatDateTime(incident.resolved_at) : 'N/A'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="footer">
      <p style="margin-bottom: 10px;"><strong>RVOIS - Rescue Volunteers Operations Information System</strong></p>
      <p style="margin-bottom: 5px;">Talisay City, Negros Occidental, Philippines</p>
      <p style="font-size: 11px; color: #9ca3af; margin-top: 10px;">This is an official automated report generated by the RVOIS system. For inquiries, please contact the system administrator.</p>
      <p style="font-size: 10px; color: #9ca3af; margin-top: 5px;">Report Period: ${formatDate(data.startDate)} to ${formatDate(data.endDate)}</p>
    </div>
  </div>
</body>
</html>
  `
}

