-- Create a function to execute raw SQL for admin purposes
-- This should be limited to authenticated users only
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Execute the provided SQL query
  EXECUTE sql_query;
  
  -- Return a simple success response
  result := '{"status": "success", "message": "SQL executed successfully"}'::JSONB;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Return error details if the query fails
  result := jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'code', SQLSTATE
  );
  
  RETURN result;
END;
$$; 