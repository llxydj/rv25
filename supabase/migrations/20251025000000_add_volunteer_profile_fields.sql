-- Add missing fields to users table for complete volunteer profiling
-- Gender, emergency contact information
begin;

-- Add gender field
alter table public.users
add column if not exists gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say'));

-- Add emergency contact fields
alter table public.users
add column if not exists emergency_contact_name text,
add column if not exists emergency_contact_phone text,
add column if not exists emergency_contact_relationship text;

-- Add profile photo URL (will be stored in storage bucket)
alter table public.users
add column if not exists profile_photo_url text;

-- Add indexes for better query performance
create index if not exists idx_users_gender on public.users(gender);
create index if not exists idx_users_profile_photo on public.users(profile_photo_url) where profile_photo_url is not null;

commit;
