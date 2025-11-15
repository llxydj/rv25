-- Add unique index to prevent duplicate emergency contacts by name+number (case-insensitive name)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS emergency_contacts_name_number_unique
ON public.emergency_contacts (lower(name), number);
