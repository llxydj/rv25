-- Add SMS templates for status updates
-- This migration adds new SMS templates for volunteer status updates

INSERT INTO sms_templates (code, name, content, variables, is_active) VALUES
('TEMPLATE_VOLUNTEER_OTW', 'Volunteer On The Way', '[RVOIS OTW] Volunteer {{volunteer}} responding to incident #{{ref}} | {{barangay}} | {{time}}', ARRAY['ref', 'volunteer', 'barangay', 'time'], true),
('TEMPLATE_INCIDENT_RESOLVED', 'Incident Resolved', '[RVOIS RESOLVED] Incident #{{ref}} resolved by {{volunteer}} | {{barangay}} | {{time}}', ARRAY['ref', 'volunteer', 'barangay', 'time'], true),
('TEMPLATE_ADMIN_VOLUNTEER_OTW', 'Admin Volunteer OTW', '[RVOIS ADMIN] Volunteer {{volunteer}} responding to incident #{{ref}} in {{barangay}} | {{time}}', ARRAY['ref', 'volunteer', 'barangay', 'time'], true),
('TEMPLATE_ADMIN_INCIDENT_RESOLVED', 'Admin Incident Resolved', '[RVOIS ADMIN] Incident {{incident}} resolved by {{volunteer}} in {{barangay}} | {{time}}', ARRAY['incident', 'volunteer', 'barangay', 'time'], true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();