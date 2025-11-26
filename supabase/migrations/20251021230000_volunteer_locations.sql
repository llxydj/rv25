-- Volunteer real-time locations
-- Table
create table if not exists public.volunteer_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_vol_loc_user_created on public.volunteer_locations (user_id, created_at desc);
create index if not exists idx_vol_loc_created on public.volunteer_locations (created_at desc);

-- FK (soft, to avoid dependency on auth schema differences). Optional if public.users exists.
-- alter table public.volunteer_locations add constraint fk_vol_loc_user foreign key (user_id) references public.users (id) on delete cascade;

-- RLS
alter table public.volunteer_locations enable row level security;

-- Policies
-- Volunteers can insert their own positions
do $$ begin
  create policy vol_loc_insert_self on public.volunteer_locations
  for insert to authenticated
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'volunteer'
    )
  );
exception when duplicate_object then null; end $$;

-- Volunteers can read their own positions
do $$ begin
  create policy vol_loc_select_self on public.volunteer_locations
  for select to authenticated
  using (
    auth.uid() = user_id
  );
exception when duplicate_object then null; end $$;

-- Admins can read all positions
do $$ begin
  create policy vol_loc_select_admin on public.volunteer_locations
  for select to authenticated
  using (
    exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
    )
  );
exception when duplicate_object then null; end $$;
