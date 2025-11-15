#!/usr/bin/env node

/**
 * Backup Service Starter
 * 
 * This script starts the automated backup service for the RVOIS system.
 * It should be run as part of your deployment process or as a separate
 * service in your infrastructure.
 */

import { backupService } from '../src/lib/backup-service'

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down backup service...')
  backupService.stopAutomatedBackups()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down backup service...')
  backupService.stopAutomatedBackups()
  process.exit(0)
})

// Start the backup service
console.log('Starting RVOIS Backup Service...')
backupService.startAutomatedBackups()

// Keep the process running
setInterval(() => {
  console.log('Backup service is running...')
}, 60000) // Log every minute to show the service is alive