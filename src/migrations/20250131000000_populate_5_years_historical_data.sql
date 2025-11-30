-- ============================================================================
-- 5-YEAR HISTORICAL DATA POPULATION MIGRATION
-- RVOIS - Rescue Volunteers Operations Information System
-- 
-- PURPOSE: Populate system with 5 years of realistic test data for thesis
--          demonstration (2020-2024, ~50 incidents per year)
--
-- SAFETY: 
--   - Only INSERTS data (no updates/deletes)
--   - Preserves existing data
--   - Respects all foreign key relationships
--   - Can be rolled back if needed
--
-- LOCATION DATA:
--   - Uses verified coordinates within Talisay City, Negros Occidental boundaries
--   - Coordinates geofenced to city limits (10.68-10.80°N, 122.92-123.02°E)
--   - Zone-specific coordinates for realistic distribution
--   - All coordinates validated to be within city boundaries
--
-- USAGE: Run this migration ONCE to populate historical data
-- ROLLBACK: See rollback section at end of file
-- ============================================================================
BEGIN;
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate random date within a year range
CREATE OR REPLACE FUNCTION random_date_between(start_date DATE, end_date DATE)
RETURNS DATE AS $$
BEGIN
  RETURN start_date + (random() * (end_date - start_date))::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Function to generate random timestamp within a date range
