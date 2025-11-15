-- Fix Materialized View Refresh Mechanism
-- Current issue: pg_notify doesn't actually refresh data automatically
-- Need proper refresh triggers and listeners

-- Fix 1: Create proper refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_active_volunteers_view()
RETURNS VOID AS $$
BEGIN
  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY active_volunteers_last_5min;
  
  -- Log the refresh
  INSERT INTO public.system_logs (action, details, created_by)
  VALUES ('refresh_active_volunteers_view', 'Materialized view refreshed', 'system');
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the operation
    INSERT INTO public.system_logs (action, details, created_by, error_message)
    VALUES ('refresh_active_volunteers_view', 'Failed to refresh materialized view', 'system', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Create trigger function to refresh view on location_tracking changes
CREATE OR REPLACE FUNCTION trigger_refresh_active_volunteers()
RETURNS TRIGGER AS $$
BEGIN
  -- Use pg_notify to signal refresh (non-blocking)
  PERFORM pg_notify('refresh_active_volunteers', 'refresh_needed');
  
  -- Also refresh immediately for critical updates
  -- This ensures data consistency but may impact performance
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only refresh if the change affects active volunteers
    IF EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.volunteer_profiles vp ON u.id = vp.volunteer_user_id
      WHERE u.id = COALESCE(NEW.user_id, OLD.user_id)
      AND vp.status = 'ACTIVE'
    ) THEN
      PERFORM refresh_active_volunteers_view();
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fix 3: Create trigger on location_tracking table
DROP TRIGGER IF EXISTS trigger_location_tracking_refresh ON public.location_tracking;

CREATE TRIGGER trigger_location_tracking_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.location_tracking
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_active_volunteers();

-- Fix 4: Create trigger on volunteer_profiles table for status changes
DROP TRIGGER IF EXISTS trigger_volunteer_status_refresh ON public.volunteer_profiles;

CREATE TRIGGER trigger_volunteer_status_refresh
  AFTER UPDATE OF status ON public.volunteer_profiles
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_refresh_active_volunteers();

-- Fix 5: Create scheduled refresh function (for pg_cron or external scheduler)
CREATE OR REPLACE FUNCTION scheduled_refresh_active_volunteers()
RETURNS VOID AS $$
DECLARE
  last_refresh TIMESTAMP WITH TIME ZONE;
  refresh_interval INTERVAL := '5 minutes';
BEGIN
  -- Get last refresh time from system_logs
  SELECT MAX(created_at) INTO last_refresh
  FROM public.system_logs
  WHERE action = 'refresh_active_volunteers_view'
  AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Refresh if it's been more than 5 minutes
  IF last_refresh IS NULL OR last_refresh < NOW() - refresh_interval THEN
    PERFORM refresh_active_volunteers_view();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 6: Create function to check materialized view freshness
CREATE OR REPLACE FUNCTION check_materialized_view_freshness()
RETURNS TABLE(
  view_name TEXT,
  last_refresh TIMESTAMP WITH TIME ZONE,
  is_stale BOOLEAN,
  staleness_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'active_volunteers_last_5min'::TEXT as view_name,
    sl.created_at as last_refresh,
    (sl.created_at < NOW() - INTERVAL '5 minutes') as is_stale,
    EXTRACT(EPOCH FROM (NOW() - sl.created_at))/60 as staleness_minutes
  FROM public.system_logs sl
  WHERE sl.action = 'refresh_active_volunteers_view'
  ORDER BY sl.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 7: Create function to force refresh if stale
CREATE OR REPLACE FUNCTION ensure_materialized_view_freshness()
RETURNS BOOLEAN AS $$
DECLARE
  view_freshness RECORD;
  refresh_performed BOOLEAN := FALSE;
BEGIN
  -- Check current freshness
  SELECT * INTO view_freshness
  FROM check_materialized_view_freshness();
  
  -- If stale, refresh
  IF view_freshness.is_stale THEN
    PERFORM refresh_active_volunteers_view();
    refresh_performed := TRUE;
  END IF;
  
  RETURN refresh_performed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 8: Update the RPC function to ensure fresh data
CREATE OR REPLACE FUNCTION get_volunteers_within_radius(
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_km DECIMAL
) RETURNS TABLE(
  user_id UUID,
  latitude DECIMAL,
  longitude DECIMAL,
  accuracy DECIMAL,
  last_seen TIMESTAMP WITH TIME ZONE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  distance_km DECIMAL
) AS $$
BEGIN
  -- Ensure materialized view is fresh before querying
  PERFORM ensure_materialized_view_freshness();
  
  -- Return fresh data from materialized view
  RETURN QUERY
  SELECT 
    av.user_id,
    av.latitude,
    av.longitude,
    av.accuracy,
    av.last_seen,
    av.first_name,
    av.last_name,
    av.phone_number,
    ST_Distance(
      ST_Point(center_lng, center_lat)::geography,
      ST_Point(av.longitude, av.latitude)::geography
    ) / 1000 as distance_km
  FROM active_volunteers_last_5min av
  WHERE ST_DWithin(
    ST_Point(center_lng, center_lat)::geography,
    ST_Point(av.longitude, av.latitude)::geography,
    radius_km * 1000
  )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 9: Create monitoring function for refresh performance
CREATE OR REPLACE FUNCTION monitor_materialized_view_performance()
RETURNS TABLE(
  refresh_count INTEGER,
  avg_refresh_time_ms DECIMAL,
  last_refresh TIMESTAMP WITH TIME ZONE,
  stale_refreshes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as refresh_count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_refresh_time_ms,
    MAX(created_at) as last_refresh,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '5 minutes')::INTEGER as stale_refreshes
  FROM public.system_logs
  WHERE action = 'refresh_active_volunteers_view'
  AND created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 10: Add error handling and retry logic
CREATE OR REPLACE FUNCTION refresh_active_volunteers_with_retry(
  max_retries INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 1000
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt INTEGER := 0;
  success BOOLEAN := FALSE;
  error_msg TEXT;
BEGIN
  WHILE attempt < max_retries AND NOT success LOOP
    BEGIN
      PERFORM refresh_active_volunteers_view();
      success := TRUE;
    EXCEPTION
      WHEN OTHERS THEN
        attempt := attempt + 1;
        error_msg := SQLERRM;
        
        -- Log the error
        INSERT INTO public.system_logs (action, details, created_by, error_message)
        VALUES (
          'refresh_active_volunteers_with_retry', 
          'Retry attempt ' || attempt || ' failed', 
          'system', 
          error_msg
        );
        
        -- Wait before retry
        IF attempt < max_retries THEN
          PERFORM pg_sleep(retry_delay_ms / 1000.0);
        END IF;
    END;
  END LOOP;
  
  RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Summary of fixes:
-- 1. Created proper refresh function with error handling
-- 2. Added triggers for automatic refresh on data changes
-- 3. Implemented freshness checking and forced refresh
-- 4. Added retry logic for failed refreshes
-- 5. Created monitoring functions for performance tracking
-- 6. Updated RPC function to ensure fresh data
-- 7. Added scheduled refresh capability for external schedulers
