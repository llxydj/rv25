-- Add unique index on user_id for push_subscriptions
-- Ensures each user can only have one active push subscription

-- First, remove any duplicate subscriptions (keep most recent)
DELETE FROM push_subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM push_subscriptions
  ORDER BY user_id, created_at DESC
);

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_unique 
ON push_subscriptions(user_id);

-- Add comment
COMMENT ON INDEX idx_push_subscriptions_user_unique IS 
'Ensures each user can only have one active push subscription';
