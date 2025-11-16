-- Add pin_hash column to users table for PIN security feature
-- This column will store the bcrypt hashed PIN for admin, volunteer, and resident users
-- Barangay users are excluded from PIN protection per requirements

begin;

-- Add pin_hash column to users table
alter table public.users
add column if not exists pin_hash text;

-- Add comment for documentation
comment on column public.users.pin_hash is 'BCrypt hashed 4-digit PIN for user account security (admin, volunteer, resident only)';

-- Create index for better query performance
create index if not exists idx_users_pin_hash on public.users(pin_hash) where pin_hash is not null;

commit;