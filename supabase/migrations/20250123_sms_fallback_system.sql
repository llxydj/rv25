-- SMS Fallback System Database Schema
-- This migration creates the necessary tables for SMS logging, templates, and monitoring

-- SMS Templates Table
CREATE TABLE IF NOT EXISTS sms_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Logs Table
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    reference_id VARCHAR(10) NOT NULL,
    trigger_source VARCHAR(50) NOT NULL,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_masked VARCHAR(20) NOT NULL,
    template_code VARCHAR(50) NOT NULL,
    message_content TEXT NOT NULL,
    timestamp_sent TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    api_response_status VARCHAR(20) DEFAULT 'PENDING',
    delivery_status VARCHAR(20) DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SUCCESS', 'FAILED', 'RETRY')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    api_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Delivery Tracking Table
CREATE TABLE IF NOT EXISTS sms_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sms_log_id UUID NOT NULL REFERENCES sms_logs(id) ON DELETE CASCADE,
    delivery_attempt INTEGER DEFAULT 1,
    attempt_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    api_response JSONB,
    delivery_status VARCHAR(20) DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Rate Limiting Table
CREATE TABLE IF NOT EXISTS sms_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number_hash VARCHAR(64) NOT NULL,
    minute_count INTEGER DEFAULT 0,
    hour_count INTEGER DEFAULT 0,
    last_reset_minute TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Configuration Table
CREATE TABLE IF NOT EXISTS sms_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    config_key VARCHAR(50) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default SMS templates
INSERT INTO sms_templates (code, name, content, variables, is_active) VALUES
('TEMPLATE_INCIDENT_CONFIRM', 'Incident Confirmation', '[RVOIS CONFIRM] Report #{{ref}} received | {{barangay}} | {{time}} | Thank you for reporting.', ARRAY['ref', 'barangay', 'time'], true),
('TEMPLATE_INCIDENT_ASSIGN', 'Incident Assignment', '[RVOIS ALERT] Incident #{{ref}} | {{type}} | {{barangay}} | {{time}} | Confirm response via app.', ARRAY['ref', 'type', 'barangay', 'time'], true),
('TEMPLATE_ADMIN_CRITICAL', 'Admin Critical Alert', '[RVOIS CRITICAL] {{type}} reported | {{barangay}} | {{time}} | Verify in system.', ARRAY['type', 'barangay', 'time'], true),
('TEMPLATE_BARANGAY_ALERT', 'Barangay Alert', '[RVOIS BARANGAY] {{type}} in {{barangay}} | {{time}} | Check system for details.', ARRAY['type', 'barangay', 'time'], true),
('TEMPLATE_VOLUNTEER_FALLBACK', 'Volunteer Fallback', '[RVOIS FALLBACK] Incident #{{ref}} | {{type}} | {{barangay}} | {{time}} | Push notification failed, responding via SMS.', ARRAY['ref', 'type', 'barangay', 'time'], true),
('TEMPLATE_VOLUNTEER_OTW', 'Volunteer On The Way', '[RVOIS OTW] Volunteer {{volunteer}} responding to incident #{{ref}} | {{barangay}} | {{time}}', ARRAY['ref', 'volunteer', 'barangay', 'time'], true),
('TEMPLATE_INCIDENT_RESOLVED', 'Incident Resolved', '[RVOIS RESOLVED] Incident #{{ref}} resolved by {{volunteer}} | {{barangay}} | {{time}}', ARRAY['ref', 'volunteer', 'barangay', 'time'], true),
('TEMPLATE_ADMIN_VOLUNTEER_OTW', 'Admin Volunteer OTW', '[RVOIS ADMIN] Volunteer {{volunteer}} responding to incident #{{ref}} in {{barangay}} | {{time}}', ARRAY['ref', 'volunteer', 'barangay', 'time'], true),
('TEMPLATE_ADMIN_INCIDENT_RESOLVED', 'Admin Incident Resolved', '[RVOIS ADMIN] Incident {{incident}} resolved by {{volunteer}} in {{barangay}} | {{time}}', ARRAY['incident', 'volunteer', 'barangay', 'time'], true)
ON CONFLICT (code) DO NOTHING;

