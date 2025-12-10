-- ========================================
-- REMOVE PIN SYSTEM COMPLETELY
-- ========================================
-- Purpose: Safely remove all PIN-related database objects
-- Date: 2025-01-31
-- ========================================

-- Step 1: Drop PIN-related functions
DROP FUNCTION IF EXISTS public.verify_pin(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.hash_pin(TEXT) CASCADE;

-- Step 2: Drop PIN-related RLS policies BEFORE dropping table
-- Note: Must drop policies before dropping table, otherwise we get "table does not exist" error
DROP POLICY IF EXISTS "users_view_own_pin_attempts" ON public.pin_attempts;

-- Step 3: Drop PIN-related triggers (if any)
DROP TRIGGER IF EXISTS trigger_update_pin_attempts_updated_at ON public.pin_attempts;
DROP FUNCTION IF EXISTS update_pin_attempts_updated_at() CASCADE;

-- Step 4: Drop PIN-related tables
-- Drop pin_attempts table (CASCADE will drop dependent objects like indexes, etc.)
DROP TABLE IF EXISTS public.pin_attempts CASCADE;

-- Step 5: Remove PIN columns from users table
-- Note: Column comments are automatically removed when columns are dropped
ALTER TABLE public.users
  DROP COLUMN IF EXISTS pin_hash,
  DROP COLUMN IF EXISTS pin_enabled,
  DROP COLUMN IF EXISTS pin_created_at;

-- ========================================
-- VERIFICATION
-- ========================================
-- After running this migration, verify:
-- 1. No pin_* columns in users table
-- 2. No pin_attempts table exists
-- 3. No PIN-related functions exist
-- 4. All PIN-related policies removed

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
-- If you need to rollback, you would need to:
-- 1. Re-run the original PIN migration files
-- 2. Restore PIN columns to users table
-- 3. Recreate pin_attempts table
-- However, PIN data will be lost unless you have a backup

