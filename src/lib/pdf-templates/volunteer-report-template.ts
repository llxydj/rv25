/**
 * Volunteer Performance Report PDF Template
 */

export interface VolunteerReportData {
  totalVolunteers: number
  startDate: string
  endDate: string
  summary: {
    totalIncidents: number
    totalResolved: number
    avgResolutionRate: string
  }
  volunteers: Array<{
    name: string
    phone: string
    skills: string[]
    totalIncidents: number
    resolvedIncidents: number
    resolutionRate: string
  }>
}

export function generateVolunteerReportHTML(data: VolunteerReportData): string {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RVOIS Volunteer Performance Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      background: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .header .subtitle {
      font-size: 16px;
      opacity: 0.95;
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
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-left: 5px solid #059669;
      padding: 30px;
      margin-bottom: 40px;
      border-radius: 8px;
    }
    .summary-section h2 {
      color: #059669;
      font-size: 24px;
      margin-bottom: 20px;
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
      border-top: 3px solid #059669;
    }
    .summary-card-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .summary-card-value {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
    }
    .section-title {
      font-size: 22px;
      font-weight: 600;
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
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
    }
    th {
      padding: 14px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 13px;
    }
    tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    .footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RVOIS Volunteer Performance Report</h1>
    <div class="subtitle">Rescue Volunteers Operations Information System</div>
    <div class="meta">
      Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
    </div>
  </div>
  
  <div class="content">
    <div class="summary-section">
      <h2>Performance Summary</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-card-label">Active Volunteers</div>
          <div class="summary-card-value">${data.totalVolunteers}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Total Incidents</div>
          <div class="summary-card-value">${data.summary.totalIncidents}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Resolved</div>
          <div class="summary-card-value">${data.summary.totalResolved}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Resolution Rate</div>
          <div class="summary-card-value" style="font-size: 24px;">${data.summary.avgResolutionRate}%</div>
        </div>
      </div>
      <div style="margin-top: 20px; color: #6b7280; font-size: 14px;">
        <strong>Report Period:</strong> ${formatDate(data.startDate)} to ${formatDate(data.endDate)}
      </div>
    </div>
    
    <h2 class="section-title">Volunteer Performance Details</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>Skills</th>
          <th>Assigned</th>
          <th>Resolved</th>
          <th>Resolution Rate</th>
        </tr>
      </thead>
      <tbody>
        ${data.volunteers.map(volunteer => `
          <tr>
            <td><strong>${volunteer.name}</strong></td>
            <td>${volunteer.phone || 'N/A'}</td>
            <td>${volunteer.skills?.join(', ') || 'None'}</td>
            <td>${volunteer.totalIncidents}</td>
            <td>${volunteer.resolvedIncidents}</td>
            <td><strong>${volunteer.resolutionRate}%</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="footer">
      <p><strong>RVOIS - Rescue Volunteers Operations Information System</strong></p>
      <p>Talisay City, Negros Occidental, Philippines</p>
    </div>
  </div>
</body>
</html>
  `
}

