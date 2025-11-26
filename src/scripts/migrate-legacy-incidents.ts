/**
 * Script to migrate legacy incident data to the new format
 * This script should be run once to normalize all existing incident data
 * 
 * Features:
 * 1. Convert single photo_url to photo_urls array
 * 2. Move photos from root to processed/ folder
 * 3. Backfill created_at_local field
 * 4. Normalize barangay names to uppercase
 * 5. Add offline marker for legacy data
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateLegacyIncidents() {
  console.log('🚀 Starting legacy incident migration...')
  
  try {
    // Get all incidents that don't have photo_urls array (legacy format)
    const { data: legacyIncidents, error } = await supabase
      .from('incidents')
      .select('*')
      .or('photo_urls.is.null,photo_urls.eq.null')
      
    if (error) throw error
    
    console.log(`📋 Found ${legacyIncidents?.length || 0} legacy incidents to migrate`)
    
    if (!legacyIncidents || legacyIncidents.length === 0) {
      console.log('✅ No legacy incidents found. Migration complete.')
      return
    }
    
    let migratedCount = 0
    let errorCount = 0
    
    // Process each legacy incident
    for (const incident of legacyIncidents) {
      try {
        console.log(`🔄 Processing incident ${incident.id}...`)
        
        // 1. Handle photo migration
        let processedPhotoPath = null
        let photoUrlsArray = null
        
        if (incident.photo_url) {
          // Check if photo exists
          const { error: signErr } = await supabase
            .storage
            .from('incident-photos')
            .createSignedUrl(incident.photo_url, 60)
            
          if (!signErr) {
            // Move photo to processed/ folder if not already there
            if (!incident.photo_url.startsWith('processed/')) {
              const baseName = incident.photo_url.split('/').pop() || `${incident.reporter_id}-${incident.id}.jpg`
              const newPath = `processed/${baseName}`
              
              const { error: copyErr } = await supabase
                .storage
                .from('incident-photos')
                .copy(incident.photo_url, newPath)
                
              if (!copyErr) {
                processedPhotoPath = newPath
                photoUrlsArray = [newPath]
                console.log(`  ✅ Moved photo to processed folder: ${newPath}`)
              } else {
                console.warn(`  ⚠️ Failed to copy photo, keeping original: ${copyErr?.message}`)
                processedPhotoPath = incident.photo_url
                photoUrlsArray = [incident.photo_url]
              }
            } else {
              processedPhotoPath = incident.photo_url
              photoUrlsArray = [incident.photo_url]
              console.log(`  ℹ️ Photo already in processed folder`)
            }
          } else {
            console.warn(`  ⚠️ Photo not found or inaccessible: ${incident.photo_url}`)
          }
        }
        
        // 2. Backfill created_at_local if missing
        const createdAtLocal = incident.created_at_local || incident.created_at
        
        // 3. Normalize barangay to uppercase
        const normalizedBarangay = incident.barangay?.toUpperCase() || incident.barangay || ''
        
        // 4. Update the incident record
        const updatePayload: any = {
          barangay: normalizedBarangay,
          created_at_local: createdAtLocal
        }
        
        // Only update photo fields if we have valid values
        if (processedPhotoPath !== null) {
          updatePayload.photo_url = processedPhotoPath
        }
        if (photoUrlsArray !== null) {
          updatePayload.photo_urls = photoUrlsArray
        }
        
        const { error: updateError } = await supabase
          .from('incidents')
          .update(updatePayload)
          .eq('id', incident.id)
          
        if (updateError) throw updateError
        
        console.log(`  ✅ Updated incident ${incident.id}`)
        migratedCount++
        
        // 5. Add offline marker for legacy data (if not already exists)
        try {
          const { data: existingMarkers } = await supabase
            .from('incident_updates')
            .select('id')
            .eq('incident_id', incident.id)
            .ilike('notes', '%legacy data migration%')
            
          if (!existingMarkers || existingMarkers.length === 0) {
            const { error: markerError } = await supabase
              .from('incident_updates')
              .insert({
                incident_id: incident.id,
                updated_by: incident.reporter_id,
                previous_status: incident.status,
                new_status: incident.status,
                notes: 'Legacy data migration: Converted from old format to new format'
              })
              
            if (markerError) {
              console.warn(`  ⚠️ Failed to add migration marker: ${markerError?.message}`)
            } else {
              console.log(`  ➕ Added migration marker`)
            }
          }
        } catch (markerError) {
          console.warn(`  ⚠️ Error checking/adding migration marker: ${markerError}`)
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (incidentError) {
        console.error(`❌ Error migrating incident ${incident.id}:`, incidentError)
        errorCount++
      }
    }
    
    console.log(`\n📊 Migration Summary:`)
    console.log(`   Successfully migrated: ${migratedCount}`)
    console.log(`   Errors: ${errorCount}`)
    console.log(`   Total processed: ${legacyIncidents.length}`)
    
    if (errorCount === 0) {
      console.log('\n✅ Legacy incident migration completed successfully!')
    } else {
      console.log(`\n⚠️ Migration completed with ${errorCount} errors.`)
    }
    
  } catch (error) {
    console.error('💥 Fatal error during migration:', error)
    process.exit(1)
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrateLegacyIncidents()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export { migrateLegacyIncidents }