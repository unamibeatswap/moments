#!/bin/bash

# Test Meta WhatsApp Business API Compliance System
echo "🔍 Testing Meta Compliance System..."

# Test 1: Check compliance categories endpoint
echo "1. Testing compliance categories..."
curl -s "https://your-supabase-url.supabase.co/functions/v1/admin-api/compliance/categories" \
  -H "Authorization: Bearer test-token" | jq '.categories | length'

# Test 2: Test safe campaign
echo "2. Testing SAFE campaign..."
curl -s -X POST "https://your-supabase-url.supabase.co/functions/v1/admin-api/compliance/check" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Community Skills Workshop",
    "content": "Join us for a free skills development workshop this Saturday at the community center. Learn new skills and meet your neighbors!",
    "category": "Community Education"
  }' | jq '.compliance.is_compliant'

# Test 3: Test DANGEROUS campaign (should be blocked)
echo "3. Testing DANGEROUS campaign..."
curl -s -X POST "https://your-supabase-url.supabase.co/functions/v1/admin-api/compliance/check" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Vote for Our Candidate",
    "content": "Support our political party in the upcoming election. Vote for change!",
    "category": "Political Campaigns"
  }' | jq '.compliance.violation_severity'

echo "✅ Compliance system test complete!"