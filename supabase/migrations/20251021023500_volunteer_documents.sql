-- Volunteer documents: storage bucket, table, and RLS
begin;

-- Create storage bucket (id == name). If it already exists, do nothing.
insert into storage.buckets (id, name, public)
values ('volunteer-docs', 'volunteer-docs', false)
on conflict (id) do nothing;

-- Table to track documents metadata
create table if not exists public.volunteer_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null,
  created_at timestamptz default now()
);

-- RLS
alter table public.volunteer_documents enable row level security;

-- Policies: owner can read/write their rows; admins can read all
create policy if not exists "vol_docs_owner_select" on public.volunteer_documents
for select to authenticated
using (auth.uid() = user_id or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

create policy if not exists "vol_docs_owner_insert" on public.volunteer_documents
for insert to authenticated
with check (auth.uid() = user_id or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

create policy if not exists "vol_docs_owner_delete" on public.volunteer_documents
for delete to authenticated
using (auth.uid() = user_id or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- Storage policies for bucket objects
-- Allow owners to manage objects under their user_id/ prefix, and admins full access
create policy if not exists "storage_vol_docs_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'volunteer-docs'
  and (
    (auth.uid())::text = split_part(name, '/', 1) -- prefix userId/
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  )
);

create policy if not exists "storage_vol_docs_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'volunteer-docs'
  and (
    (auth.uid())::text = split_part(name, '/', 1)
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  )
);

create policy if not exists "storage_vol_docs_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'volunteer-docs'
  and (
    (auth.uid())::text = split_part(name, '/', 1)
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  )
);

commit;
