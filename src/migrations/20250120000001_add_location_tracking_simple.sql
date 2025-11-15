-- Add location tracking tables (simplified version without update_timestamp function)

-- Location tracking table
CREATE TABLE location_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Location preferences table
CREATE TABLE location_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  accuracy TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_location_tracking_user_id ON location_tracking(user_id);
CREATE INDEX idx_location_tracking_timestamp ON location_tracking(timestamp);
CREATE INDEX idx_location_tracking_coordinates ON location_tracking(latitude, longitude);
CREATE INDEX idx_location_preferences_user_id ON location_preferences(user_id);

-- Enable RLS
ALTER TABLE location_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for location_tracking
CREATE POLICY "Users can view their own location data" ON location_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own location data" ON location_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all location data" ON location_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for location_preferences
CREATE POLICY "Users can manage their own location preferences" ON location_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all location preferences" ON location_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to get volunteers within radius
CREATE OR REPLACE FUNCTION get_volunteers_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION
)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.phone_number,
    lt.latitude,
    lt.longitude,
    (6371 * acos(
      cos(radians(center_lat)) * 
      cos(radians(lt.latitude)) * 
      cos(radians(lt.longitude) - radians(center_lng)) + 
      sin(radians(center_lat)) * 
      sin(radians(lt.latitude))
    )) as distance_km,
    lt.timestamp as last_seen
  FROM users u
  JOIN volunteer_profiles vp ON u.id = vp.volunteer_user_id
  JOIN LATERAL (
    SELECT latitude, longitude, timestamp
    FROM location_tracking lt2
    WHERE lt2.user_id = u.id
    ORDER BY lt2.timestamp DESC
    LIMIT 1
  ) lt ON true
  WHERE u.role = 'volunteer'
    AND vp.status = 'ACTIVE'
    AND vp.is_available = true
    AND (6371 * acos(
      cos(radians(center_lat)) * 
      cos(radians(lt.latitude)) * 
      cos(radians(lt.longitude) - radians(center_lng)) + 
      sin(radians(center_lat)) * 
      sin(radians(lt.latitude))
    )) <= radius_km
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old location data (keep only last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_location_data()
RETURNS void AS $$
BEGIN
  DELETE FROM location_tracking 
  WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
