#!/usr/bin/env node

/**
 * Dashboard-Based Scheduled Auto Archive Script
 * 
 * This script demonstrates how auto-archiving can be scheduled and managed
 * directly from the admin dashboard without requiring complex cron setups.
 * 
 * In a real implementation, this would be integrated into the dashboard UI
 * and run as a background service.
 */

import { createClient } from '@supabase/supabase-js'

// Configuration - In a real implementation, these would come from environment variables
const CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'your_supabase_url',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://rvois-jet.vercel.app',
  cronAuthToken: process.env.CRON_AUTH_TOKEN || 'your_cron_auth_token'
}

async function runScheduledAutoArchive() {
  console.log('🔍 Checking for scheduled auto-archive tasks...')
  
  try {
    // Initialize Supabase client
    const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)
    
    // Check if auto-archiving is enabled and scheduled to run
    const { data: scheduleConfig, error } = await supabase
      .from('auto_archive_schedule')
      .select('*')
      .limit(1)
      .single()
    
    if (error) {
      console.error('❌ Error fetching schedule configuration:', error)
      return
    }
    
    // If not enabled, exit
    if (!scheduleConfig.enabled) {
      console.log('ℹ️  Auto-archiving is not enabled. Skipping...')
      return
    }
    
    // Check if it's time to run
    const now = new Date()
    const nextRun = new Date(scheduleConfig.next_run)
    
    if (now < nextRun) {
      console.log(`⏰ Next scheduled run: ${nextRun.toLocaleString()}`)
      return
    }
    
    console.log('🚀 Running scheduled auto-archive...')
    
    // Make request to the auto-archive API endpoint
    const response = await fetch(`${CONFIG.siteUrl}/api/admin/reports/auto-archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.cronAuthToken}`
      },
      body: JSON.stringify({})
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ Auto-archiving completed successfully')
      console.log(`Archived years: ${result.archivedYears?.join(', ') || 'None'}`)
      
      if (result.errors && result.errors.length > 0) {
        console.log('⚠️  Errors encountered:')
        result.errors.forEach((error: string) => console.log(`  - ${error}`))
      }
      
      // Update next run time
      let newNextRun = new Date()
      if (scheduleConfig.schedule_frequency === 'daily') {
        newNextRun.setDate(newNextRun.getDate() + 1)
      } else if (scheduleConfig.schedule_frequency === 'weekly') {
        newNextRun.setDate(newNextRun.getDate() + 7)
      } else if (scheduleConfig.schedule_frequency === 'monthly') {
        newNextRun.setMonth(newNextRun.getMonth() + 1)
      }
      
      // Set the time
      const [hours, minutes] = scheduleConfig.schedule_time.split(':')
      newNextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      
      // Update the schedule
      const { error: updateError } = await supabase
        .from('auto_archive_schedule')
        .update({ 
          last_run: new Date().toISOString(),
          next_run: newNextRun.toISOString()
        })
        .eq('id', scheduleConfig.id)
      
      if (updateError) {
        console.error('❌ Error updating schedule:', updateError)
      } else {
        console.log(`✅ Next run scheduled for: ${newNextRun.toLocaleString()}`)
      }
    } else {
      console.error('❌ Auto-archiving failed:', result.message)
    }
  } catch (error) {
    console.error('❌ Scheduled auto-archive failed:', error)
  }
}

// Run the scheduled task
if (require.main === module) {
  runScheduledAutoArchive()
    .then(() => {
      console.log('🏁 Scheduled auto-archive check completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Scheduled auto-archive failed with unhandled error:', error)
      process.exit(1)
    })
}

export default runScheduledAutoArchive