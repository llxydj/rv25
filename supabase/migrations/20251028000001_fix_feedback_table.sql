-- Fix feedback table inconsistency by creating incident_feedback table
-- Drop the old feedback table and create incident_feedback with proper structure

-- Create incident_feedback table
create table if not exists public.incident_feedback (
  id uuid not null default uuid_generate_v4(),
  incident_id uuid not null,
  user_id uuid,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_feedback_pkey primary key (id),
  constraint incident_feedback_incident_id_fkey foreign key (incident_id) references public.incidents(id) on delete cascade,
  constraint incident_feedback_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

-- Indexes
create index if not exists idx_incident_feedback_incident on public.incident_feedback(incident_id);
create index if not exists idx_incident_feedback_user on public.incident_feedback(user_id);
create index if not exists idx_incident_feedback_created_at on public.incident_feedback(created_at);

-- RLS
alter table public.incident_feedback enable row level security;

-- Allow users to insert their own feedback
drop policy if exists incident_feedback_insert_policy on public.incident_feedback;
create policy incident_feedback_insert_policy on public.incident_feedback
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own feedback
drop policy if exists incident_feedback_update_policy on public.incident_feedback;
create policy incident_feedback_update_policy on public.incident_feedback
  for update
  using (auth.uid() = user_id);

-- Users can select their own feedback
drop policy if exists incident_feedback_select_policy on public.incident_feedback;
create policy incident_feedback_select_policy on public.incident_feedback
  for select
  using (
    auth.uid() = user_id or
    exists (
      select 1 from public.users u 
      where u.id = auth.uid() and u.role = 'admin'
    ) or
    exists (
      select 1 from public.incidents i 
      join public.users u on i.reporter_id = u.id
      where i.id = incident_id and u.id = auth.uid()
    )
  );

-- Admins can delete feedback
drop policy if exists incident_feedback_delete_policy on public.incident_feedback;
create policy incident_feedback_delete_policy on public.incident_feedback
  for delete
  using (
    exists (
      select 1 from public.users u 
      where u.id = auth.uid() and u.role = 'admin'
    )
  );