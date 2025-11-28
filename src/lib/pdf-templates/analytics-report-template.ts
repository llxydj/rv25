/**
 * Analytics Report PDF Template
 */

export interface AnalyticsReportData {
  totalIncidents: number
  startDate: string
  endDate: string
  resolved: number
  avgResponseTime: number
  resolutionRate: string
  statusDistribution: Record<string, number>
  typeDistribution: Record<string, number>
  barangayDistribution: Record<string, number>
  severityDistribution: Record<string, number>
}

export function generateAnalyticsReportHTML(data: AnalyticsReportData): string {
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
  <title>RVOIS Analytics Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      background: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
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
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      border-left: 5px solid #7c3aed;
      padding: 25px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }
    .metric-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .metric-value {
      font-size: 32px;
      font-weight: 700;
      color: #111827;
    }
    .distribution-section {
      margin-top: 40px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    .distribution-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .distribution-box {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .distribution-box-title {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .distribution-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .distribution-item:last-child {
      border-bottom: none;
    }
    .distribution-label {
      color: #4b5563;
      font-size: 13px;
    }
    .distribution-value {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
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
    <h1>RVOIS Analytics Report</h1>
    <div class="subtitle">Rescue Volunteers Operations Information System</div>
    <div class="meta">
      Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
    </div>
  </div>
  
  <div class="content">
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Incidents</div>
        <div class="metric-value">${data.totalIncidents}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Resolved</div>
        <div class="metric-value">${data.resolved}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Resolution Rate</div>
        <div class="metric-value" style="font-size: 28px;">${data.resolutionRate}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Response Time</div>
        <div class="metric-value" style="font-size: 24px;">${data.avgResponseTime.toFixed(1)}h</div>
      </div>
    </div>
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <strong>Report Period:</strong> ${formatDate(data.startDate)} to ${formatDate(data.endDate)}
    </div>
    
    <div class="distribution-section">
      <h2 class="section-title">Distribution Analytics</h2>
      
      <div class="distribution-grid">
        <div class="distribution-box">
          <div class="distribution-box-title">Status Distribution</div>
          ${Object.entries(data.statusDistribution).map(([status, count]) => {
            const percentage = data.totalIncidents > 0 ? ((count / data.totalIncidents) * 100).toFixed(1) : '0.0'
            return `
              <div class="distribution-item">
                <span class="distribution-label">${status}</span>
                <span class="distribution-value">${count} (${percentage}%)</span>
              </div>
            `
          }).join('')}
        </div>
        
        <div class="distribution-box">
          <div class="distribution-box-title">Type Distribution</div>
          ${Object.entries(data.typeDistribution).map(([type, count]) => {
            const percentage = data.totalIncidents > 0 ? ((count / data.totalIncidents) * 100).toFixed(1) : '0.0'
            return `
              <div class="distribution-item">
                <span class="distribution-label">${type}</span>
                <span class="distribution-value">${count} (${percentage}%)</span>
              </div>
            `
          }).join('')}
        </div>
        
        <div class="distribution-box">
          <div class="distribution-box-title">Barangay Distribution</div>
          ${Object.entries(data.barangayDistribution).slice(0, 10).map(([barangay, count]) => {
            const percentage = data.totalIncidents > 0 ? ((count / data.totalIncidents) * 100).toFixed(1) : '0.0'
            return `
              <div class="distribution-item">
                <span class="distribution-label">${barangay}</span>
                <span class="distribution-value">${count} (${percentage}%)</span>
              </div>
            `
          }).join('')}
          ${Object.keys(data.barangayDistribution).length > 10 ? `<div class="distribution-item"><span class="distribution-label">... and ${Object.keys(data.barangayDistribution).length - 10} more</span></div>` : ''}
        </div>
        
        <div class="distribution-box">
          <div class="distribution-box-title">Severity Distribution</div>
          ${Object.entries(data.severityDistribution).map(([severity, count]) => {
            const percentage = data.totalIncidents > 0 ? ((count / data.totalIncidents) * 100).toFixed(1) : '0.0'
            return `
              <div class="distribution-item">
                <span class="distribution-label">Level ${severity}</span>
                <span class="distribution-value">${count} (${percentage}%)</span>
              </div>
            `
          }).join('')}
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>RVOIS - Rescue Volunteers Operations Information System</strong></p>
      <p>Talisay City, Negros Occidental, Philippines</p>
    </div>
  </div>
</body>
</html>
  `
}

