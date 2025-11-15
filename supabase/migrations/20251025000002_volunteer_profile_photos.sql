-- Volunteer profile photos storage bucket and policies
begin;

-- Create storage bucket for profile photos (if not exists)
insert into storage.buckets (id, name, public)
values ('volunteer-profile-photos', 'volunteer-profile-photos', true)
on conflict (id) do nothing;

-- Storage policies for profile photos bucket
-- Allow authenticated users to upload their own profile photo
do $$ begin
  create policy "storage_profile_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'volunteer-profile-photos'
    and (
      (auth.uid())::text = split_part(name, '/', 1)
      or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    )
  );
exception when duplicate_object then null; end $$;

-- Allow public read access to profile photos
do $$ begin
  create policy "storage_profile_photos_select" on storage.objects
  for select to public
  using (bucket_id = 'volunteer-profile-photos');
exception when duplicate_object then null; end $$;

-- Allow users to update their own profile photo
do $$ begin
  create policy "storage_profile_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'volunteer-profile-photos'
    and (
      (auth.uid())::text = split_part(name, '/', 1)
      or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    )
  );
exception when duplicate_object then null; end $$;

-- Allow users to delete their own profile photo
do $$ begin
  create policy "storage_profile_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'volunteer-profile-photos'
    and (
      (auth.uid())::text = split_part(name, '/', 1)
      or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    )
  );
exception when duplicate_object then null; end $$;

commit;
