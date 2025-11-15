#!/usr/bin/env node

/**
 * Manual Backup Script
 * 
 * This script triggers a manual backup outside of the automated schedule.
 */

import { backupService } from '../src/lib/backup-service'

async function manualBackup() {
  console.log('Starting manual backup...')
  
  try {
    const { success, message } = await backupService.performBackup()
    
    if (success) {
      console.log('✅ Manual backup completed successfully')
      console.log(message)
    } else {
      console.error('❌ Manual backup failed')
      console.error(message)
      process.exit(1)
    }
  } catch (error) {
    console.error('Fatal error during manual backup:', error)
    process.exit(1)
  }
}

// Run the manual backup
manualBackup().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})