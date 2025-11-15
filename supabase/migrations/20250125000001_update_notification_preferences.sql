-- Update notification_preferences table to match the component structure

-- Add missing columns
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS escalation_alerts BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT,
ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT;

-- Update existing data to use new column names
UPDATE notification_preferences 
SET push_enabled = push,
    sms_enabled = FALSE,
    email_enabled = TRUE,
    escalation_alerts = TRUE
WHERE push_enabled IS NULL;

-- Drop old columns (optional, can be done later)
-- ALTER TABLE notification_preferences DROP COLUMN IF EXISTS push;
-- ALTER TABLE notification_preferences DROP COLUMN IF EXISTS sound;
-- ALTER TABLE notification_preferences DROP COLUMN IF EXISTS vibration;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_push_enabled ON notification_preferences(push_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_sms_enabled ON notification_preferences(sms_enabled);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_email_enabled ON notification_preferences(email_enabled);