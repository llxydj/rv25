-- Create emergency_contacts table
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id text NOT NULL,
    name text NOT NULL,
    number text NOT NULL,
    type text NOT NULL CHECK (type IN ('emergency', 'fire', 'police', 'medical', 'disaster', 'admin')),
    priority integer NOT NULL DEFAULT 1,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create primary key
ALTER TABLE public.emergency_contacts ADD CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id);

-- Create indexes
CREATE INDEX idx_emergency_contacts_type ON public.emergency_contacts(type);
CREATE INDEX idx_emergency_contacts_priority ON public.emergency_contacts(priority);
CREATE INDEX idx_emergency_contacts_active ON public.emergency_contacts(is_active);

-- Enable RLS
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for emergency_contacts
CREATE POLICY "Anyone can view active emergency contacts" ON public.emergency_contacts
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage emergency contacts" ON public.emergency_contacts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE public.users.id = auth.uid() 
            AND public.users.role = 'admin'
        )
    );

-- Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    contact_id text NOT NULL,
    contact_name text NOT NULL,
    contact_number text NOT NULL,
    call_type text NOT NULL CHECK (call_type IN ('emergency', 'incident', 'volunteer', 'reporter', 'admin')),
    incident_id uuid,
    duration integer,
    status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'connected', 'missed', 'failed', 'completed')),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create primary key
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);

-- Create foreign key constraints
ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_incident_id_fkey 
    FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idx_call_logs_user_id ON public.call_logs(user_id);
CREATE INDEX idx_call_logs_contact_id ON public.call_logs(contact_id);
CREATE INDEX idx_call_logs_call_type ON public.call_logs(call_type);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);
CREATE INDEX idx_call_logs_created_at ON public.call_logs(created_at DESC);
CREATE INDEX idx_call_logs_incident_id ON public.call_logs(incident_id);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_logs
CREATE POLICY "Users can view their own call logs" ON public.call_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call logs" ON public.call_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call logs" ON public.call_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all call logs" ON public.call_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE public.users.id = auth.uid() 
            AND public.users.role = 'admin'
        )
    );

-- Create call_preferences table
CREATE TABLE IF NOT EXISTS public.call_preferences (
    user_id uuid NOT NULL,
    favorite_contacts text[] DEFAULT '{}' NOT NULL,
    auto_log_calls boolean DEFAULT true NOT NULL,
    call_reminders boolean DEFAULT true NOT NULL,
    emergency_shortcut text DEFAULT '911' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create primary key
ALTER TABLE public.call_preferences ADD CONSTRAINT call_preferences_pkey PRIMARY KEY (user_id);

-- Create foreign key constraint
ALTER TABLE public.call_preferences ADD CONSTRAINT call_preferences_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.call_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_preferences
CREATE POLICY "Users can manage their own call preferences" ON public.call_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Insert default emergency contacts
INSERT INTO public.emergency_contacts (id, name, number, type, priority, description, is_active) VALUES
('emergency-911', 'Emergency Hotline', '911', 'emergency', 1, 'National emergency hotline', true),
('rvois-hotline', 'RVOIS Hotline', '09998064555', 'emergency', 2, 'RVOIS emergency response', true),
('fire-dept', 'Fire Department', '(034) 495-1234', 'fire', 3, 'Talisay City Fire Department', true),
('police-station', 'Police Station', '(034) 495-5678', 'police', 4, 'Talisay City Police Station', true),
('disaster-risk', 'City Disaster Risk Reduction', '(034) 495-9999', 'disaster', 5, 'CDRRMO Talisay City', true),
('health-office', 'City Health Office', '(034) 495-1111', 'medical', 6, 'Talisay City Health Office', true)
ON CONFLICT (id) DO NOTHING;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_call_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_emergency_contacts_updated_at
    BEFORE UPDATE ON public.emergency_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_call_tables_timestamp();

CREATE TRIGGER update_call_logs_updated_at
    BEFORE UPDATE ON public.call_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_call_tables_timestamp();

CREATE TRIGGER update_call_preferences_updated_at
    BEFORE UPDATE ON public.call_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_call_tables_timestamp();
