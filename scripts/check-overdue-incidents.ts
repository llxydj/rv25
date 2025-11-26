#!/usr/bin/env node
/**
 * Script to check for overdue incidents and send alerts
 * This script should be run every minute via cron or scheduled task
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkOverdueIncidents() {
  console.log('Checking for overdue incidents...')
  
  try {
    // Call the overdue incidents API endpoint
    const response = await fetch('http://localhost:3000/api/overdue-incidents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_AUTH_TOKEN || 'cron-token'}`
      }
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`Successfully processed ${result.count} overdue incidents`)
      if (result.alertsSent && result.alertsSent.length > 0) {
        console.log(`Alerts sent for incidents: ${result.alertsSent.join(', ')}`)
      }
    } else {
      console.error('Failed to process overdue incidents:', result.message)
    }
  } catch (error) {
    console.error('Error checking overdue incidents:', error)
  }
}

// Run the function
checkOverdueIncidents()
  .then(() => {
    console.log('Overdue incidents check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error in overdue incidents check:', error)
    process.exit(1)
  })