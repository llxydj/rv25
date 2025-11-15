-- Real-time notification system for schedules
-- Automatically notify volunteers, admins, and barangay users
begin;

-- Function to send notification when schedule is created
create or replace function notify_schedule_created()
returns trigger as $$
declare
  volunteer_name text;
  admin_name text;
begin
  -- Get volunteer name
  select first_name || ' ' || last_name into volunteer_name
  from public.users where id = new.volunteer_id;
  
  -- Get admin name
  select first_name || ' ' || last_name into admin_name
  from public.users where id = new.created_by;
  
  -- Notify the volunteer
  insert into public.notifications (
    user_id,
    title,
    body,
    type,
    data,
    status
  ) values (
    new.volunteer_id,
    'New Activity Assigned',
    format('You have been assigned to "%s" on %s at %s', 
      new.title,
      to_char(new.start_time, 'Mon DD, YYYY'),
      to_char(new.start_time, 'HH12:MI AM')
    ),
    'schedule_assigned',
    jsonb_build_object(
      'schedule_id', new.id,
      'title', new.title,
      'start_time', new.start_time,
      'location', new.location,
      'barangay', new.barangay,
      'created_by_name', admin_name
    ),
    'UNREAD'
  );
  
  -- Notify admins (for tracking)
  insert into public.notifications (
    user_id,
    title,
    body,
    type,
    data,
    status
  )
  select 
    u.id,
    'Activity Scheduled',
    format('"%s" scheduled for %s on %s', 
      new.title,
      volunteer_name,
      to_char(new.start_time, 'Mon DD, YYYY')
    ),
    'schedule_created',
    jsonb_build_object(
      'schedule_id', new.id,
      'title', new.title,
      'volunteer_id', new.volunteer_id,
      'volunteer_name', volunteer_name,
      'start_time', new.start_time
    ),
    'UNREAD'
  from public.users u
  where u.role = 'admin' 
    and u.id != new.created_by;
  
  -- Notify barangay users if barangay is specified
  if new.barangay is not null then
    insert into public.notifications (
      user_id,
      title,
      body,
      type,
      data,
      status
    )
    select 
      u.id,
      'Activity in Your Barangay',
      format('"%s" scheduled in %s on %s', 
        new.title,
        new.barangay,
        to_char(new.start_time, 'Mon DD, YYYY')
      ),
      'schedule_barangay',
      jsonb_build_object(
        'schedule_id', new.id,
        'title', new.title,
        'barangay', new.barangay,
        'start_time', new.start_time
      ),
      'UNREAD'
    from public.users u
    where u.role = 'barangay' 
      and u.barangay = new.barangay;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Function to notify on schedule updates
create or replace function notify_schedule_updated()
returns trigger as $$
declare
  volunteer_name text;
  change_summary text;
begin
  -- Only notify on significant changes
  if old.title is distinct from new.title 
    or old.start_time is distinct from new.start_time 
    or old.end_time is distinct from new.end_time 
    or old.location is distinct from new.location then
    
    -- Build change summary
    change_summary := '';
    if old.start_time is distinct from new.start_time then
      change_summary := change_summary || format('Time changed to %s. ', 
        to_char(new.start_time, 'Mon DD, YYYY HH12:MI AM'));
    end if;
    if old.location is distinct from new.location then
      change_summary := change_summary || format('Location changed to %s. ', new.location);
    end if;
    
    -- Notify volunteer
    insert into public.notifications (
      user_id,
      title,
      body,
      type,
      data,
      status
    ) values (
      new.volunteer_id,
      'Activity Updated',
      format('"%s" has been updated. %s', new.title, change_summary),
      'schedule_updated',
      jsonb_build_object(
        'schedule_id', new.id,
        'title', new.title,
        'start_time', new.start_time,
        'location', new.location,
        'changes', change_summary
      ),
      'UNREAD'
    );
  end if;
  
  -- Notify on acceptance/decline
  if old.is_accepted is distinct from new.is_accepted and new.is_accepted is not null then
    select first_name || ' ' || last_name into volunteer_name
    from public.users where id = new.volunteer_id;
    
    -- Notify admins and creator
    insert into public.notifications (
      user_id,
      title,
      body,
      type,
      data,
      status
    )
    select 
      u.id,
      case 
        when new.is_accepted then 'Activity Accepted'
        else 'Activity Declined'
      end,
      format('%s has %s "%s" on %s', 
        volunteer_name,
        case when new.is_accepted then 'accepted' else 'declined' end,
        new.title,
        to_char(new.start_time, 'Mon DD, YYYY')
      ),
      'schedule_response',
      jsonb_build_object(
        'schedule_id', new.id,
        'volunteer_id', new.volunteer_id,
        'volunteer_name', volunteer_name,
        'is_accepted', new.is_accepted,
        'response_at', new.response_at
      ),
      'UNREAD'
    from public.users u
    where u.role = 'admin' or u.id = new.created_by;
  end if;
  
  -- Notify on completion
  if old.completed_at is null and new.completed_at is not null then
    select first_name || ' ' || last_name into volunteer_name
    from public.users where id = new.volunteer_id;
    
    insert into public.notifications (
      user_id,
      title,
      body,
      type,
      data,
      status
    )
    select 
      u.id,
      'Activity Completed',
      format('%s completed "%s"', volunteer_name, new.title),
      'schedule_completed',
      jsonb_build_object(
        'schedule_id', new.id,
        'volunteer_id', new.volunteer_id,
        'volunteer_name', volunteer_name,
        'completed_at', new.completed_at
      ),
      'UNREAD'
    from public.users u
    where u.role = 'admin' or u.id = new.created_by;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Function to notify on schedule deletion
create or replace function notify_schedule_deleted()
returns trigger as $$
begin
  -- Notify volunteer
  insert into public.notifications (
    user_id,
    title,
    body,
    type,
    data,
    status
  ) values (
    old.volunteer_id,
    'Activity Cancelled',
    format('The activity "%s" scheduled for %s has been cancelled', 
      old.title,
      to_char(old.start_time, 'Mon DD, YYYY')
    ),
    'schedule_cancelled',
    jsonb_build_object(
      'schedule_id', old.id,
      'title', old.title,
      'start_time', old.start_time
    ),
    'UNREAD'
  );
  
  return old;
end;
$$ language plpgsql security definer;

-- Drop existing triggers if any
drop trigger if exists trigger_notify_schedule_created on public.schedules;
drop trigger if exists trigger_notify_schedule_updated on public.schedules;
drop trigger if exists trigger_notify_schedule_deleted on public.schedules;

-- Create triggers
create trigger trigger_notify_schedule_created
  after insert on public.schedules
  for each row
  execute function notify_schedule_created();

create trigger trigger_notify_schedule_updated
  after update on public.schedules
  for each row
  execute function notify_schedule_updated();

create trigger trigger_notify_schedule_deleted
  after delete on public.schedules
  for each row
  execute function notify_schedule_deleted();

commit;