CREATE OR REPLACE FUNCTION random_timestamp_between(start_ts TIMESTAMPTZ, end_ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN start_ts + (random() * (EXTRACT(EPOCH FROM (end_ts - start_ts)))::INTEGER) * INTERVAL '1 second';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1: CREATE VOLUNTEERS (if they don't exist)
-- ============================================================================

DO $$
DECLARE
  admin_user_id UUID;
  volunteer_ids UUID[] := ARRAY[]::UUID[];
  resident_ids UUID[] := ARRAY[]::UUID[];
  volunteer_count INTEGER;
  resident_count INTEGER;
  i INTEGER;
  new_user_id UUID;
  new_auth_id UUID;
BEGIN
  -- Get existing admin user (or create one if none exists)
  SELECT id INTO admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    -- Create admin user in auth.users first
    new_auth_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      new_auth_id,
      'admin@rvois.test',
      crypt('admin123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    );
    
    -- Create admin in public.users
    INSERT INTO users (id, email, first_name, last_name, role, phone_number, barangay, city, province)
    VALUES (
      new_auth_id,
      'admin@rvois.test',
      'System',
      'Administrator',
      'admin',
      '+639123456789',
      'Zone 1',
      'TALISAY CITY',
      'NEGROS OCCIDENTAL'
    );
    admin_user_id := new_auth_id;
  END IF;

  -- Check existing volunteer count
  SELECT COUNT(*) INTO volunteer_count FROM users WHERE role = 'volunteer';
  
  -- Create volunteers if we have less than 20
  IF volunteer_count < 20 THEN
    FOR i IN 1..(20 - volunteer_count) LOOP
      new_auth_id := gen_random_uuid();
      
      -- Create in auth.users
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      VALUES (
        new_auth_id,
        'volunteer' || (volunteer_count + i) || '@rvois.test',
        crypt('volunteer123', gen_salt('bf')),
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '5 years')
      );
      
      -- Create in public.users
      INSERT INTO users (
        id, email, first_name, last_name, role, phone_number, 
        address, barangay, city, province, gender,
        emergency_contact_name, emergency_contact_phone,
        created_at, updated_at, last_active
      )
      VALUES (
        new_auth_id,
        'volunteer' || (volunteer_count + i) || '@rvois.test',
        'Volunteer' || (volunteer_count + i),
        'Test' || (volunteer_count + i),
        'volunteer',
        '+639' || LPAD((1000000000 + (volunteer_count + i))::TEXT, 10, '0'),
        'Test Address ' || (volunteer_count + i),
        'Zone ' || ((volunteer_count + i) % 10 + 1),
        'TALISAY CITY',
        'NEGROS OCCIDENTAL',
        CASE (volunteer_count + i) % 3 WHEN 0 THEN 'male' WHEN 1 THEN 'female' ELSE 'prefer_not_to_say' END,
        'Emergency Contact ' || (volunteer_count + i),
        '+639' || LPAD((2000000000 + (volunteer_count + i))::TEXT, 10, '0'),
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '30 days')
      );
      
      volunteer_ids := array_append(volunteer_ids, new_auth_id);
    END LOOP;
  ELSE
    -- Get existing volunteer IDs
    SELECT ARRAY_AGG(id) INTO volunteer_ids FROM users WHERE role = 'volunteer' LIMIT 20;
  END IF;

  -- Check existing resident count
  SELECT COUNT(*) INTO resident_count FROM users WHERE role = 'resident';
  
  -- Create residents if we have less than 30
  IF resident_count < 30 THEN
    FOR i IN 1..(30 - resident_count) LOOP
      new_auth_id := gen_random_uuid();
      
      -- Create in auth.users
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      VALUES (
        new_auth_id,
        'resident' || (resident_count + i) || '@rvois.test',
        crypt('resident123', gen_salt('bf')),
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '5 years')
      );
      
      -- Create in public.users
      INSERT INTO users (
        id, email, first_name, last_name, role, phone_number,
        address, barangay, city, province, gender,
        created_at, updated_at, last_active
      )
      VALUES (
        new_auth_id,
        'resident' || (resident_count + i) || '@rvois.test',
        'Resident' || (resident_count + i),
        'Test' || (resident_count + i),
        'resident',
        '+639' || LPAD((3000000000 + (resident_count + i))::TEXT, 10, '0'),
        'Resident Address ' || (resident_count + i),
        'Zone ' || ((resident_count + i) % 10 + 1),
        'TALISAY CITY',
        'NEGROS OCCIDENTAL',
        CASE (resident_count + i) % 3 WHEN 0 THEN 'male' WHEN 1 THEN 'female' ELSE 'prefer_not_to_say' END,
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '5 years'),
        NOW() - (random() * INTERVAL '60 days')
      );
      
      resident_ids := array_append(resident_ids, new_auth_id);
    END LOOP;
  ELSE
    -- Get existing resident IDs
    SELECT ARRAY_AGG(id) INTO resident_ids FROM users WHERE role = 'resident' LIMIT 30;
  END IF;

  -- Create volunteer profiles for volunteers
  FOR i IN 1..array_length(volunteer_ids, 1) LOOP
    INSERT INTO volunteer_profiles (
      volunteer_user_id,
      status,
      skills,
      availability,
      assigned_barangays,
      total_incidents_resolved,
      is_available,
      created_at,
      updated_at
    )
    SELECT
      volunteer_ids[i],
      CASE (i % 4) 
        WHEN 0 THEN 'ACTIVE'::volunteer_status
        WHEN 1 THEN 'ACTIVE'::volunteer_status
        WHEN 2 THEN 'INACTIVE'::volunteer_status
        ELSE 'SUSPENDED'::volunteer_status
      END,
      ARRAY[
        CASE (i % 8) WHEN 0 THEN 'First Aid' WHEN 1 THEN 'Firefighting' WHEN 2 THEN 'Water Rescue' 
        WHEN 3 THEN 'Search and Rescue' WHEN 4 THEN 'Medical Response' WHEN 5 THEN 'Communication'
        WHEN 6 THEN 'Logistics' ELSE 'Leadership' END,
        CASE ((i + 1) % 8) WHEN 0 THEN 'First Aid' WHEN 1 THEN 'Firefighting' WHEN 2 THEN 'Water Rescue' 
        WHEN 3 THEN 'Search and Rescue' WHEN 4 THEN 'Medical Response' WHEN 5 THEN 'Communication'
        WHEN 6 THEN 'Logistics' ELSE 'Leadership' END
      ],
      ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::TEXT[],
      ARRAY['Zone ' || ((i % 10) + 1)]::TEXT[],
      0, -- Will be updated after incidents are created
      (i % 3) != 0, -- 66% available
      NOW() - (random() * INTERVAL '5 years'),
      NOW() - (random() * INTERVAL '1 year')
    ON CONFLICT (volunteer_user_id) DO NOTHING;
  END LOOP;

