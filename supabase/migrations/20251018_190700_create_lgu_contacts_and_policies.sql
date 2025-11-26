-- Ensure UUID extension is available (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create lgu_contacts table
create table if not exists public.lgu_contacts (
  id uuid primary key default uuid_generate_v4(),
  agency_name text not null,
  contact_person text,
  contact_number text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable RLS
alter table public.lgu_contacts enable row level security;

-- 3. Drop existing policies before creation (ensures idempotency)
-- This is necessary because 'CREATE POLICY IF NOT EXISTS' is not supported.
DROP POLICY IF EXISTS lgu_contacts_admin_select ON public.lgu_contacts;
DROP POLICY IF EXISTS lgu_contacts_admin_insert ON public.lgu_contacts;
DROP POLICY IF EXISTS lgu_contacts_admin_update ON public.lgu_contacts;
DROP POLICY IF EXISTS lgu_contacts_admin_delete ON public.lgu_contacts;
DROP POLICY IF EXISTS lgu_contacts_volunteer_select ON public.lgu_contacts;
DROP POLICY IF EXISTS lgu_contacts_resident_select ON public.lgu_contacts;


-- 4. Define RLS Policies

-- Admins: full CRUD
-- Note: Replace 'public.users' with the actual schema/table storing user roles if different.
create policy lgu_contacts_admin_select on public.lgu_contacts
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy lgu_contacts_admin_insert on public.lgu_contacts
  for insert with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy lgu_contacts_admin_update on public.lgu_contacts
  for update using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy lgu_contacts_admin_delete on public.lgu_contacts
  for delete using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Volunteers: read-only
create policy lgu_contacts_volunteer_select on public.lgu_contacts
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'volunteer')
  );

-- Residents: read-only (Keep this only if desired, otherwise remove)
create policy lgu_contacts_resident_select on public.lgu_contacts
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('resident', 'barangay'))
  );


-- 5. Seed initial data (idempotent inserts)
-- Note: These statements are correct and already idempotent.

insert into public.lgu_contacts (agency_name, contact_person, contact_number, notes)
select 'TCDRRMO', 'Duty Officer', '09491139395', 'Mobile'::text
where not exists (
  select 1 from public.lgu_contacts where agency_name = 'TCDRRMO' and contact_number = '09491139395'
);

insert into public.lgu_contacts (agency_name, contact_person, contact_number, notes)
select 'TCDRRMO', 'Hotline', '4954152', 'Landline'::text
where not exists (
  select 1 from public.lgu_contacts where agency_name = 'TCDRRMO' and contact_number = '4954152'
);

insert into public.lgu_contacts (agency_name, contact_person, contact_number, notes)
select 'TCDRRMO', 'Hotline', '7126074', 'Landline'::text
where not exists (
  select 1 from public.lgu_contacts where agency_name = 'TCDRRMO' and contact_number = '7126074'
);