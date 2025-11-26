-- Create a function to update volunteer profile in a single transaction
CREATE OR REPLACE FUNCTION update_volunteer_profile(
  p_user_id UUID,
  p_user_updates JSONB,
  p_profile_updates JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Start transaction
  BEGIN
    -- Update users table
    UPDATE users
    SET
      phone_number = COALESCE((p_user_updates->>'phone_number')::TEXT, phone_number),
      address = COALESCE((p_user_updates->>'address')::TEXT, address),
      barangay = COALESCE((p_user_updates->>'barangay')::TEXT, barangay),
      updated_at = COALESCE((p_user_updates->>'updated_at')::TIMESTAMPTZ, updated_at)
    WHERE id = p_user_id;

    -- Update volunteer_profiles table
    UPDATE volunteer_profiles
    SET
      skills = COALESCE((p_profile_updates->>'skills')::TEXT[], skills),
      availability = COALESCE((p_profile_updates->>'availability')::TEXT[], availability),
      assigned_barangays = COALESCE((p_profile_updates->>'assigned_barangays')::TEXT[], assigned_barangays),
      notes = COALESCE((p_profile_updates->>'notes')::TEXT, notes),
      updated_at = COALESCE((p_profile_updates->>'updated_at')::TIMESTAMPTZ, updated_at)
    WHERE volunteer_user_id = p_user_id
    RETURNING jsonb_build_object(
      'id', id,
      'status', status,
      'skills', skills,
      'availability', availability,
      'assigned_barangays', assigned_barangays,
      'total_incidents_resolved', total_incidents_resolved,
      'notes', notes,
      'updated_at', updated_at
    ) INTO v_result;

    -- Return the updated data
    RETURN jsonb_build_object(
      'success', true,
      'data', v_result
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Roll back transaction and return error
      ROLLBACK;
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$; 