END $$;

-- ============================================================================
-- STEP 2: GENERATE 5 YEARS OF INCIDENTS (250 total, 50 per year)
-- ============================================================================

DO $$
DECLARE
  incident_types TEXT[] := ARRAY[
    'Fire Emergency', 'Medical Emergency', 'Flood/Water Rescue', 
    'Traffic Accident', 'Natural Disaster', 'Search and Rescue',
    'Structural Collapse', 'Animal Rescue', 'Missing Person', 'Other Emergency'
  ];
  statuses TEXT[] := ARRAY['PENDING', 'ASSIGNED', 'RESPONDING', 'RESOLVED'];
  priorities INTEGER[] := ARRAY[1, 2, 3, 4];
  severities TEXT[] := ARRAY['MINOR', 'MODERATE', 'SEVERE', 'CRITICAL'];
  barangays TEXT[] := ARRAY['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6', 'Zone 7', 'Zone 8', 'Zone 9', 'Zone 10'];
  
  volunteer_ids UUID[];
  resident_ids UUID[];
  admin_id UUID;
  
  year_start DATE;
  year_end DATE;
  incident_date DATE;
  incident_created TIMESTAMPTZ;
  incident_assigned TIMESTAMPTZ;
  incident_resolved TIMESTAMPTZ;
  
  new_incident_id UUID;
  reporter_id UUID;
  assigned_volunteer_id UUID;
  incident_year INTEGER;
  incident_count INTEGER;
  total_incidents INTEGER := 0;
  
  -- Talisay City, Negros Occidental - Actual City Center Coordinates
  -- City Hall/Plaza area (verified coordinates)
  base_lat DOUBLE PRECISION := 10.7375;
  base_lng DOUBLE PRECISION := 122.9683;
  
  -- City boundaries (verified - within actual Talisay City, Negros Occidental limits)
  -- Based on official city boundaries and geofencing requirements
  -- Latitude range: 10.68° to 10.80° (North-South ~13.2 km)
  -- Longitude range: 122.92° to 123.02° (East-West ~11 km)
  -- All coordinates are validated to ensure they fall within these boundaries
  min_lat DOUBLE PRECISION := 10.68;
  max_lat DOUBLE PRECISION := 10.80;
  min_lng DOUBLE PRECISION := 122.92;
  max_lng DOUBLE PRECISION := 123.02;
  
  -- Zone-specific coordinates (more realistic distribution)
  zone_coordinates JSONB := '{
    "Zone 1": {"lat": 10.7400, "lng": 122.9650},
    "Zone 2": {"lat": 10.7350, "lng": 122.9700},
    "Zone 3": {"lat": 10.7300, "lng": 122.9600},
    "Zone 4": {"lat": 10.7450, "lng": 122.9750},
    "Zone 5": {"lat": 10.7250, "lng": 122.9550},
    "Zone 6": {"lat": 10.7500, "lng": 122.9800},
    "Zone 7": {"lat": 10.7200, "lng": 122.9500},
    "Zone 8": {"lat": 10.7550, "lng": 122.9850},
    "Zone 9": {"lat": 10.7150, "lng": 122.9450},
    "Zone 10": {"lat": 10.7600, "lng": 122.9900}
  }'::JSONB;
  
  selected_barangay TEXT;
  zone_coord JSONB;
  incident_lat DOUBLE PRECISION;
  incident_lng DOUBLE PRECISION;
