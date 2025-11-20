-- Add array column to store multiple incident photos
alter table public.incidents
  add column if not exists photo_urls text[] default '{}'::text[];

