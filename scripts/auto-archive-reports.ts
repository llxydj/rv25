#!/usr/bin/env node

/**
 * Automated Report Archiving Script
 * 
 * This script automatically archives reports for years that are 2 or more years old.
 * It should be run periodically (e.g., daily) via cron job or task scheduler.
 * 
 * Usage:
 *   node scripts/auto-archive-reports.ts
 * 
 * Environment Variables Required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 *   - CRON_AUTH_TOKEN: Authentication token for internal requests
 */

import { createClient } from '@supabase/supabase-js'

async function autoArchiveReports() {
  console.log('Starting automated report archiving...')

  try {
    // Validate required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const cronAuthToken = process.env.CRON_AUTH_TOKEN

    if (!supabaseUrl || !supabaseKey || !cronAuthToken) {
      throw new Error('Missing required environment variables')
    }

    // Make request to the auto-archive API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://rvois-jet.vercel.app'}/api/admin/reports/auto-archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronAuthToken}`
      },
      body: JSON.stringify({})
    })

    const result = await response.json()

    if (result.success) {
      console.log(`✅ Auto-archiving completed successfully`)
      console.log(`Archived years: ${result.archivedYears?.join(', ') || 'None'}`)
      if (result.errors && result.errors.length > 0) {
        console.log(`⚠️  Errors encountered:`)
        result.errors.forEach((error: string) => console.log(`  - ${error}`))
      }
    } else {
      throw new Error(result.message || 'Auto-archiving failed')
    }
  } catch (error) {
    console.error('❌ Auto-archiving failed:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  autoArchiveReports()
}

export default autoArchiveReports