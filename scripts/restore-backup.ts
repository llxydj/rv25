#!/usr/bin/env node

/**
 * Backup Restore Script
 * 
 * This script restores data from a backup file.
 * Usage: pnpm ts-node scripts/restore-backup.ts <backup-file-name>
 */

import { backupService } from '../src/lib/backup-service'

async function restoreBackup() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error('Usage: pnpm ts-node scripts/restore-backup.ts <backup-file-name>')
    process.exit(1)
  }
  
  const backupFileName = args[0]
  
  console.log(`Starting restore from backup: ${backupFileName}`)
  
  try {
    const { success, message } = await backupService.restoreFromBackup(backupFileName)
    
    if (success) {
      console.log(message)
      console.log('Restore completed successfully!')
    } else {
      console.error(`Restore failed: ${message}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('Restore error:', error)
    process.exit(1)
  }
}

// Run the restore
restoreBackup().catch(error => {
  console.error('Fatal error during restore:', error)
  process.exit(1)
})