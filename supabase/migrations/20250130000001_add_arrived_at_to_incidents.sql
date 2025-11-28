-- Add arrived_at timestamp to incidents table for arrival tracking
-- This allows automatic timestamping when volunteer arrives at scene

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS arrived_at timestamp with time zone;

-- Create index for faster queries on arrival times
CREATE INDEX IF NOT EXISTS idx_incidents_arrived_at
ON public.incidents(arrived_at);

-- Add comment
COMMENT ON COLUMN public.incidents.arrived_at IS 'Timestamp when volunteer arrived at incident location. Auto-set when status changes to ARRIVED.';

