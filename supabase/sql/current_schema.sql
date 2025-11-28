-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  folder_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_documents_pkey PRIMARY KEY (id),
  CONSTRAINT admin_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.announcement_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcement_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT announcement_feedback_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id),
  CONSTRAINT announcement_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'GENERAL'::text CHECK (type = ANY (ARRAY['TRAINING'::text, 'MEETING'::text, 'ALERT'::text, 'GENERAL'::text])),
  priority text NOT NULL DEFAULT 'LOW'::text CHECK (priority = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'CRITICAL'::text])),
  location text,
  date date,
  time text,
  requirements ARRAY,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  facebook_post_url text,
  facebook_embed_data jsonb,
  source_type text DEFAULT 'MANUAL'::text CHECK (source_type = ANY (ARRAY['MANUAL'::text, 'FACEBOOK'::text])),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.auto_archive_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT false,
  schedule_frequency text DEFAULT 'daily'::text,
  schedule_time time without time zone DEFAULT '02:00:00'::time without time zone,
  last_run timestamp with time zone,
  next_run timestamp with time zone,
  years_old integer DEFAULT 2,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT auto_archive_schedule_pkey PRIMARY KEY (id)
);
CREATE TABLE public.barangays (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  boundaries jsonb,
  CONSTRAINT barangays_pkey PRIMARY KEY (id)
);
CREATE TABLE public.call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id text NOT NULL,
  contact_name text NOT NULL,
  contact_number text NOT NULL,
  call_type text NOT NULL CHECK (call_type = ANY (ARRAY['emergency'::text, 'incident'::text, 'volunteer'::text, 'reporter'::text, 'admin'::text])),
  incident_id uuid,
  duration integer,
  status text NOT NULL DEFAULT 'initiated'::text CHECK (status = ANY (ARRAY['initiated'::text, 'connected'::text, 'missed'::text, 'failed'::text, 'completed'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT call_logs_pkey PRIMARY KEY (id),
  CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT call_logs_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id)
);
CREATE TABLE public.call_preferences (
  user_id uuid NOT NULL,
  favorite_contacts ARRAY NOT NULL DEFAULT '{}'::text[],
  auto_log_calls boolean NOT NULL DEFAULT true,
  call_reminders boolean NOT NULL DEFAULT true,
  emergency_shortcut text NOT NULL DEFAULT '911'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT call_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT call_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.emergency_contacts (
  id text NOT NULL,
  name text NOT NULL,
  number text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['emergency'::text, 'fire'::text, 'police'::text, 'medical'::text, 'disaster'::text, 'admin'::text, 'utility'::text])),
  priority integer NOT NULL DEFAULT 1,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feedback (
  id bigint NOT NULL DEFAULT nextval('feedback_id_seq'::regclass),
  incident_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  thumbs_up boolean,
  comment text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id)
);
CREATE TABLE public.geofence_boundaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  boundary_type text NOT NULL CHECK (boundary_type = ANY (ARRAY['city'::text, 'barangay'::text, 'zone'::text, 'radius'::text])),
  geometry jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT geofence_boundaries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.incident_feedback (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  incident_id uuid NOT NULL,
  user_id uuid,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT incident_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT incident_feedback_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id),
  CONSTRAINT incident_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.incident_handoffs (
  id bigint NOT NULL DEFAULT nextval('incident_handoffs_id_seq'::regclass),
  incident_id uuid NOT NULL,
  from_lgu text NOT NULL,
  to_lgu text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT incident_handoffs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.incident_reference_ids (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL UNIQUE,
  reference_id text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incident_reference_ids_pkey PRIMARY KEY (id),
  CONSTRAINT fk_incident_reference_ids_incident_id FOREIGN KEY (incident_id) REFERENCES public.incidents(id)
);
CREATE TABLE public.incident_updates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  incident_id uuid,
  updated_by uuid,
  previous_status USER-DEFINED,
  new_status USER-DEFINED,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incident_updates_pkey PRIMARY KEY (id),
  CONSTRAINT incident_updates_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id),
  CONSTRAINT incident_updates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.incident_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  user_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incident_views_pkey PRIMARY KEY (id),
  CONSTRAINT fk_incident_views_incident_id FOREIGN KEY (incident_id) REFERENCES public.incidents(id),
  CONSTRAINT fk_incident_views_user_id FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.incidents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  reporter_id uuid,
  incident_type text NOT NULL,
  description text NOT NULL,
  location_lat double precision NOT NULL,
  location_lng double precision NOT NULL,
  address text,
  barangay text NOT NULL,
  city text DEFAULT 'TALISAY CITY'::text,
  province text DEFAULT 'NEGROS OCCIDENTAL'::text,
  status USER-DEFINED DEFAULT 'PENDING'::incident_status,
  priority integer DEFAULT 3,
  photo_url text,
  assigned_to uuid,
  assigned_at timestamp with time zone,
  resolved_at timestamp with time zone,
  resolution_notes text,
  user_id uuid,
  severity USER-DEFINED DEFAULT 'MODERATE'::incident_severity,
  created_year integer,
  photo_urls ARRAY DEFAULT '{}'::text[],
  voice_url text,
  CONSTRAINT incidents_pkey PRIMARY KEY (id),
  CONSTRAINT incidents_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id),
  CONSTRAINT incidents_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
  CONSTRAINT incidents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.lgu_contacts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agency_name text NOT NULL,
  contact_person text,
  contact_number text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lgu_contacts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.location_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE,
  enabled boolean DEFAULT false,
  accuracy text DEFAULT 'medium'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  share_with_public boolean DEFAULT false,
  CONSTRAINT location_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT location_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE,
  push boolean DEFAULT true,
  sound boolean DEFAULT true,
  vibration boolean DEFAULT true,
  incident_alerts boolean DEFAULT true,
  status_updates boolean DEFAULT true,
  training_reminders boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  push_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  email_enabled boolean DEFAULT true,
  escalation_alerts boolean DEFAULT true,
  quiet_hours_start text,
  quiet_hours_end text,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL,
  data jsonb,
  read_at timestamp with time zone,
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'UNREAD'::text CHECK (status = ANY (ARRAY['UNREAD'::text, 'READ'::text, 'ARCHIVED'::text])),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.pin_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 1,
  last_attempt_at timestamp with time zone DEFAULT now(),
  locked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pin_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT pin_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  subscription_hash text DEFAULT md5((subscription)::text),
  endpoint text,
  p256dh text,
  auth text,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  title text NOT NULL,
  report_type USER-DEFINED NOT NULL,
  description text NOT NULL,
  incident_id uuid,
  created_by uuid NOT NULL,
  status USER-DEFINED DEFAULT 'SUBMITTED'::report_status,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  user_id uuid,
  archived boolean DEFAULT false,
  created_year integer,
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id),
  CONSTRAINT reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id),
  CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.scheduledactivities (
  schedule_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  volunteer_user_id uuid,
  created_by uuid,
  title text,
  description text,
  date date NOT NULL,
  time time without time zone,
  location text,
  is_accepted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  response_at timestamp with time zone,
  CONSTRAINT scheduledactivities_pkey PRIMARY KEY (schedule_id),
  CONSTRAINT scheduledactivities_volunteer_user_id_fkey FOREIGN KEY (volunteer_user_id) REFERENCES public.volunteer_profiles(volunteer_user_id),
  CONSTRAINT scheduledactivities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  volunteer_id uuid,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  location text,
  barangay text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'SCHEDULED'::text CHECK (status = ANY (ARRAY['SCHEDULED'::text, 'ONGOING'::text, 'COMPLETED'::text, 'CANCELLED'::text])),
  is_accepted boolean,
  response_at timestamp with time zone,
  completed_at timestamp with time zone,
  attendance_marked boolean DEFAULT false,
  attendance_notes text,
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_volunteer_id_fkey FOREIGN KEY (volunteer_id) REFERENCES public.users(id),
  CONSTRAINT schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.sms_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config_key character varying NOT NULL UNIQUE,
  config_value text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sms_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sms_log_id uuid NOT NULL,
  delivery_attempt integer DEFAULT 1,
  attempt_timestamp timestamp with time zone DEFAULT now(),
  api_response jsonb,
  delivery_status character varying DEFAULT 'PENDING'::character varying CHECK (delivery_status::text = ANY (ARRAY['PENDING'::character varying, 'SENT'::character varying, 'DELIVERED'::character varying, 'FAILED'::character varying, 'EXPIRED'::character varying]::text[])),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT sms_deliveries_sms_log_id_fkey FOREIGN KEY (sms_log_id) REFERENCES public.sms_logs(id)
);
CREATE TABLE public.sms_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  reference_id character varying NOT NULL,
  trigger_source character varying NOT NULL,
  recipient_user_id uuid NOT NULL,
  phone_masked character varying NOT NULL,
  template_code character varying NOT NULL,
  message_content text NOT NULL,
  timestamp_sent timestamp with time zone DEFAULT now(),
  api_response_status character varying DEFAULT 'PENDING'::character varying,
  delivery_status character varying DEFAULT 'PENDING'::character varying CHECK (delivery_status::text = ANY (ARRAY['PENDING'::character varying, 'SUCCESS'::character varying, 'FAILED'::character varying, 'RETRY'::character varying]::text[])),
  retry_count integer DEFAULT 0,
  error_message text,
  api_response jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_logs_pkey PRIMARY KEY (id),
  CONSTRAINT sms_logs_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id),
  CONSTRAINT sms_logs_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sms_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number_hash character varying NOT NULL,
  minute_count integer DEFAULT 0,
  hour_count integer DEFAULT 0,
  last_reset_minute timestamp with time zone DEFAULT now(),
  last_reset_hour timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_rate_limits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sms_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  content text NOT NULL,
  variables ARRAY DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sms_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.system_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action text NOT NULL,
  details text,
  user_id uuid,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_logs_pkey PRIMARY KEY (id),
  CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.training_enrollments (
  id bigint NOT NULL DEFAULT nextval('training_enrollments_id_seq'::regclass),
  training_id bigint NOT NULL,
  user_id uuid NOT NULL,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  attended boolean DEFAULT false,
  CONSTRAINT training_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT training_enrollments_training_id_fkey FOREIGN KEY (training_id) REFERENCES public.trainings(id),
  CONSTRAINT training_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.training_evaluations (
  id bigint NOT NULL DEFAULT nextval('training_evaluations_id_seq'::regclass),
  training_id bigint NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT training_evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT training_evaluations_training_id_fkey FOREIGN KEY (training_id) REFERENCES public.trainings(id)
);
CREATE TABLE public.training_evaluations_admin (
  id bigint NOT NULL DEFAULT nextval('training_evaluations_admin_id_seq'::regclass),
  training_id bigint NOT NULL,
  user_id uuid NOT NULL,
  evaluated_by uuid NOT NULL,
  performance_rating integer NOT NULL CHECK (performance_rating >= 1 AND performance_rating <= 5),
  skills_assessment jsonb,
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT training_evaluations_admin_pkey PRIMARY KEY (id),
  CONSTRAINT training_evaluations_admin_training_id_fkey FOREIGN KEY (training_id) REFERENCES public.trainings(id),
  CONSTRAINT training_evaluations_admin_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT training_evaluations_admin_evaluated_by_fkey FOREIGN KEY (evaluated_by) REFERENCES public.users(id)
);
CREATE TABLE public.trainings (
  id bigint NOT NULL DEFAULT nextval('trainings_id_seq'::regclass),
  title text NOT NULL,
  description text,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone,
  location text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  capacity integer,
  status text DEFAULT 'SCHEDULED'::text CHECK (status = ANY (ARRAY['SCHEDULED'::text, 'ONGOING'::text, 'COMPLETED'::text, 'CANCELLED'::text])),
  CONSTRAINT trainings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role USER-DEFINED NOT NULL,
  phone_number text,
  address text,
  barangay text,
  city text DEFAULT 'TALISAY CITY'::text,
  province text DEFAULT 'NEGROS OCCIDENTAL'::text,
  confirmation_phrase text,
  last_active timestamp with time zone DEFAULT now(),
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])),
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  profile_photo_url text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  pin_hash text,
  pin_enabled boolean DEFAULT true,
  profile_image text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.volunteer_activity_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  volunteer_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['profile_updated'::text, 'availability_changed'::text, 'incident_assigned'::text, 'incident_resolved'::text, 'document_uploaded'::text, 'photo_uploaded'::text, 'skills_updated'::text, 'status_changed'::text, 'training_completed'::text, 'other'::text])),
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT volunteer_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT volunteer_activity_logs_volunteer_id_fkey FOREIGN KEY (volunteer_id) REFERENCES public.users(id),
  CONSTRAINT volunteer_activity_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.volunteer_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  display_name text,
  CONSTRAINT volunteer_documents_pkey PRIMARY KEY (id),
  CONSTRAINT volunteer_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.volunteer_information (
  user_id uuid NOT NULL,
  joined_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  last_activity timestamp without time zone,
  is_active boolean DEFAULT false,
  bio text,
  skills text,
  documents text,
  verified boolean DEFAULT false,
  CONSTRAINT volunteer_information_pkey PRIMARY KEY (user_id),
  CONSTRAINT volunteer_information_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.volunteer_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  speed double precision,
  heading double precision,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_within_talisay_city boolean,
  CONSTRAINT volunteer_locations_pkey PRIMARY KEY (id),
  CONSTRAINT volunteer_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.volunteer_profiles (
  volunteer_user_id uuid NOT NULL,
  status USER-DEFINED DEFAULT 'ACTIVE'::volunteer_status,
  skills ARRAY,
  availability ARRAY,
  assigned_barangays ARRAY,
  total_incidents_resolved integer DEFAULT 0,
  notes text,
  admin_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_active_at timestamp with time zone DEFAULT now(),
  last_status_change timestamp with time zone,
  last_status_changed_by uuid,
  is_available boolean DEFAULT false,
  CONSTRAINT volunteer_profiles_pkey PRIMARY KEY (volunteer_user_id),
  CONSTRAINT volunteer_profiles_volunteer_user_id_fkey FOREIGN KEY (volunteer_user_id) REFERENCES public.users(id),
  CONSTRAINT volunteer_profiles_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id),
  CONSTRAINT volunteer_profiles_last_status_changed_by_fkey FOREIGN KEY (last_status_changed_by) REFERENCES public.users(id)
);
CREATE TABLE public.volunteer_real_time_status (
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'offline'::text CHECK (status = ANY (ARRAY['available'::text, 'on_task'::text, 'offline'::text, 'unavailable'::text])),
  status_message text,
  last_status_change timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT volunteer_real_time_status_pkey PRIMARY KEY (user_id),
  CONSTRAINT volunteer_real_time_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.volunteeractivities (
  activity_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  volunteer_user_id uuid,
  incident_id uuid,
  participated boolean DEFAULT false,
  notes text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 
CASE
    WHEN (resolved_at IS NOT NULL) THEN 'COMPLETED'::text
    WHEN (participated IS TRUE) THEN 'IN_PROGRESS'::text
    ELSE 'PENDING'::text
END,
  CONSTRAINT volunteeractivities_pkey PRIMARY KEY (activity_id),
  CONSTRAINT volunteeractivities_volunteer_user_id_fkey FOREIGN KEY (volunteer_user_id) REFERENCES public.volunteer_profiles(volunteer_user_id),
  CONSTRAINT volunteeractivities_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id)
);