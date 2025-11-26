-- Push subscriptions table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  subscription jsonb not null,
  subscription_hash text generated always as (md5(coalesce(endpoint,'') || ':' || coalesce(p256dh,'') || ':' || coalesce(auth,''))) stored,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_push_sub_user_hash on public.push_subscriptions (user_id, subscription_hash);
create index if not exists idx_push_sub_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- RLS: owner can manage own subs
do $$ begin
  create policy push_sub_insert_self on public.push_subscriptions
  for insert to authenticated
  with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy push_sub_select_self on public.push_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Admins can select all
do $$ begin
  create policy push_sub_select_admin on public.push_subscriptions
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
exception when duplicate_object then null; end $$;