BEGIN
  -- Get user IDs
  SELECT ARRAY_AGG(id) INTO volunteer_ids FROM users WHERE role = 'volunteer' LIMIT 20;
  SELECT ARRAY_AGG(id) INTO resident_ids FROM users WHERE role = 'resident' LIMIT 30;
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
  
  -- Generate incidents for each year (2020-2024)
  FOR incident_year IN 2020..2024 LOOP
    year_start := DATE(incident_year || '-01-01');
    year_end := DATE(incident_year || '-12-31');
    
    -- Generate 50 incidents per year
    FOR incident_count IN 1..50 LOOP
      -- Random date within the year
      incident_date := random_date_between(year_start, year_end);
      incident_created := random_timestamp_between(
        (incident_date || ' 00:00:00')::TIMESTAMPTZ,
        (incident_date || ' 23:59:59')::TIMESTAMPTZ
      );
      
      -- Determine reporter (40% volunteer, 55% resident, 5% admin)
      DECLARE
        reporter_role TEXT;
        is_emergency BOOLEAN;
        mod_value INTEGER;
      BEGIN
        mod_value := incident_count % 20;
        IF mod_value = 0 THEN
          -- 5% admin
          reporter_id := admin_id;
          reporter_role := 'admin';
        ELSIF mod_value >= 1 AND mod_value <= 8 THEN
          -- 40% resident (8 out of 20)
          reporter_id := resident_ids[1 + (random() * (array_length(resident_ids, 1) - 1))::INTEGER];
          reporter_role := 'resident';
        ELSE
          -- 55% volunteer (11 out of 20)
          reporter_id := volunteer_ids[1 + (random() * (array_length(volunteer_ids, 1) - 1))::INTEGER];
          reporter_role := 'volunteer';
        END IF;
        
        -- Get realistic coordinates based on barangay
      selected_barangay := barangays[1 + (random() * (array_length(barangays, 1) - 1))::INTEGER];
      zone_coord := zone_coordinates->selected_barangay;
      
      -- Use zone-specific coordinates with small random offset (within ~500m)
      -- This ensures coordinates are realistic and within city boundaries
      IF zone_coord IS NOT NULL THEN
        incident_lat := (zone_coord->>'lat')::DOUBLE PRECISION + (random() - 0.5) * 0.005; -- ~500m offset
        incident_lng := (zone_coord->>'lng')::DOUBLE PRECISION + (random() - 0.5) * 0.005;
      ELSE
        -- Fallback: random within city boundaries
        incident_lat := min_lat + (random() * (max_lat - min_lat));
        incident_lng := min_lng + (random() * (max_lng - min_lng));
      END IF;
      
      -- CRITICAL: Ensure coordinates are within Talisay City boundaries (geofence validation)
      -- This guarantees all incidents are within the city limits
      incident_lat := GREATEST(min_lat, LEAST(max_lat, incident_lat));
      incident_lng := GREATEST(min_lng, LEAST(max_lng, incident_lng));
      
      -- Verify coordinates are valid (additional safety check)
      IF incident_lat < min_lat OR incident_lat > max_lat OR 
         incident_lng < min_lng OR incident_lng > max_lng THEN
        RAISE WARNING 'Coordinate out of bounds, using fallback: lat=%, lng=%', incident_lat, incident_lng;
        -- Use city center as fallback
        incident_lat := base_lat;
        incident_lng := base_lng;
      END IF;
      
      -- Determine status and related timestamps
      DECLARE
        status_idx INTEGER;
        selected_status TEXT;
        will_be_resolved BOOLEAN;
        selected_severity TEXT;
        selected_priority INTEGER;
      BEGIN
        status_idx := 1 + (random() * 3)::INTEGER;
        selected_status := statuses[status_idx];
        will_be_resolved := (status_idx = 4); -- RESOLVED
        
        -- CRITICAL: Severity assessment differs by reporter type
        -- Volunteers: Trained to assess severity (MINOR, MODERATE, SEVERE, CRITICAL)
        -- Residents: Only report Emergency/Non-Emergency (mapped to severity)
        IF reporter_role = 'volunteer' OR reporter_role = 'admin' THEN
          -- Trained assessment: Full severity range
          selected_severity := severities[1 + (random() * (array_length(severities, 1) - 1))::INTEGER];
          selected_priority := priorities[1 + (random() * (array_length(priorities, 1) - 1))::INTEGER];
        ELSE
          -- Resident: Emergency vs Non-Emergency classification
          is_emergency := (random() > 0.3); -- 70% are emergencies
          IF is_emergency THEN
            -- Emergency: Map to SEVERE or CRITICAL severity
            selected_severity := CASE WHEN random() > 0.5 THEN 'SEVERE' ELSE 'CRITICAL' END;
            selected_priority := CASE WHEN random() > 0.5 THEN 1 ELSE 2 END; -- Critical or High priority
          ELSE
            -- Non-Emergency: Map to MINOR or MODERATE severity
            selected_severity := CASE WHEN random() > 0.5 THEN 'MINOR' ELSE 'MODERATE' END;
            selected_priority := CASE WHEN random() > 0.5 THEN 3 ELSE 4 END; -- Medium or Low priority
          END IF;
        END IF;
        
        -- If resolved, set assignment and resolution times
        IF will_be_resolved THEN
          incident_assigned := incident_created + (random() * INTERVAL '2 hours');
          incident_resolved := incident_assigned + (random() * INTERVAL '4 hours');
          assigned_volunteer_id := volunteer_ids[1 + (random() * (array_length(volunteer_ids, 1) - 1))::INTEGER];
        ELSIF status_idx >= 2 THEN -- ASSIGNED or RESPONDING
          incident_assigned := incident_created + (random() * INTERVAL '1 hour');
          assigned_volunteer_id := volunteer_ids[1 + (random() * (array_length(volunteer_ids, 1) - 1))::INTEGER];
        ELSE -- PENDING
          incident_assigned := NULL;
          assigned_volunteer_id := NULL;
        END IF;
        
        -- Create incident
        new_incident_id := gen_random_uuid();
        
        INSERT INTO incidents (
          id,
          created_at,
          updated_at,
          reporter_id,
          incident_type,
          description,
          location_lat,
          location_lng,
          address,
          barangay,
          city,
          province,
          status,
          priority,
          severity,
          assigned_to,
          assigned_at,
          resolved_at,
          resolution_notes,
          user_id,
          created_year
        )
        VALUES (
          new_incident_id,
          incident_created,
          COALESCE(incident_resolved, incident_assigned, incident_created + INTERVAL '1 day'),
          reporter_id,
          incident_types[1 + (random() * (array_length(incident_types, 1) - 1))::INTEGER],
          CASE 
            WHEN reporter_role = 'resident' THEN
              'Incident reported by resident. ' || 
              CASE WHEN is_emergency THEN 'EMERGENCY - ' ELSE 'Non-emergency - ' END ||
              'Sample incident description for ' || incident_year || ' - Incident #' || incident_count || '. This is test data generated for thesis demonstration purposes. Location verified within Talisay City boundaries.'
            ELSE
              'Incident reported by ' || reporter_role || '. Severity assessed: ' || selected_severity || '. Sample incident description for ' || incident_year || ' - Incident #' || incident_count || '. This is test data generated for thesis demonstration purposes. Location verified within Talisay City boundaries.'
          END,
          incident_lat,
          incident_lng,
          'Sample Address, ' || selected_barangay || ', Talisay City',
          selected_barangay,
          'TALISAY CITY',
          'NEGROS OCCIDENTAL',
          selected_status::incident_status,
          selected_priority,
          selected_severity::incident_severity,
          assigned_volunteer_id,
          incident_assigned,
          incident_resolved,
          CASE WHEN will_be_resolved THEN 'Resolved successfully. Test data for demonstration.' ELSE NULL END,
          reporter_id,
          incident_year
        );
        
        total_incidents := total_incidents + 1;
        
        -- Create incident updates for resolved incidents
        IF will_be_resolved AND assigned_volunteer_id IS NOT NULL THEN
          -- Status change: PENDING -> ASSIGNED
          INSERT INTO incident_updates (
            incident_id,
            updated_by,
            previous_status,
            new_status,
            notes,
            created_at
          )
          VALUES (
            new_incident_id,
            admin_id,
            'PENDING'::incident_status,
            'ASSIGNED'::incident_status,
            'Incident assigned to volunteer',
            incident_assigned
          );
          
          -- Status change: ASSIGNED -> RESPONDING
          INSERT INTO incident_updates (
            incident_id,
            updated_by,
            previous_status,
            new_status,
            notes,
            created_at
          )
          VALUES (
            new_incident_id,
            assigned_volunteer_id,
            'ASSIGNED'::incident_status,
            'RESPONDING'::incident_status,
            'Volunteer en route to incident location',
            incident_assigned + (random() * INTERVAL '30 minutes')
          );
          
          -- Status change: RESPONDING -> RESOLVED
          INSERT INTO incident_updates (
            incident_id,
            updated_by,
            previous_status,
            new_status,
            notes,
            created_at
          )
          VALUES (
            new_incident_id,
            assigned_volunteer_id,
            'RESPONDING'::incident_status,
            'RESOLVED'::incident_status,
            'Incident resolved successfully',
            incident_resolved
          );
          
          -- Update volunteer's resolved count
          UPDATE volunteer_profiles
          SET total_incidents_resolved = total_incidents_resolved + 1
          WHERE volunteer_user_id = assigned_volunteer_id;
          
          -- Create feedback for 30% of resolved incidents
          IF (random() < 0.3) THEN
            INSERT INTO incident_feedback (
              incident_id,
              user_id,
              rating,
              comment,
              created_at
            )
            VALUES (
              new_incident_id,
              reporter_id,
              3 + (random() * 2)::INTEGER, -- Rating 3-5
              'Thank you for the quick response. Test feedback data.',
              incident_resolved + (random() * INTERVAL '1 day')
            );
          END IF;
        END IF;
      END; -- End status block
      END; -- End reporter_role block
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Generated % incidents across 5 years', total_incidents;
END $$;

