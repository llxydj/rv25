-- Add capacity and status columns to trainings table
alter table public.trainings 
  add column if not exists capacity integer,
  add column if not exists status text default 'SCHEDULED' check (status in ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'));

-- Create training_enrollments table for volunteer enrollment
create table if not exists public.training_enrollments (
  id bigserial primary key,
  training_id bigint not null references public.trainings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  attended boolean default false,
  unique (training_id, user_id)
);

-- Create training_evaluations_admin table for admin evaluation of volunteers
create table if not exists public.training_evaluations_admin (
  id bigserial primary key,
  training_id bigint not null references public.trainings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  evaluated_by uuid not null references public.users(id),
  performance_rating int not null check (performance_rating between 1 and 5),
  skills_assessment jsonb,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_id, user_id, evaluated_by)
);

-- Indexes
create index if not exists idx_training_enrollments_training on public.training_enrollments(training_id);
create index if not exists idx_training_enrollments_user on public.training_enrollments(user_id);
create index if not exists idx_training_evaluations_admin_training on public.training_evaluations_admin(training_id);
create index if not exists idx_training_evaluations_admin_user on public.training_evaluations_admin(user_id);

-- RLS for training_enrollments
alter table public.training_enrollments enable row level security;

-- Drop policies if they exist, then create them
drop policy if exists training_enrollments_select on public.training_enrollments;
create policy training_enrollments_select on public.training_enrollments for select using (true);

drop policy if exists training_enrollments_insert_self on public.training_enrollments;
create policy training_enrollments_insert_self on public.training_enrollments for insert with check (user_id = auth.uid());

drop policy if exists training_enrollments_insert_admin on public.training_enrollments;
create policy training_enrollments_insert_admin on public.training_enrollments for insert with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

drop policy if exists training_enrollments_update_admin on public.training_enrollments;
create policy training_enrollments_update_admin on public.training_enrollments for update using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

-- RLS for training_evaluations_admin
alter table public.training_evaluations_admin enable row level security;

-- Drop policies if they exist, then create them
drop policy if exists training_eval_admin_select on public.training_evaluations_admin;
create policy training_eval_admin_select on public.training_evaluations_admin for select using (
  user_id = auth.uid() or 
  evaluated_by = auth.uid() or
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

drop policy if exists training_eval_admin_insert_admin on public.training_evaluations_admin;
create policy training_eval_admin_insert_admin on public.training_evaluations_admin for insert with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

drop policy if exists training_eval_admin_update_admin on public.training_evaluations_admin;
create policy training_eval_admin_update_admin on public.training_evaluations_admin for update using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
);

