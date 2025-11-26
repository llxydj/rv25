# Database Migration Instructions

This document provides instructions for applying the database indexes optimization for the incident filtering feature.

## Migration File

The migration file is located at:
```
supabase/migrations/20251102000000_optimize_incidents_filtering.sql
```

## Applying the Migration

### Option 1: Using Supabase CLI (Recommended)

1. Ensure you have the Supabase CLI installed:
   ```bash
   npm install -g supabase
   ```

2. Navigate to your project root directory:
   ```bash
   cd /path/to/your/project
   ```

3. Apply the migration:
   ```bash
   npx supabase db push
   ```

### Option 2: Manual SQL Execution

If you prefer to execute the SQL manually:

1. Copy the contents of `supabase/migrations/20251102000000_optimize_incidents_filtering.sql`

2. Connect to your Supabase database using your preferred SQL client

3. Execute the SQL statements

## What the Migration Does

The migration creates the following indexes to optimize filtering performance:

1. `idx_incidents_barangay_status` - Optimizes filtering by barangay and status
2. `idx_incidents_incident_type_status` - Optimizes filtering by incident type and status
3. `idx_incidents_priority_status` - Optimizes filtering by priority and status
4. `idx_incidents_created_at_status` - Optimizes date range and status filtering
5. `idx_incidents_severity_status` - Optimizes filtering by severity and status
6. `idx_incidents_multi_filter` - Optimizes multi-filter queries
7. `idx_incidents_date_range` - Optimizes date range queries
8. `idx_incident_updates_offline_notes` - Optimizes offline incident detection

## Verifying the Migration

After applying the migration, you can verify the indexes were created by running:

```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'incidents' 
AND indexname LIKE 'idx_incidents_%'
ORDER BY indexname;
```

You should see all 8 indexes listed.

## Performance Impact

These indexes will significantly improve query performance for:
- Filtering by barangay, incident type, priority, severity
- Date range queries
- Multi-filter combinations
- Status filtering
- Offline incident detection

The indexes use the CONCURRENTLY option to avoid locking tables during creation, ensuring minimal impact on production systems.