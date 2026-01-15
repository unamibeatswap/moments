-- Check if subscriptions table has data
SELECT COUNT(*) as total_count FROM subscriptions;

-- Check opted in subscribers
SELECT COUNT(*) as active_count FROM subscriptions WHERE opted_in = true;

-- Show sample subscribers
SELECT 
  phone_number,
  opted_in,
  regions,
  categories,
  opted_in_at,
  last_activity
FROM subscriptions
ORDER BY last_activity DESC
LIMIT 10;

-- Check if messages table has phone numbers that should be subscribers
SELECT DISTINCT from_number, COUNT(*) as message_count
FROM messages
GROUP BY from_number
ORDER BY message_count DESC
LIMIT 10;
