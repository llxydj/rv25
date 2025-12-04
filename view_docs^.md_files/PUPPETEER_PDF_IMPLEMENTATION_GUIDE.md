# Puppeteer PDF Implementation Guide

## Overview

This guide explains how to implement professional PDF generation using Puppeteer, which provides the best visual quality by converting HTML/CSS to PDF.

## Why Puppeteer?

- ✅ **Best Quality**: PDFs look exactly like web pages
- ✅ **Full CSS Support**: Use any CSS styling, Tailwind, custom styles
- ✅ **Charts & Images**: Easy to embed charts, photos, logos
- ✅ **Professional Output**: Looks like a professionally designed document

## Installation

```bash
pnpm add puppeteer
# Or for serverless environments:
pnpm add puppeteer-core chromium
```

## Basic Implementation

### 1. Create PDF Generator Utility

```typescript
// src/lib/pdf-generator-puppeteer.ts
import puppeteer from 'puppeteer'

export async function generatePDFFromHTML(
  htmlContent: string,
  options: {
    format?: 'A4' | 'Letter'
    margin?: { top: string; right: string; bottom: string; left: string }
    printBackground?: boolean
  } = {}
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  try {
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
    
    const pdf = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: options.printBackground ?? true
    })
    
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
```

### 2. Create HTML Template

```typescript
// src/lib/pdf-templates/incident-report-template.ts
export function generateIncidentReportHTML(data: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', sans-serif;
      color: #333;
      line-height: 1.6;
    }
    .header {
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .summary {
      background: #f9fafb;
      border-left: 4px solid #dc2626;
      padding: 20px;
      margin-bottom: 30px;
    }
    .summary h2 {
      color: #dc2626;
      margin-bottom: 15px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-item-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .summary-item-value {
      font-size: 20px;
      font-weight: bold;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #dc2626;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    @media print {
      .header { page-break-after: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RVOIS Incident Report</h1>
    <p>Rescue Volunteers Operations Information System</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="content">
    <div class="summary">
      <h2>Report Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-item-label">Total Incidents</div>
          <div class="summary-item-value">${data.total}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">Period</div>
          <div class="summary-item-value">${data.startDate} to ${data.endDate}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">Status</div>
          <div class="summary-item-value">${data.statusCounts}</div>
        </div>
      </div>
    </div>
    
    <h2>Incident Details</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Severity</th>
          <th>Location</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${data.incidents.map(incident => `
          <tr>
            <td>${incident.id.slice(0, 8)}</td>
            <td>${incident.type}</td>
            <td>${incident.status}</td>
            <td>Level ${incident.severity}</td>
            <td>${incident.location}</td>
            <td>${new Date(incident.created_at).toLocaleDateString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="footer">
      <p>RVOIS - Rescue Volunteers Operations Information System</p>
      <p>Talisay City, Negros Occidental, Philippines</p>
    </div>
  </div>
</body>
</html>
  `
}
```

### 3. Update API Route

```typescript
// src/app/api/reports/pdf/route.ts
import { generatePDFFromHTML } from '@/lib/pdf-generator-puppeteer'
import { generateIncidentReportHTML } from '@/lib/pdf-templates/incident-report-template'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filters, reportType = 'incidents' } = body

    // Fetch data
    const data = await fetchReportData(filters, reportType)

    // Generate HTML
    const html = generateIncidentReportHTML(data)

    // Convert to PDF
    const pdfBuffer = await generatePDFFromHTML(html, {
      format: 'A4',
      printBackground: true
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${Date.now()}.pdf"`
      }
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
```

## Advanced Features

### Adding Charts

```typescript
// Use Chart.js or Recharts to generate chart images
import { Chart } from 'chart.js'
import { createCanvas } from 'canvas'

async function generateChartImage(data: any): Promise<string> {
  const canvas = createCanvas(800, 400)
  const ctx = canvas.getContext('2d')
  
  // Create chart
  const chart = new Chart(ctx, {
    type: 'bar',
    data: data
  })
  
  // Convert to base64
  return canvas.toDataURL('image/png')
}

// Then embed in HTML:
// <img src="${chartImage}" alt="Chart" />
```

### Adding Images

```typescript
// Convert image URLs to base64 for embedding
async function imageToBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return `data:image/jpeg;base64,${base64}`
}
```

## Serverless Considerations

For Vercel/Netlify, use `puppeteer-core` with Chromium:

```typescript
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function generatePDFFromHTML(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  })
  
  // ... rest of the code
}
```

## Performance Tips

1. **Reuse Browser**: Create browser once, reuse for multiple PDFs
2. **Cache Templates**: Cache compiled HTML templates
3. **Optimize Images**: Resize/compress images before embedding
4. **Lazy Load**: Only generate PDFs when requested

## Next Steps

1. Install Puppeteer
2. Create HTML templates
3. Update API routes
4. Test with sample data
5. Deploy and monitor performance

