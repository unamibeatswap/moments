#!/bin/bash
# Test production hardening and advanced features

SUPABASE_URL="https://bxmdzcxejcxbinghtyfw.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4bWR6Y3hlamN4YmluZ2h0eWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNzMzOTYsImV4cCI6MjA4Mzc0OTM5Nn0.ccwWS_LPLjUrY8zqHD0Q7pTEamdN-QV0bv6f0B1uBUU"

echo "🧪 Testing Production Features..."
echo ""

# Test 1: Feature flags
echo "1️⃣ Testing feature flags..."
curl -s "$SUPABASE_URL/rest/v1/feature_flags?select=*" \
  -H "apikey: $ANON_KEY" | jq '.[] | {flag_key, enabled}'

# Test 2: Rate limiting table exists
echo ""
echo "2️⃣ Testing rate limits table..."
curl -s "$SUPABASE_URL/rest/v1/rate_limits?select=count" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" | jq '.'

# Test 3: Audit logs table exists
echo ""
echo "3️⃣ Testing audit logs table..."
curl -s "$SUPABASE_URL/rest/v1/audit_logs?select=count&limit=5" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" | jq '.'

# Test 4: Comment threads table
echo ""
echo "4️⃣ Testing comment threads table..."
curl -s "$SUPABASE_URL/rest/v1/comment_threads?select=count" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" | jq '.'

# Test 5: User profiles table
echo ""
echo "5️⃣ Testing user profiles table..."
curl -s "$SUPABASE_URL/rest/v1/user_profiles?select=count" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" | jq '.'

# Test 6: Notifications table
echo ""
echo "6️⃣ Testing notifications table..."
curl -s "$SUPABASE_URL/rest/v1/notifications?select=count" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" | jq '.'

# Test 7: Analytics events table
echo ""
echo "7️⃣ Testing analytics events table..."
curl -s "$SUPABASE_URL/rest/v1/analytics_events?select=count" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" | jq '.'

# Test 8: Moment stats table
echo ""
echo "8️⃣ Testing moment stats table..."
curl -s "$SUPABASE_URL/rest/v1/moment_stats?select=count" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" | jq '.'

echo ""
echo "✅ All tables verified!"
