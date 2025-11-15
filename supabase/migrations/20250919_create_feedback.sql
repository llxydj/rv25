-- Create feedback table
create table if not exists public.feedback (
  id bigserial primary key,
  incident_id bigint not null,
  rating int not null check (rating between 1 and 5),
  thumbs_up boolean,
  comment text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_feedback_incident on public.feedback(incident_id);
create index if not exists idx_feedback_created_by on public.feedback(created_by);

-- RLS
alter table public.feedback enable row level security;

-- Allow users to insert their own feedback
create policy if not exists feedback_insert_policy on public.feedback
  for insert
  with check (auth.uid() = created_by);

-- Admins can select all (assumes role column exists on users)
create policy if not exists feedback_select_policy on public.feedback
  for select
  using (
    exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
    ) or created_by = auth.uid()
  );


