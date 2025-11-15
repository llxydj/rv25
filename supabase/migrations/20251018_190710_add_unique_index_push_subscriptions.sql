-- Ensure unique composite identity for push_subscriptions to match onConflict semantics.
-- jsonb cannot use a plain btree unique; add a generated hash column and unique index
alter table public.push_subscriptions
  add column if not exists subscription_hash text
  generated always as (md5(subscription::text)) stored;

create unique index if not exists idx_push_subscriptions_user_subscription_unique
on public.push_subscriptions (user_id, subscription_hash);
