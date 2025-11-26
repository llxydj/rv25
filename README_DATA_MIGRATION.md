# Incident Data Format Migration Guide

This document explains the changes made to ensure consistency between the resident incident reporting system and the admin display, and provides instructions for migrating legacy data to the new format.

## Problem Summary

The resident incident reporting system was updated with new features, but the admin dashboard was still displaying legacy data in the old format, causing inconsistencies:

### Old Format (Legacy)
- Single photo: `photo_url` field (string)
- Photos stored in root folder: `/uploads/incident_12345.jpg`
- No photo array: `photo_urls` is null
- No offline timestamp: Only `created_at` (server time)
- Manual priority selection: Users could choose any priority
- No offline markers: No `incident_updates` entry
- Mixed case barangays: Not normalized to UPPERCASE

### New Format (Current)
- Multiple photos: `photo_urls` array (up to 3 photos)
- Photos in processed folder: `/processed/incident_12345.jpg`
- Primary photo: `photo_url` still exists but points to first photo in array
- Offline timestamp: `created_at_local` preserves original submission time
- Strict priority enforcement: EMERGENCY=1, COMMUNITY=3
- Offline markers: Creates `incident_updates` entry with offline note
- Photo processing: All photos moved to `processed/` folder automatically
- Normalized barangays: Always UPPERCASE

## Solution Implemented

### 1. Backward Compatibility Layer
- Updated admin display components to handle both old and new data formats
- Added visual indicators for legacy data
- Added data format filter to admin incidents page
- Created data quality dashboard to monitor migration progress

### 2. Data Migration Script
- Created automated migration script to convert legacy data to new format
- Handles photo migration from root to processed/ folder
- Backfills `created_at_local` field
- Normalizes barangay names to uppercase
- Adds migration markers for tracking

### 3. Admin Dashboard Integration
- Added data quality dashboard to monitor migration progress
- Shows statistics on legacy vs. current format incidents

## Files Modified

### Core Components
1. `src/app/admin/incidents/page.tsx` - Added data format filter and normalization
2. `src/app/admin/incidents/[id]/page.tsx` - Updated incident detail display
3. `src/components/admin/incidents-table.tsx` - Added legacy data indicators
4. `src/components/admin/incidents-filter.tsx` - Added data format filter option
5. `src/app/admin/dashboard/page.tsx` - Added data quality dashboard

### Utility Functions
1. `src/lib/incident-utils.ts` - Created normalization utilities
2. `src/components/admin/data-quality-dashboard.tsx` - Created dashboard component

### Migration Tools
1. `src/scripts/migrate-legacy-incidents.ts` - Automated migration script

## Running the Migration

### Prerequisites
1. Ensure you have the Supabase service role key
2. Set environment variables:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Running the Migration Script
```bash
# Navigate to the project root
cd /path/to/your/project

# Run the migration script
npx ts-node src/scripts/migrate-legacy-incidents.ts
```

### What the Migration Does
1. Finds all incidents using the legacy format (missing `photo_urls` array)
2. Moves photos from root to `processed/` folder
3. Converts `photo_url` to `photo_urls` array
4. Backfills `created_at_local` field
5. Normalizes barangay names to uppercase
6. Adds migration markers to track converted incidents

## Monitoring Progress

The data quality dashboard in the admin dashboard shows:
- Total incidents
- Current format incidents
- Legacy format incidents
- Migration progress percentage
- Action required alerts for legacy data

## Verification

After migration, verify that:
1. All incidents display correctly in both list and detail views
2. Photos load properly from the `processed/` folder
3. Timestamps display correctly using `created_at_local` when available
4. Barangay names are consistently uppercase
5. The data quality dashboard shows 100% migration progress

## Rollback Plan

If issues are encountered:
1. The migration script is non-destructive and preserves original data
2. To rollback, you can manually revert the `photo_url`, `photo_urls`, `created_at_local`, and `barangay` fields
3. Remove migration markers from the `incident_updates` table

## Future Considerations

1. The backward compatibility layer ensures no downtime during migration
2. Once all data is migrated, consider removing legacy code paths for performance
3. Regular monitoring through the data quality dashboard ensures ongoing consistency