-- Unify scheduling system: Merge scheduledactivities into schedules
-- Add status tracking, acceptance flow, and RLS policies
begin;

-- Step 1: Add missing columns to schedules table
alter table public.schedules add column if not exists status text default 'SCHEDULED' check (status in ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'));
alter table public.schedules add column if not exists is_accepted boolean default null; -- null = pending, true = accepted, false = declined
alter table public.schedules add column if not exists response_at timestamptz;
alter table public.schedules add column if not exists completed_at timestamptz;
alter table public.schedules add column if not exists attendance_marked boolean default false;
alter table public.schedules add column if not exists attendance_notes text;

-- Step 2: Create indexes for performance
create index if not exists idx_schedules_volunteer_status on public.schedules(volunteer_id, status);
create index if not exists idx_schedules_barangay_status on public.schedules(barangay, status);
create index if not exists idx_schedules_start_time on public.schedules(start_time);
create index if not exists idx_schedules_status on public.schedules(status);
create index if not exists idx_schedules_created_by on public.schedules(created_by);

-- Step 3: Migrate data from scheduledactivities to schedules (if any exist)
insert into public.schedules (
  id,
  volunteer_id,
  title,
  description,
  start_time,
  end_time,
  location,
  barangay,
  created_by,
  created_at,
  updated_at,
  is_accepted,
  response_at,
  status
)
select 
  sa.schedule_id as id,
  sa.volunteer_user_id as volunteer_id,
  sa.title,
  sa.description,
  -- Combine date and time into timestamptz for start_time
  (sa.date + coalesce(sa.time, '00:00:00'::time))::timestamptz as start_time,
  -- Estimate end_time as 2 hours after start
  ((sa.date + coalesce(sa.time, '00:00:00'::time)) + interval '2 hours')::timestamptz as end_time,
  sa.location,
  null as barangay, -- scheduledactivities doesn't have barangay
  sa.created_by,
  sa.created_at,
  sa.created_at as updated_at,
  sa.is_accepted,
  sa.response_at,
  case 
    when sa.is_accepted = true then 'SCHEDULED'
    when sa.is_accepted = false then 'CANCELLED'
    else 'SCHEDULED'
  end as status
from public.scheduledactivities sa
where not exists (
  select 1 from public.schedules s where s.id = sa.schedule_id
);

-- Step 4: Enable RLS on schedules table
alter table public.schedules enable row level security;

-- Step 5: Drop existing policies (if any)
drop policy if exists "schedules_admin_all" on public.schedules;
drop policy if exists "schedules_volunteer_select" on public.schedules;
drop policy if exists "schedules_volunteer_update" on public.schedules;
drop policy if exists "schedules_barangay_select" on public.schedules;

-- Step 6: Create RLS policies

-- Admins have full access to all schedules
do $$ begin
  create policy "schedules_admin_all" on public.schedules
  for all to authenticated
  using (
    exists (
      select 1 from public.users u 
      where u.id = auth.uid() 
      and u.role = 'admin'
    )
  );
exception when duplicate_object then null; end $$;

-- Volunteers can view their own schedules
do $$ begin
  create policy "schedules_volunteer_select" on public.schedules
  for select to authenticated
  using (
    volunteer_id = auth.uid()
    or exists (
      select 1 from public.users u 
      where u.id = auth.uid() 
      and u.role = 'admin'
    )
  );
exception when duplicate_object then null; end $$;

-- Volunteers can update their acceptance status and notes
do $$ begin
  create policy "schedules_volunteer_update" on public.schedules
  for update to authenticated
  using (volunteer_id = auth.uid())
  with check (volunteer_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Barangay users can view schedules in their barangay
do $$ begin
  create policy "schedules_barangay_select" on public.schedules
  for select to authenticated
  using (
    exists (
      select 1 from public.users u 
      where u.id = auth.uid() 
      and u.role = 'barangay'
      and u.barangay = schedules.barangay
    )
    or exists (
      select 1 from public.users u 
      where u.id = auth.uid() 
      and u.role = 'admin'
    )
  );
exception when duplicate_object then null; end $$;

-- Step 7: Create function to auto-update status based on timestamps
create or replace function update_schedule_status()
returns trigger as $$
begin
  -- Auto-set to ONGOING if start_time has passed and status is SCHEDULED
  if new.start_time <= now() and new.status = 'SCHEDULED' then
    new.status := 'ONGOING';
  end if;
  
  -- Auto-set to COMPLETED if completed_at is set
  if new.completed_at is not null and new.status != 'CANCELLED' then
    new.status := 'COMPLETED';
  end if;
  
  -- If declined, set to CANCELLED
  if new.is_accepted = false and new.status = 'SCHEDULED' then
    new.status := 'CANCELLED';
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Drop trigger if exists
drop trigger if exists trigger_update_schedule_status on public.schedules;

-- Create trigger
create trigger trigger_update_schedule_status
  before insert or update on public.schedules
  for each row
  execute function update_schedule_status();

-- Step 8: Create function to log schedule activities
create or replace function log_schedule_activity()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    -- Log schedule creation
    insert into public.volunteer_activity_logs (
      volunteer_id,
      activity_type,
      title,
      description,
      created_by,
      metadata
    ) values (
      new.volunteer_id,
      'incident_assigned', -- Using existing enum value
      'Schedule Created: ' || new.title,
      format('Scheduled for %s at %s', new.start_time::date, new.start_time::time),
      new.created_by,
      jsonb_build_object(
        'schedule_id', new.id,
        'start_time', new.start_time,
        'location', new.location,
        'barangay', new.barangay
      )
    );
  elsif TG_OP = 'UPDATE' then
    -- Log acceptance/decline
    if old.is_accepted is distinct from new.is_accepted and new.is_accepted is not null then
      insert into public.volunteer_activity_logs (
        volunteer_id,
        activity_type,
        title,
        description,
        created_by,
        metadata
      ) values (
        new.volunteer_id,
        'status_changed',
        case 
          when new.is_accepted then 'Schedule Accepted: ' || new.title
          else 'Schedule Declined: ' || new.title
        end,
        format('Response given for schedule on %s', new.start_time::date),
        new.volunteer_id,
        jsonb_build_object(
          'schedule_id', new.id,
          'is_accepted', new.is_accepted,
          'response_at', new.response_at
        )
      );
    end if;
    
    -- Log completion
    if old.completed_at is null and new.completed_at is not null then
      insert into public.volunteer_activity_logs (
        volunteer_id,
        activity_type,
        title,
        description,
        created_by,
        metadata
      ) values (
        new.volunteer_id,
        'incident_resolved', -- Using existing enum value
        'Schedule Completed: ' || new.title,
        coalesce(new.attendance_notes, 'Activity completed successfully'),
        new.created_by,
        jsonb_build_object(
          'schedule_id', new.id,
          'completed_at', new.completed_at,
          'attendance_marked', new.attendance_marked
        )
      );
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists
drop trigger if exists trigger_log_schedule_activity on public.schedules;

-- Create trigger
create trigger trigger_log_schedule_activity
  after insert or update on public.schedules
  for each row
  execute function log_schedule_activity();

-- Step 9: Create view for schedule statistics
create or replace view schedule_statistics as
select
  count(*) filter (where status = 'SCHEDULED') as scheduled_count,
  count(*) filter (where status = 'ONGOING') as ongoing_count,
  count(*) filter (where status = 'COMPLETED') as completed_count,
  count(*) filter (where status = 'CANCELLED') as cancelled_count,
  count(*) filter (where is_accepted = true) as accepted_count,
  count(*) filter (where is_accepted = false) as declined_count,
  count(*) filter (where is_accepted is null) as pending_response_count,
  count(*) filter (where start_time > now() and status = 'SCHEDULED') as upcoming_count,
  count(*) filter (where start_time <= now() and status = 'ONGOING') as active_count,
  count(*) filter (where attendance_marked = true) as attendance_marked_count,
  count(*) as total_count
from public.schedules;

-- Step 10: Grant permissions
grant select on schedule_statistics to authenticated;

commit;
