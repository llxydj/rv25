-- DROP the problematic function
DROP FUNCTION IF EXISTS is_admin_user(uuid) CASCADE;

-- CREATE the fixed version that doesn't query users table
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_role text;
BEGIN
  -- Query volunteer_profiles instead of users to avoid recursion
  SELECT role INTO user_role 
  FROM public.volunteer_profiles 
  WHERE volunteer_user_id = user_id 
  LIMIT 1;
  
  RETURN user_role = 'admin';
EXCEPTION 
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$function$;

-- Verify the function was created
SELECT proname, pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'is_admin_user';