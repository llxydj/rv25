/**
 * Puppeteer PDF Generator
 * Generates professional PDFs from HTML/CSS templates
 */

import puppeteer from 'puppeteer'

export interface PDFOptions {
  format?: 'A4' | 'Letter' | 'Legal'
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  printBackground?: boolean
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
}

/**
 * Generate PDF from HTML content using Puppeteer
 */
export async function generatePDFFromHTML(
  htmlContent: string,
  options: PDFOptions = {}
): Promise<Buffer> {
  let browser
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })
    
    const page = await browser.newPage()
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 })
    
    // Set content and wait for resources to load
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    })
    
    // Wait a bit more for any images to load
    await page.waitForTimeout(1000)
    
    // Generate PDF
    const pdf = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: options.printBackground ?? true,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate
    })
    
    return Buffer.from(pdf)
  } catch (error) {
    console.error('Puppeteer PDF generation error:', error)
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * Generate PDF from URL (for server-side rendering)
 */
export async function generatePDFFromURL(
  url: string,
  options: PDFOptions = {}
): Promise<Buffer> {
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    })
    
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    
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
  } catch (error) {
    console.error('Puppeteer PDF generation from URL error:', error)
    throw new Error(`Failed to generate PDF from URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

