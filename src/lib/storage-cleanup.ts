/**
 * Storage Cleanup Utilities
 * Automatically clean up old or orphaned files from Supabase Storage
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

export interface CleanupOptions {
  bucket: string
  maxAgeDays: number
  dryRun?: boolean
}

export interface CleanupResult {
  deleted: number
  failed: number
  totalSize: number
  errors: string[]
}

/**
 * Clean up old files from a storage bucket
 */
export async function cleanupOldFiles(options: CleanupOptions): Promise<CleanupResult> {
  const { bucket, maxAgeDays, dryRun = false } = options
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)
  
  const result: CleanupResult = {
    deleted: 0,
    failed: 0,
    totalSize: 0,
    errors: []
  }

  try {
    // List all files in bucket
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(bucket)
      .list(undefined, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      })

    if (listError) {
      result.errors.push(`Failed to list files: ${listError.message}`)
      return result
    }

    if (!files || files.length === 0) {
      return result
    }

    // Filter old files
    const filesToDelete = files.filter(file => {
      if (!file.created_at) return false
      const fileDate = new Date(file.created_at)
      return fileDate < cutoffDate
    })

    if (filesToDelete.length === 0) {
      return result
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${filesToDelete.length} files from ${bucket}`)
      return {
        ...result,
        deleted: filesToDelete.length
      }
    }

    // Delete files in batches
    const batchSize = 100
    for (let i = 0; i < filesToDelete.length; i += batchSize) {
      const batch = filesToDelete.slice(i, i + batchSize)
      const paths = batch.map(file => file.name)

      const { error: deleteError } = await supabaseAdmin.storage
        .from(bucket)
        .remove(paths)

      if (deleteError) {
        result.failed += batch.length
        result.errors.push(`Batch ${i / batchSize + 1} failed: ${deleteError.message}`)
      } else {
        result.deleted += batch.length
        const totalSize = batch.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
        result.totalSize += totalSize
      }
    }

    return result
  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`)
    return result
  }
}

/**
 * Clean up orphaned files (files not referenced in database)
 */
export async function cleanupOrphanedFiles(
  bucket: string,
  referenceColumn: string,
  referenceTable: string
): Promise<CleanupResult> {
  const result: CleanupResult = {
    deleted: 0,
    failed: 0,
    totalSize: 0,
    errors: []
  }

  try {
    // Get all referenced file paths from database
    const { data: references, error: refError } = await supabaseAdmin
      .from(referenceTable)
      .select(referenceColumn)

    if (refError) {
      result.errors.push(`Failed to get references: ${refError.message}`)
      return result
    }

    const referencedPaths = new Set(
      references
        ?.map((ref: any) => {
          const path = ref[referenceColumn]
          if (typeof path === 'string') {
            // Extract just the filename/path from full URL
            return path.split('/').pop() || path
          }
          return null
        })
        .filter(Boolean) || []
    )

    // List all files in bucket
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(bucket)
      .list(undefined, { limit: 1000 })

    if (listError) {
      result.errors.push(`Failed to list files: ${listError.message}`)
      return result
    }

    if (!files || files.length === 0) {
      return result
    }

    // Find orphaned files
    const orphanedFiles = files.filter(file => !referencedPaths.has(file.name))

    if (orphanedFiles.length === 0) {
      return result
    }

    // Delete orphaned files in batches
    const batchSize = 100
    for (let i = 0; i < orphanedFiles.length; i += batchSize) {
      const batch = orphanedFiles.slice(i, i + batchSize)
      const paths = batch.map(file => file.name)

      const { error: deleteError } = await supabaseAdmin.storage
        .from(bucket)
        .remove(paths)

      if (deleteError) {
        result.failed += batch.length
        result.errors.push(`Batch ${i / batchSize + 1} failed: ${deleteError.message}`)
      } else {
        result.deleted += batch.length
        const totalSize = batch.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
        result.totalSize += totalSize
      }
    }

    return result
  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`)
    return result
  }
}

/**
 * Setup automatic cleanup (call from cron job or scheduled task)
 */
export async function runScheduledCleanup(): Promise<void> {
  console.log('[Storage Cleanup] Starting scheduled cleanup...')

  // Clean up old incident photos (older than 90 days)
  const incidentPhotosResult = await cleanupOldFiles({
    bucket: 'incident-photos',
    maxAgeDays: 90,
    dryRun: false
  })
  console.log('[Storage Cleanup] Incident photos:', incidentPhotosResult)

  // Clean up old profile images (older than 180 days for inactive users)
  const profileImagesResult = await cleanupOldFiles({
    bucket: 'profile-images',
    maxAgeDays: 180,
    dryRun: false
  })
  console.log('[Storage Cleanup] Profile images:', profileImagesResult)

  // Clean up orphaned files
  const orphanedIncidentPhotos = await cleanupOrphanedFiles(
    'incident-photos',
    'photo_urls',
    'incidents'
  )
  console.log('[Storage Cleanup] Orphaned incident photos:', orphanedIncidentPhotos)
}