-- Insert default SMS configuration
INSERT INTO sms_config (config_key, config_value, description, is_active) VALUES
('SMS_ENABLED', 'true', 'Enable/disable SMS service', true),
('SMS_RATE_LIMIT_MINUTE', '10', 'Maximum SMS per minute per phone number', true),
('SMS_RATE_LIMIT_HOUR', '100', 'Maximum SMS per hour per phone number', true),
('SMS_RETRY_ATTEMPTS', '1', 'Number of retry attempts for failed SMS', true),
('SMS_RETRY_DELAY_MS', '5000', 'Delay between retry attempts in milliseconds', true),
('SMS_SENDER', 'iprogsms', 'SMS sender identifier', true),
('SMS_API_URL', 'https://sms.iprogtech.com/api/v1/sms_messages', 'SMS API endpoint URL', true)
ON CONFLICT (config_key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_incident_id ON sms_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_user_id ON sms_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_timestamp_sent ON sms_logs(timestamp_sent);
CREATE INDEX IF NOT EXISTS idx_sms_logs_delivery_status ON sms_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_trigger_source ON sms_logs(trigger_source);
CREATE INDEX IF NOT EXISTS idx_sms_logs_reference_id ON sms_logs(reference_id);

CREATE INDEX IF NOT EXISTS idx_sms_deliveries_sms_log_id ON sms_deliveries(sms_log_id);
CREATE INDEX IF NOT EXISTS idx_sms_deliveries_delivery_status ON sms_deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_sms_deliveries_attempt_timestamp ON sms_deliveries(attempt_timestamp);

CREATE INDEX IF NOT EXISTS idx_sms_rate_limits_phone_hash ON sms_rate_limits(phone_number_hash);
CREATE INDEX IF NOT EXISTS idx_sms_rate_limits_last_reset ON sms_rate_limits(last_reset_minute, last_reset_hour);

CREATE INDEX IF NOT EXISTS idx_sms_templates_code ON sms_templates(code);
CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON sms_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_sms_config_key ON sms_config(config_key);
CREATE INDEX IF NOT EXISTS idx_sms_config_active ON sms_config(is_active);

-- Create RLS policies for SMS tables
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_config ENABLE ROW LEVEL SECURITY;

-- SMS Templates policies
DROP POLICY IF EXISTS "SMS templates are viewable by authenticated users" ON sms_templates;
CREATE POLICY "SMS templates are viewable by authenticated users" ON sms_templates
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "SMS templates are manageable by admins" ON sms_templates;
CREATE POLICY "SMS templates are manageable by admins" ON sms_templates
    FOR ALL USING (auth.role() = 'admin');

-- SMS Logs policies
DROP POLICY IF EXISTS "SMS logs are viewable by admins" ON sms_logs;
CREATE POLICY "SMS logs are viewable by admins" ON sms_logs
    FOR SELECT USING (auth.role() = 'admin');

DROP POLICY IF EXISTS "SMS logs are insertable by service role" ON sms_logs;
CREATE POLICY "SMS logs are insertable by service role" ON sms_logs
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "SMS logs are updatable by service role" ON sms_logs;
CREATE POLICY "SMS logs are updatable by service role" ON sms_logs
    FOR UPDATE USING (true);

-- SMS Deliveries policies
DROP POLICY IF EXISTS "SMS deliveries are viewable by admins" ON sms_deliveries;
CREATE POLICY "SMS deliveries are viewable by admins" ON sms_deliveries
    FOR SELECT USING (auth.role() = 'admin');

DROP POLICY IF EXISTS "SMS deliveries are insertable by service role" ON sms_deliveries;
CREATE POLICY "SMS deliveries are insertable by service role" ON sms_deliveries
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "SMS deliveries are updatable by service role" ON sms_deliveries;
CREATE POLICY "SMS deliveries are updatable by service role" ON sms_deliveries
    FOR UPDATE USING (true);

-- SMS Rate Limits policies
DROP POLICY IF EXISTS "SMS rate limits are manageable by service role" ON sms_rate_limits;
CREATE POLICY "SMS rate limits are manageable by service role" ON sms_rate_limits
    FOR ALL USING (true);

-- SMS Config policies
DROP POLICY IF EXISTS "SMS config is viewable by admins" ON sms_config;
CREATE POLICY "SMS config is viewable by admins" ON sms_config
    FOR SELECT USING (auth.role() = 'admin');

DROP POLICY IF EXISTS "SMS config is manageable by admins" ON sms_config;
CREATE POLICY "SMS config is manageable by admins" ON sms_config
    FOR ALL USING (auth.role() = 'admin');

-- Create functions for SMS operations
CREATE OR REPLACE FUNCTION cleanup_old_sms_logs()
RETURNS void AS $$
BEGIN
    -- Delete SMS logs older than 90 days
    DELETE FROM sms_logs 
    WHERE timestamp_sent < NOW() - INTERVAL '90 days';
    
    -- Delete SMS deliveries older than 90 days
    DELETE FROM sms_deliveries 
    WHERE attempt_timestamp < NOW() - INTERVAL '90 days';
    
    -- Delete old rate limit records
    DELETE FROM sms_rate_limits 
    WHERE last_reset_hour < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create function to get SMS statistics
CREATE OR REPLACE FUNCTION get_sms_statistics()
RETURNS TABLE (
    total_sent BIGINT,
    success_count BIGINT,
    failure_count BIGINT,
    success_rate NUMERIC,
    failure_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE delivery_status = 'SUCCESS') as success_count,
        COUNT(*) FILTER (WHERE delivery_status = 'FAILED') as failure_count,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE delivery_status = 'SUCCESS')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0 
        END as success_rate,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE delivery_status = 'FAILED')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0 
        END as failure_rate
    FROM sms_logs
    WHERE timestamp_sent >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to check SMS rate limits
