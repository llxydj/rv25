-- Volunteer activity logs table for tracking all volunteer activities
-- Includes profile updates, incident responses, availability changes, etc.
begin;

-- Create activity logs table
create table if not exists public.volunteer_activity_logs (
  id uuid primary key default uuid_generate_v4(),
  volunteer_id uuid not null references public.users(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'profile_updated',
    'availability_changed',
    'incident_assigned',
    'incident_resolved',
    'document_uploaded',
    'photo_uploaded',
    'skills_updated',
    'status_changed',
    'training_completed',
    'other'
  )),
  title text not null,
  description text,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- Add indexes for efficient querying
create index if not exists idx_activity_logs_volunteer on public.volunteer_activity_logs(volunteer_id, created_at desc);
create index if not exists idx_activity_logs_type on public.volunteer_activity_logs(activity_type);
create index if not exists idx_activity_logs_created_at on public.volunteer_activity_logs(created_at desc);

-- Enable RLS
alter table public.volunteer_activity_logs enable row level security;

-- RLS Policies
-- Volunteers can view their own activity logs
do $$ begin
  create policy "activity_logs_owner_select" on public.volunteer_activity_logs
  for select to authenticated
  using (
    volunteer_id = auth.uid() 
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
exception when duplicate_object then null; end $$;

-- Admins can insert activity logs for any volunteer
do $$ begin
  create policy "activity_logs_admin_insert" on public.volunteer_activity_logs
  for insert to authenticated
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
exception when duplicate_object then null; end $$;

-- System can insert activity logs (for automatic tracking)
do $$ begin
  create policy "activity_logs_system_insert" on public.volunteer_activity_logs
  for insert to authenticated
  with check (auth.uid() = volunteer_id);
exception when duplicate_object then null; end $$;

-- Function to automatically log profile updates
create or replace function log_volunteer_profile_update()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' then
    -- Log various profile changes
    if (old.phone_number is distinct from new.phone_number or
        old.address is distinct from new.address or
        old.barangay is distinct from new.barangay or
        old.gender is distinct from new.gender or
        old.emergency_contact_name is distinct from new.emergency_contact_name or
        old.emergency_contact_phone is distinct from new.emergency_contact_phone) then
      insert into public.volunteer_activity_logs (volunteer_id, activity_type, title, description, created_by)
      values (
        new.id,
        'profile_updated',
        'Profile information updated',
        'Contact details, address, or emergency contact information was updated',
        new.id
      );
    end if;

    if (old.profile_photo_url is distinct from new.profile_photo_url and new.profile_photo_url is not null) then
      insert into public.volunteer_activity_logs (volunteer_id, activity_type, title, description, created_by)
      values (
        new.id,
        'photo_uploaded',
        'Profile photo updated',
        'A new profile photo was uploaded',
        new.id
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for logging user profile updates
drop trigger if exists trigger_log_user_profile_update on public.users;
create trigger trigger_log_user_profile_update
  after update on public.users
  for each row
  when (old.role = 'volunteer' and new.role = 'volunteer')
  execute function log_volunteer_profile_update();

-- Function to log volunteer profile table updates
create or replace function log_volunteer_skills_update()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' then
    if (old.skills is distinct from new.skills) then
      insert into public.volunteer_activity_logs (volunteer_id, activity_type, title, description, created_by)
      values (
        new.volunteer_user_id,
        'skills_updated',
        'Skills updated',
        'Volunteer skills and certifications were updated',
        new.volunteer_user_id
      );
    end if;

    if (old.is_available is distinct from new.is_available) then
      insert into public.volunteer_activity_logs (volunteer_id, activity_type, title, description, created_by)
      values (
        new.volunteer_user_id,
        'availability_changed',
        case when new.is_available then 'Marked as available' else 'Marked as unavailable' end,
        case when new.is_available then 'Volunteer is now available for assignments' else 'Volunteer is now unavailable for assignments' end,
        new.volunteer_user_id
      );
    end if;

    if (old.status is distinct from new.status) then
      insert into public.volunteer_activity_logs (volunteer_id, activity_type, title, description, created_by, metadata)
      values (
        new.volunteer_user_id,
        'status_changed',
        format('Status changed to %s', new.status),
        format('Volunteer status was changed from %s to %s', old.status, new.status),
        new.last_status_changed_by,
        jsonb_build_object('old_status', old.status, 'new_status', new.status)
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for logging volunteer_profiles updates
drop trigger if exists trigger_log_volunteer_profile_update on public.volunteer_profiles;
create trigger trigger_log_volunteer_profile_update
  after update on public.volunteer_profiles
  for each row
  execute function log_volunteer_skills_update();

-- Function to log document uploads
create or replace function log_volunteer_document_upload()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.volunteer_activity_logs (volunteer_id, activity_type, title, description, created_by, metadata)
    values (
      new.user_id,
      'document_uploaded',
      'Document uploaded',
      format('Uploaded: %s', new.file_name),
      new.user_id,
      jsonb_build_object('file_name', new.file_name, 'document_id', new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for logging document uploads
drop trigger if exists trigger_log_document_upload on public.volunteer_documents;
create trigger trigger_log_document_upload
  after insert on public.volunteer_documents
  for each row
  execute function log_volunteer_document_upload();

commit;
