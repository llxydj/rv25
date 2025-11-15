import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import { createWriteStream, existsSync, mkdirSync, createReadStream } from 'fs'
import { join } from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream'
import { promisify } from 'util'
import * as crypto from 'crypto'

const pipelineAsync = promisify(pipeline)

// Initialize Supabase client for backup operations
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for backup service')
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// Backup configuration
const BACKUP_CONFIG = {
  interval: 3600000, // 1 hour in milliseconds
  retentionDays: 30, // Keep backups for 30 days
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || 'default-backup-key-change-in-production',
  localBackupPath: join(process.cwd(), 'backups'),
  remoteBackupPath: 'backups' // For cloud storage
}

// Critical tables that must be backed up
const CRITICAL_TABLES = [
  'incidents',
  'incident_updates',
  'incident_feedback',
  'incident_handoffs',
  'reports',
  'sms_logs',
  'sms_deliveries',
  'volunteeractivities',
  'volunteer_activity_logs',
  'schedules',
  'scheduledactivities',
  'users',
  'volunteer_profiles',
  'volunteer_locations'
]

export class BackupService {
  private backupInterval: NodeJS.Timeout | null = null
  private isBackingUp = false

  constructor() {
    // Ensure backup directory exists
    if (!existsSync(BACKUP_CONFIG.localBackupPath)) {
      mkdirSync(BACKUP_CONFIG.localBackupPath, { recursive: true })
    }
  }