CREATE OR REPLACE FUNCTION check_sms_rate_limit(phone_hash VARCHAR(64))
RETURNS BOOLEAN AS $$
DECLARE
    current_minute_count INTEGER;
    current_hour_count INTEGER;
    minute_limit INTEGER;
    hour_limit INTEGER;
BEGIN
    -- Get rate limits from config
    SELECT config_value::INTEGER INTO minute_limit FROM sms_config WHERE config_key = 'SMS_RATE_LIMIT_MINUTE';
    SELECT config_value::INTEGER INTO hour_limit FROM sms_config WHERE config_key = 'SMS_RATE_LIMIT_HOUR';
    
    -- Get current counts
    SELECT minute_count, hour_count INTO current_minute_count, current_hour_count
    FROM sms_rate_limits 
    WHERE phone_number_hash = phone_hash;
    
    -- If no record exists, create one
    IF current_minute_count IS NULL THEN
        INSERT INTO sms_rate_limits (phone_number_hash, minute_count, hour_count)
        VALUES (phone_hash, 0, 0);
        current_minute_count := 0;
        current_hour_count := 0;
    END IF;
    
    -- Check limits
    IF current_minute_count >= minute_limit OR current_hour_count >= hour_limit THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment SMS rate limit
CREATE OR REPLACE FUNCTION increment_sms_rate_limit(phone_hash VARCHAR(64))
RETURNS void AS $$
BEGIN
    INSERT INTO sms_rate_limits (phone_number_hash, minute_count, hour_count)
    VALUES (phone_hash, 1, 1)
    ON CONFLICT (phone_number_hash) 
    DO UPDATE SET 
        minute_count = sms_rate_limits.minute_count + 1,
        hour_count = sms_rate_limits.hour_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sms_templates_updated_at
    BEFORE UPDATE ON sms_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_rate_limits_updated_at
    BEFORE UPDATE ON sms_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_config_updated_at
    BEFORE UPDATE ON sms_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for SMS dashboard
CREATE OR REPLACE VIEW sms_dashboard_stats AS
SELECT 
    DATE(timestamp_sent) as date,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE delivery_status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE delivery_status = 'FAILED') as failure_count,
    COUNT(*) FILTER (WHERE delivery_status = 'PENDING') as pending_count,
    ROUND(AVG(CASE WHEN delivery_status = 'SUCCESS' THEN 1 ELSE 0 END) * 100, 2) as success_rate
FROM sms_logs
WHERE timestamp_sent >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp_sent)
ORDER BY date DESC;

-- Grant permissions
GRANT SELECT ON sms_dashboard_stats TO authenticated;
GRANT ALL ON sms_templates TO authenticated;
GRANT SELECT ON sms_logs TO authenticated;
GRANT SELECT ON sms_deliveries TO authenticated;
GRANT SELECT ON sms_config TO authenticated;

-- Create cleanup job (this would typically be set up as a cron job)
-- SELECT cron.schedule('cleanup-sms-logs', '0 2 * * *', 'SELECT cleanup_old_sms_logs();');
