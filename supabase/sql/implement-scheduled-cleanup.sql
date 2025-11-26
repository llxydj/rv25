-- Implement Scheduled Cleanup for Old Data
-- Current issue: Cleanup function exists but won't run unless scheduled
-- Need proper scheduling and monitoring

-- Fix 1: Create comprehensive cleanup function with proper error handling
CREATE OR REPLACE FUNCTION cleanup_old_location_data(
  retention_days INTEGER DEFAULT 7,
  batch_size INTEGER DEFAULT 1000
)
RETURNS TABLE(
  deleted_count INTEGER,
  cleanup_duration_ms DECIMAL,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  start_time TIMESTAMP WITH TIME ZONE := NOW();
  deleted_count INTEGER := 0;
  temp_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
  error_msg TEXT;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Log cleanup start
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES ('cleanup_old_location_data', 'Starting cleanup for data older than ' || cutoff_date, 'system');
  
  -- Delete in batches to avoid locking issues
  LOOP
    DELETE FROM public.location_tracking
    WHERE timestamp < cutoff_date
    AND id IN (
      SELECT id FROM public.location_tracking
      WHERE timestamp < cutoff_date
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Exit if no more rows to delete
    EXIT WHEN temp_count = 0;
    
    -- Small delay to prevent overwhelming the database
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  -- Log successful cleanup
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES (
    'cleanup_old_location_data', 
    'Cleanup completed. Deleted ' || deleted_count || ' records', 
    'system'
  );
  
  -- Return success
  RETURN QUERY SELECT 
    deleted_count,
    EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
    TRUE,
    NULL::TEXT;
    
EXCEPTION
  WHEN OTHERS THEN
    error_msg := SQLERRM;
    
    -- Log error
    INSERT INTO public.system_logs (action, details, created_by, error_message)
    VALUES (
      'cleanup_old_location_data', 
      'Cleanup failed after deleting ' || deleted_count || ' records', 
      'system', 
      error_msg
    );
    
    -- Return failure
    RETURN QUERY SELECT 
      deleted_count,
      EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
      FALSE,
      error_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Create cleanup function for other old data
CREATE OR REPLACE FUNCTION cleanup_old_system_data(
  retention_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  deleted_count INTEGER,
  cleanup_duration_ms DECIMAL,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  start_time TIMESTAMP WITH TIME ZONE := NOW();
  deleted_count INTEGER := 0;
  temp_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
  error_msg TEXT;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Clean up old system logs (keep only last 30 days)
  DELETE FROM public.system_logs
  WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old notification logs (keep only last 30 days)
  DELETE FROM public.notification_logs
  WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old barangay access logs (keep only last 30 days)
  DELETE FROM public.barangay_access_logs
  WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Log successful cleanup
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES (
    'cleanup_old_system_data', 
    'System data cleanup completed. Deleted ' || deleted_count || ' records', 
    'system'
  );
  
  RETURN QUERY SELECT 
    deleted_count,
    EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
    TRUE,
    NULL::TEXT;
    
EXCEPTION
  WHEN OTHERS THEN
    error_msg := SQLERRM;
    
    INSERT INTO public.system_logs (action, details, created_by, error_message)
    VALUES (
      'cleanup_old_system_data', 
      'System data cleanup failed after deleting ' || deleted_count || ' records', 
      'system', 
      error_msg
    );
    
    RETURN QUERY SELECT 
      deleted_count,
      EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000,
      FALSE,
      error_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 3: Create master cleanup function that runs all cleanups
CREATE OR REPLACE FUNCTION run_scheduled_cleanup()
RETURNS TABLE(
  location_cleanup RECORD,
  system_cleanup RECORD,
  overall_success BOOLEAN
) AS $$
DECLARE
  location_result RECORD;
  system_result RECORD;
  overall_success BOOLEAN := TRUE;
BEGIN
  -- Run location data cleanup
  SELECT * INTO location_result
  FROM cleanup_old_location_data(7, 1000);
  
  -- Run system data cleanup
  SELECT * INTO system_result
  FROM cleanup_old_system_data(30);
  
  -- Check if both cleanups succeeded
  overall_success := location_result.success AND system_result.success;
  
  -- Log overall result
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES (
    'run_scheduled_cleanup', 
    'Scheduled cleanup completed. Location: ' || location_result.deleted_count || 
    ' records, System: ' || system_result.deleted_count || ' records. Success: ' || overall_success, 
    'system'
  );
  
  RETURN QUERY SELECT location_result, system_result, overall_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 4: Create cleanup monitoring function
CREATE OR REPLACE FUNCTION monitor_cleanup_performance()
RETURNS TABLE(
  last_cleanup TIMESTAMP WITH TIME ZONE,
  location_records_deleted INTEGER,
  system_records_deleted INTEGER,
  cleanup_duration_ms DECIMAL,
  success BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.created_at as last_cleanup,
    COALESCE(
      (sl.details ~ 'Location: (\d+) records')::INTEGER,
      0
    ) as location_records_deleted,
    COALESCE(
      (sl.details ~ 'System: (\d+) records')::INTEGER,
      0
    ) as system_records_deleted,
    COALESCE(
      EXTRACT(EPOCH FROM (sl.updated_at - sl.created_at)) * 1000,
      0
    ) as cleanup_duration_ms,
    (sl.details LIKE '%Success: true%') as success,
    sl.error_message
  FROM public.system_logs sl
  WHERE sl.action = 'run_scheduled_cleanup'
  ORDER BY sl.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 5: Create function to check if cleanup is needed
CREATE OR REPLACE FUNCTION check_cleanup_needed()
RETURNS TABLE(
  location_cleanup_needed BOOLEAN,
  system_cleanup_needed BOOLEAN,
  location_old_records INTEGER,
  system_old_records INTEGER
) AS $$
DECLARE
  location_cutoff TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '7 days';
  system_cutoff TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '30 days';
  location_count INTEGER;
  system_count INTEGER;
BEGIN
  -- Count old location records
  SELECT COUNT(*) INTO location_count
  FROM public.location_tracking
  WHERE timestamp < location_cutoff;
  
  -- Count old system records
  SELECT COUNT(*) INTO system_count
  FROM public.system_logs
  WHERE created_at < system_cutoff;
  
  RETURN QUERY SELECT 
    (location_count > 1000) as location_cleanup_needed,
    (system_count > 1000) as system_cleanup_needed,
    location_count as location_old_records,
    system_count as system_old_records;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 6: Create smart cleanup function that only runs when needed
CREATE OR REPLACE FUNCTION smart_cleanup()
RETURNS TABLE(
  cleanup_performed BOOLEAN,
  location_cleaned INTEGER,
  system_cleaned INTEGER,
  reason TEXT
) AS $$
DECLARE
  cleanup_check RECORD;
  location_result RECORD;
  system_result RECORD;
  cleanup_performed BOOLEAN := FALSE;
  reason TEXT;
BEGIN
  -- Check if cleanup is needed
  SELECT * INTO cleanup_check
  FROM check_cleanup_needed();
  
  -- Only run cleanup if needed
  IF cleanup_check.location_cleanup_needed OR cleanup_check.system_cleanup_needed THEN
    cleanup_performed := TRUE;
    
    IF cleanup_check.location_cleanup_needed THEN
      SELECT * INTO location_result
      FROM cleanup_old_location_data(7, 1000);
    END IF;
    
    IF cleanup_check.system_cleanup_needed THEN
      SELECT * INTO system_result
      FROM cleanup_old_system_data(30);
    END IF;
    
    reason := 'Cleanup needed: Location=' || cleanup_check.location_old_records || 
              ', System=' || cleanup_check.system_old_records;
  ELSE
    reason := 'No cleanup needed';
  END IF;
  
  RETURN QUERY SELECT 
    cleanup_performed,
    COALESCE(location_result.deleted_count, 0) as location_cleaned,
    COALESCE(system_result.deleted_count, 0) as system_cleaned,
    reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 7: Create cleanup scheduling table for external schedulers
CREATE TABLE IF NOT EXISTS public.cleanup_schedule (
  id SERIAL PRIMARY KEY,
  cleanup_type VARCHAR(50) NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  interval_hours INTEGER DEFAULT 24,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default schedule
INSERT INTO public.cleanup_schedule (cleanup_type, interval_hours, next_run)
VALUES ('location_data', 24, NOW() + INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

INSERT INTO public.cleanup_schedule (cleanup_type, interval_hours, next_run)
VALUES ('system_data', 168, NOW() + INTERVAL '1 hour') -- Weekly
ON CONFLICT DO NOTHING;

-- Fix 8: Create function to check and run scheduled cleanups
CREATE OR REPLACE FUNCTION check_and_run_scheduled_cleanup()
RETURNS TABLE(
  cleanup_type VARCHAR(50),
  run_performed BOOLEAN,
  records_cleaned INTEGER
) AS $$
DECLARE
  schedule_record RECORD;
  cleanup_result RECORD;
  records_cleaned INTEGER := 0;
BEGIN
  -- Check all enabled schedules
  FOR schedule_record IN 
    SELECT * FROM public.cleanup_schedule 
    WHERE enabled = TRUE 
    AND next_run <= NOW()
  LOOP
    -- Run appropriate cleanup
    IF schedule_record.cleanup_type = 'location_data' THEN
      SELECT * INTO cleanup_result
      FROM cleanup_old_location_data(7, 1000);
      records_cleaned := cleanup_result.deleted_count;
    ELSIF schedule_record.cleanup_type = 'system_data' THEN
      SELECT * INTO cleanup_result
      FROM cleanup_old_system_data(30);
      records_cleaned := cleanup_result.deleted_count;
    END IF;
    
    -- Update next run time
    UPDATE public.cleanup_schedule
    SET last_run = NOW(),
        next_run = NOW() + (schedule_record.interval_hours || ' hours')::INTERVAL,
        updated_at = NOW()
    WHERE id = schedule_record.id;
    
    -- Return result
    RETURN QUERY SELECT 
      schedule_record.cleanup_type,
      TRUE,
      records_cleaned;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 9: Add RLS for cleanup_schedule table
ALTER TABLE public.cleanup_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_cleanup_schedule"
ON public.cleanup_schedule FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Fix 10: Create cleanup status dashboard function
CREATE OR REPLACE FUNCTION get_cleanup_status()
RETURNS TABLE(
  last_location_cleanup TIMESTAMP WITH TIME ZONE,
  last_system_cleanup TIMESTAMP WITH TIME ZONE,
  location_records_count BIGINT,
  system_logs_count BIGINT,
  cleanup_needed BOOLEAN,
  next_scheduled_cleanup TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT MAX(created_at) FROM public.system_logs WHERE action = 'cleanup_old_location_data') as last_location_cleanup,
    (SELECT MAX(created_at) FROM public.system_logs WHERE action = 'cleanup_old_system_data') as last_system_cleanup,
    (SELECT COUNT(*) FROM public.location_tracking WHERE timestamp < NOW() - INTERVAL '7 days') as location_records_count,
    (SELECT COUNT(*) FROM public.system_logs WHERE created_at < NOW() - INTERVAL '30 days') as system_logs_count,
    (SELECT COUNT(*) FROM public.location_tracking WHERE timestamp < NOW() - INTERVAL '7 days') > 1000 as cleanup_needed,
    (SELECT MIN(next_run) FROM public.cleanup_schedule WHERE enabled = TRUE) as next_scheduled_cleanup;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Summary of fixes:
-- 1. Created comprehensive cleanup functions with proper error handling
-- 2. Added batch processing to avoid locking issues
-- 3. Implemented smart cleanup that only runs when needed
-- 4. Created cleanup scheduling system for external schedulers
-- 5. Added monitoring and status functions
-- 6. Implemented proper logging and error tracking
-- 7. Added RLS policies for cleanup management
-- 8. Created dashboard functions for cleanup status