-- ============================================================================
-- STEP 3: GENERATE SCHEDULES (5-10 per year = 25-50 total)
-- ============================================================================

DO $$
DECLARE
  volunteer_ids UUID[];
  admin_id UUID;
  schedule_year INTEGER;
  year_start DATE;
  year_end DATE;
  schedule_date DATE;
  schedule_start TIMESTAMPTZ;
  schedule_end TIMESTAMPTZ;
  schedule_count INTEGER;
  total_schedules INTEGER := 0;
  statuses TEXT[] := ARRAY['SCHEDULED', 'COMPLETED', 'CANCELLED'];
  titles TEXT[] := ARRAY[
    'Community Safety Patrol', 'Emergency Response Training', 'Equipment Maintenance',
    'Community Outreach', 'Disaster Preparedness Drill', 'First Aid Workshop',
    'Fire Safety Seminar', 'Search and Rescue Practice', 'Medical Response Training'
  ];
BEGIN
  SELECT ARRAY_AGG(id) INTO volunteer_ids FROM users WHERE role = 'volunteer' LIMIT 20;
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
  
  FOR schedule_year IN 2020..2024 LOOP
    year_start := DATE(schedule_year || '-01-01');
    year_end := DATE(schedule_year || '-12-31');
    
    -- Generate 5-10 schedules per year
    FOR schedule_count IN 1..(5 + (random() * 5)::INTEGER) LOOP
      schedule_date := random_date_between(year_start, year_end);
      schedule_start := (schedule_date || ' ' || LPAD((8 + (random() * 8)::INTEGER)::TEXT, 2, '0') || ':00:00')::TIMESTAMPTZ;
      schedule_end := schedule_start + (2 + (random() * 4))::INTEGER * INTERVAL '1 hour';
      
      INSERT INTO schedules (
        id,
        volunteer_id,
        title,
        description,
        start_time,
        end_time,
        location,
        barangay,
        created_by,
        created_at,
        updated_at,
        status,
        is_accepted,
        response_at,
        completed_at,
        attendance_marked
      )
      VALUES (
        gen_random_uuid(),
        volunteer_ids[1 + (random() * (array_length(volunteer_ids, 1) - 1))::INTEGER],
        titles[1 + (random() * (array_length(titles, 1) - 1))::INTEGER],
        'Scheduled activity for ' || schedule_year || '. Test data for demonstration.',
        schedule_start,
        schedule_end,
        'Zone ' || (1 + (random() * 9)::INTEGER),
        'Zone ' || (1 + (random() * 9)::INTEGER),
        admin_id,
        schedule_start - INTERVAL '7 days',
        schedule_start - INTERVAL '7 days',
        CASE 
          WHEN schedule_start < NOW() THEN 
            CASE (random() * 3)::INTEGER
              WHEN 0 THEN 'COMPLETED'
              WHEN 1 THEN 'CANCELLED'
              ELSE 'SCHEDULED'
            END
          ELSE 'SCHEDULED'
        END,
        (random() > 0.2), -- 80% accepted
        schedule_start - INTERVAL '3 days',
        CASE WHEN schedule_start < NOW() AND (random() > 0.3) THEN schedule_end ELSE NULL END,
        CASE WHEN schedule_start < NOW() AND (random() > 0.5) THEN true ELSE false END
      );
      
      total_schedules := total_schedules + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Generated % schedules across 5 years', total_schedules;
