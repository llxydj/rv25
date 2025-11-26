-- Schedules table for volunteer activities
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  barangay text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_schedules_volunteer_time on public.schedules (volunteer_id, start_time desc);
create index if not exists idx_schedules_created_by on public.schedules (created_by);

-- Optional soft FKs (commented if users table may vary)
-- alter table public.schedules add constraint fk_sched_volunteer foreign key (volunteer_id) references public.users (id) on delete cascade;
-- alter table public.schedules add constraint fk_sched_creator foreign key (created_by) references public.users (id) on delete set null;

-- RLS
alter table public.schedules enable row level security;

-- Policies
-- Volunteers can select their own schedules
do $$ begin
  create policy schedules_select_self on public.schedules
  for select to authenticated
  using (volunteer_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Admins can select all schedules
do $$ begin
  create policy schedules_select_admin on public.schedules
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
exception when duplicate_object then null; end $$;

-- Admins can insert schedules
do $$ begin
  create policy schedules_insert_admin on public.schedules
  for insert to authenticated
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
exception when duplicate_object then null; end $$;

-- Admins can update schedules
do $$ begin
  create policy schedules_update_admin on public.schedules
  for update to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
exception when duplicate_object then null; end $$;

-- Admins can delete schedules
do $$ begin
  create policy schedules_delete_admin on public.schedules
  for delete to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
exception when duplicate_object then null; end $$;

-- Trigger to keep updated_at current
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_schedules_updated_at on public.schedules;
create trigger trg_schedules_updated_at
before update on public.schedules
for each row execute function public.set_updated_at();