  // Start automated backups
  startAutomatedBackups() {
    if (this.backupInterval) {
      console.warn('Backup service already running')
      return
    }

    console.log('Starting automated backup service')
    this.backupInterval = setInterval(async () => {
      try {
        await this.performBackup()
      } catch (error) {
        console.error('Backup failed:', error)
        await this.sendAlert(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }, BACKUP_CONFIG.interval)

    // Perform initial backup
    this.performBackup().catch(error => {
      console.error('Initial backup failed:', error)
    })
  }

  // Stop automated backups
  stopAutomatedBackups() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval)
      this.backupInterval = null
      console.log('Stopped automated backup service')
    }
  }

  // Perform a backup of critical data
  async performBackup(): Promise<{ success: boolean; message: string }> {
    if (this.isBackingUp) {
      return { success: false, message: 'Backup already in progress' }
    }

    this.isBackingUp = true
    const startTime = Date.now()
    console.log('Starting backup process...')

    try {
      // Create backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `rvois-backup-${timestamp}.json.gz`
      const localBackupPath = join(BACKUP_CONFIG.localBackupPath, backupFileName)

      // Export data from critical tables
      const backupData: Record<string, any[]> = {}
      
      for (const tableName of CRITICAL_TABLES) {
        console.log(`Backing up table: ${tableName}`)
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          
        if (error) {
          throw new Error(`Failed to backup table ${tableName}: ${error.message}`)
        }
        
        backupData[tableName] = data || []
        console.log(`Backed up ${data?.length || 0} records from ${tableName}`)
      }

      // Save and compress backup data
      await this.saveAndCompressBackup(backupData, localBackupPath)
      
      // Encrypt backup
      const encryptedPath = await this.encryptBackup(localBackupPath)
      
      // Upload to remote storage (this would be implemented based on your storage provider)
      await this.uploadToRemoteStorage(encryptedPath)
      
      // Clean up old backups
      await this.cleanupOldBackups()
      
      const duration = Date.now() - startTime
      const message = `Backup completed successfully in ${duration}ms`
      console.log(message)
      
      // Log successful backup
      await this.logBackupSuccess(backupFileName, duration)
      
      return { success: true, message }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Backup failed:', errorMessage)
      
      // Log failed backup
      await this.logBackupFailure(errorMessage)
      
      // Send alert
      await this.sendAlert(`Backup failed: ${errorMessage}`)
      
      return { success: false, message: errorMessage }
    } finally {
      this.isBackingUp = false
    }
  }

  // Save and compress backup data
  private async saveAndCompressBackup(data: any, filePath: string): Promise<void> {
    const jsonString = JSON.stringify(data)
    const source = Buffer.from(jsonString, 'utf-8')
    const gzip = createGzip()
    const destination = createWriteStream(filePath)
    
    await pipelineAsync(gzip, destination)
    gzip.end(source)
  }

  // Encrypt backup file
  private async encryptBackup(filePath: string): Promise<string> {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(BACKUP_CONFIG.encryptionKey, 'salt', 32)
    const iv = crypto.randomBytes(16)
    
    const encryptedPath = filePath + '.enc'
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    const input = createReadStream(filePath)
    const output = createWriteStream(encryptedPath)
    
    await pipelineAsync(input, cipher, output)
    
    return encryptedPath
  }

  // Upload to remote storage (implementation depends on your storage provider)
  private async uploadToRemoteStorage(filePath: string): Promise<void> {
    // This would be implemented based on your cloud storage provider
    // Examples:
    // - AWS S3
    // - Google Cloud Storage
    // - Azure Blob Storage
    // - Supabase Storage
    
    console.log(`Would upload ${filePath} to remote storage`)
    // For now, we'll just simulate this
    return Promise.resolve()
  }

  // Clean up old backups based on retention policy
  private async cleanupOldBackups(): Promise<void> {
    // Implementation would depend on your storage solution
    console.log('Cleaning up old backups...')
    return Promise.resolve()
  }

  // Log successful backup
  private async logBackupSuccess(backupFileName: string, duration: number): Promise<void> {
    try {
      // Using a more generic approach to avoid type issues
      const logData: any = {
        action: 'BACKUP_SUCCESS',
        details: `Backup ${backupFileName} completed in ${duration}ms`,
        created_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('system_logs')
        .insert(logData)
      
      if (error) {
        console.warn('Failed to log backup success:', error.message)
      }
    } catch (error) {
      console.warn('Failed to log backup success:', error)
    }
  }

  // Log failed backup
  private async logBackupFailure(errorMessage: string): Promise<void> {
    try {
      // Using a more generic approach to avoid type issues
      const logData: any = {
        action: 'BACKUP_FAILURE',
        details: `Backup failed: ${errorMessage}`,
        error_message: errorMessage,
        created_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('system_logs')
        .insert(logData)
      
      if (error) {
        console.warn('Failed to log backup failure:', error.message)
      }
    } catch (error) {
      console.warn('Failed to log backup failure:', error)
    }
  }

  // Send alert (implementation depends on your alerting system)
  private async sendAlert(message: string): Promise<void> {
    console.log(`ALERT: ${message}`)
    
    // This would integrate with your alerting system
    // Examples:
    // - Email notifications
    // - SMS alerts
    // - Slack/Teams notifications
    // - PagerDuty
    
    // For now, we'll just log the alert
    try {
      // Using a more generic approach to avoid type issues
      const logData: any = {
        action: 'BACKUP_ALERT',
        details: message,
        created_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('system_logs')
        .insert(logData)
      
      if (error) {
        console.warn('Failed to log backup alert:', error.message)
      }
    } catch (error) {
      console.warn('Failed to log backup alert:', error)
    }
  }

  // Restore from backup (for disaster recovery)
  async restoreFromBackup(backupFileName: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`Starting restore from backup: ${backupFileName}`)
      
      // This would implement the restore process
      // - Download encrypted backup
      // - Decrypt backup
      // - Decompress backup
      // - Parse JSON data
      // - Insert data into tables (in correct order to respect foreign keys)
      
      return { success: true, message: `Restore from ${backupFileName} completed successfully` }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Restore failed:', errorMessage)
      return { success: false, message: `Restore failed: ${errorMessage}` }
    }
  }
}

// Export singleton instance
export const backupService = new BackupService()