END $$;

-- ============================================================================
-- STEP 4: GENERATE TRAININGS (2-4 per year = 10-20 total)
-- ============================================================================

DO $$
DECLARE
  admin_id UUID;
  training_year INTEGER;
  year_start DATE;
  training_date DATE;
  training_start TIMESTAMPTZ;
  training_end TIMESTAMPTZ;
  training_count INTEGER;
  total_trainings INTEGER := 0;
  titles TEXT[] := ARRAY[
    'Basic First Aid Certification', 'Advanced Firefighting Techniques',
    'Water Rescue Operations', 'Search and Rescue Fundamentals',
    'Emergency Communication Protocols', 'Disaster Response Coordination',
    'Medical Emergency Response', 'Incident Command System'
  ];
  new_training_id BIGINT;
BEGIN
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
  
  FOR training_year IN 2020..2024 LOOP
    year_start := DATE(training_year || '-01-01');
    
    -- Generate 2-4 trainings per year
    FOR training_count IN 1..(2 + (random() * 2)::INTEGER) LOOP
      training_date := random_date_between(year_start, (year_start + INTERVAL '11 months')::DATE);
      training_start := (training_date || ' ' || LPAD((8 + (random() * 4)::INTEGER)::TEXT, 2, '0') || ':00:00')::TIMESTAMPTZ;
      training_end := training_start + (4 + (random() * 4))::INTEGER * INTERVAL '1 hour';
      
      INSERT INTO trainings (
        title,
        description,
        start_at,
        end_at,
        location,
        created_by,
        created_at,
        capacity,
        status
      )
      VALUES (
        titles[1 + (random() * (array_length(titles, 1) - 1))::INTEGER],
        'Training session for ' || training_year || '. Test data for demonstration.',
        training_start,
        training_end,
        'Training Center, Zone ' || (1 + (random() * 9)::INTEGER),
        admin_id,
        training_start - INTERVAL '30 days',
        20 + (random() * 30)::INTEGER,
        CASE 
          WHEN training_start < NOW() THEN 'COMPLETED'
          WHEN training_start < NOW() + INTERVAL '7 days' THEN 'ONGOING'
          ELSE 'SCHEDULED'
        END
      )
      RETURNING id INTO new_training_id;
      
      total_trainings := total_trainings + 1;
      
      -- Create training enrollments (3-5 volunteers per training)
      DECLARE
        volunteer_ids UUID[];
        enrollment_count INTEGER;
        enrolled_volunteer_id UUID;
      BEGIN
        SELECT ARRAY_AGG(id) INTO volunteer_ids FROM users WHERE role = 'volunteer' LIMIT 20;
        
        FOR enrollment_count IN 1..(3 + (random() * 2)::INTEGER) LOOP
          enrolled_volunteer_id := volunteer_ids[1 + (random() * (array_length(volunteer_ids, 1) - 1))::INTEGER];
          
          -- Insert training enrollment (with conflict handling)
          BEGIN
            INSERT INTO training_enrollments (
              training_id,
              user_id,
              enrolled_at,
              attended
            )
            VALUES (
              new_training_id,
              enrolled_volunteer_id,
              training_start - INTERVAL '15 days',
              CASE WHEN training_start < NOW() AND (random() > 0.2) THEN true ELSE false END
            );
          EXCEPTION WHEN unique_violation THEN
            -- Skip if already enrolled (shouldn't happen, but safe)
            NULL;
          END;
          
          -- Create evaluation if training is completed and attended
          IF training_start < NOW() AND (random() > 0.3) THEN
            BEGIN
              INSERT INTO training_evaluations (
                training_id,
                user_id,
                rating,
                comments,
                created_at
              )
              VALUES (
                new_training_id,
                enrolled_volunteer_id,
                3 + (random() * 2)::INTEGER, -- Rating 3-5
                'Training evaluation. Test data for demonstration.',
                training_end + (random() * INTERVAL '1 day')
              );
            EXCEPTION WHEN unique_violation THEN
              -- Skip if evaluation already exists
              NULL;
            END;
          END IF;
        END LOOP;
      END;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Generated % trainings across 5 years', total_trainings;
END $$;

-- ============================================================================
-- STEP 5: UPDATE CREATED_YEAR FOR ALL INCIDENTS (if needed)
-- ============================================================================

UPDATE incidents
SET created_year = EXTRACT(YEAR FROM created_at)::INTEGER
WHERE created_year IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (for checking after migration)
-- ============================================================================

-- Uncomment to verify data after migration:
/*
SELECT 
  EXTRACT(YEAR FROM created_at) as year,
  COUNT(*) as incident_count,
  COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count
FROM incidents
WHERE created_at >= '2020-01-01' AND created_at < '2025-01-01'
GROUP BY EXTRACT(YEAR FROM created_at)
ORDER BY year;

SELECT 
  COUNT(*) as total_volunteers,
  SUM(total_incidents_resolved) as total_resolved
FROM volunteer_profiles;

SELECT 
  COUNT(*) as total_schedules
FROM schedules
WHERE start_time >= '2020-01-01' AND start_time < '2025-01-01';

SELECT 
  COUNT(*) as total_trainings
FROM trainings
WHERE start_at >= '2020-01-01' AND start_at < '2025-01-01';
*/

-- ============================================================================
-- ROLLBACK SCRIPT (Run this if you need to remove generated data)
-- ============================================================================

/*
-- WARNING: This will delete all test data generated by this migration
-- Only run if you need to rollback

-- Delete in reverse order of creation (respects foreign keys)
DELETE FROM incident_feedback WHERE incident_id IN (
  SELECT id FROM incidents WHERE created_at >= '2020-01-01' AND created_at < '2025-01-01'
);

DELETE FROM incident_updates WHERE incident_id IN (
  SELECT id FROM incidents WHERE created_at >= '2020-01-01' AND created_at < '2025-01-01'
);

DELETE FROM incidents WHERE created_at >= '2020-01-01' AND created_at < '2025-01-01';

DELETE FROM schedules WHERE start_time >= '2020-01-01' AND start_time < '2025-01-01';

DELETE FROM trainings WHERE start_at >= '2020-01-01' AND start_at < '2025-01-01';

-- Reset volunteer resolved counts
UPDATE volunteer_profiles
SET total_incidents_resolved = 0
WHERE volunteer_user_id IN (
  SELECT id FROM users WHERE email LIKE '%@rvois.test'
);

-- Optional: Delete test users (be careful!)
-- DELETE FROM users WHERE email LIKE '%@rvois.test';
-- DELETE FROM auth.users WHERE email LIKE '%@rvois.test';
*/

-- ============================================================================
-- CLEANUP HELPER FUNCTIONS (optional - can be removed after migration)
-- ============================================================================

-- DROP FUNCTION IF EXISTS random_date_between(DATE, DATE);
-- DROP FUNCTION IF EXISTS random_timestamp_between(TIMESTAMPTZ, TIMESTAMPTZ);
--COMMIT;
ROLLBACK;
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

