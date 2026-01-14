#!/bin/bash
echo "🧪 Testing Comments API..."
echo ""

API_BASE="https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/admin-api"
TOKEN="session_test_token"

# Get a moment ID first
echo "1. Getting moment ID..."
MOMENT_ID=$(curl -s "$API_BASE/moments?limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.moments[0].id')

if [ "$MOMENT_ID" = "null" ] || [ -z "$MOMENT_ID" ]; then
  echo "❌ No moments found. Create a moment first."
  exit 1
fi

echo "✅ Using moment: $MOMENT_ID"
echo ""

# Create comment
echo "2. Creating comment..."
COMMENT_ID=$(curl -s -X POST "$API_BASE/moments/$MOMENT_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from_number":"+27123456789","content":"Great moment!"}' | jq -r '.comment.id')

echo "✅ Comment created: $COMMENT_ID"
echo ""

# Approve comment
echo "3. Approving comment..."
curl -s -X POST "$API_BASE/comments/$COMMENT_ID/approve" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Get comments
echo "4. Getting comments..."
curl -s "$API_BASE/moments/$MOMENT_ID/comments" | jq '.comments | length'
echo ""

echo "✅ Comments API Tests Complete"
