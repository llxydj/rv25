-- Trainings table
create table if not exists public.trainings (
  id bigserial primary key,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Evaluations table
create table if not exists public.training_evaluations (
  id bigserial primary key,
  training_id bigint not null references public.trainings(id) on delete cascade,
  user_id uuid not null,
  rating int not null check (rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now(),
  unique (training_id, user_id)
);

-- Incident handoffs (Inter-LGU)
create table if not exists public.incident_handoffs (
  id bigserial primary key,
  incident_id uuid not null,
  from_lgu text not null,
  to_lgu text not null,
  status text not null default 'PENDING',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_training_evaluations_training on public.training_evaluations(training_id);
create index if not exists idx_training_evaluations_user on public.training_evaluations(user_id);
create index if not exists idx_incident_handoffs_incident on public.incident_handoffs(incident_id);

-- RLS
alter table public.trainings enable row level security;
alter table public.training_evaluations enable row level security;
alter table public.incident_handoffs enable row level security;

-- Policies
-- Trainings: everyone can read; admin can insert
create policy if not exists trainings_select on public.trainings for select using (true);
create policy if not exists trainings_insert_admin on public.trainings for insert with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- Evaluations: user can insert own; user can read own; admin can read all
create policy if not exists training_eval_insert_self on public.training_evaluations for insert with check (user_id = auth.uid());
create policy if not exists training_eval_select_self on public.training_evaluations for select using (user_id = auth.uid());
create policy if not exists training_eval_select_admin on public.training_evaluations for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- Incident handoffs: creator can insert/select own; admin can select all
create policy if not exists handoffs_insert_self on public.incident_handoffs for insert with check (created_by = auth.uid());
create policy if not exists handoffs_select_self on public.incident_handoffs for select using (created_by = auth.uid());
create policy if not exists handoffs_select_admin on public.incident_handoffs for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);


