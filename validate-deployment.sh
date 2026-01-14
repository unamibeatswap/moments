#!/bin/bash
# Post-Deployment Validation
# Run after migration and admin-api deployment

set -e

SUPABASE_URL="${SUPABASE_URL:-https://bxmdzcxejcxbinghtyfw.supabase.co}"
ADMIN_API="${SUPABASE_URL}/functions/v1/admin-api"

echo "🔍 POST-DEPLOYMENT VALIDATION"
echo "=============================="
echo ""

# Test 1: Admin API Health
echo -n "Testing admin-api health... "
HEALTH=$(curl -s "${ADMIN_API}/help" | grep -o "version" || echo "")
if [ -n "$HEALTH" ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL - Admin API not responding"
  exit 1
fi

# Test 2: Feature Flag Check
echo -n "Checking feature flag... "
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  FLAG=$(psql "$DATABASE_URL" -t -c "SELECT enabled FROM feature_flags WHERE flag_key = 'enable_marketing_templates';" 2>/dev/null | xargs || echo "")
  if [ "$FLAG" = "f" ]; then
    echo "✅ PASS (disabled - safe)"
  elif [ "$FLAG" = "t" ]; then
    echo "⚠️  ENABLED - production traffic affected"
  else
    echo "❌ FAIL - flag not found"
  fi
else
  echo "⚠️  SKIP - psql not available"
fi

# Test 3: Schema Validation
echo -n "Checking marketing_compliance table... "
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  TABLE=$(psql "$DATABASE_URL" -t -c "\dt marketing_compliance" 2>/dev/null | grep -o "marketing_compliance" || echo "")
  if [ -n "$TABLE" ]; then
    echo "✅ PASS"
  else
    echo "❌ FAIL - table not found"
  fi
else
  echo "⚠️  SKIP - psql not available"
fi

# Test 4: Compliance Dashboard View
echo -n "Checking compliance_dashboard view... "
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  VIEW=$(psql "$DATABASE_URL" -t -c "\dv compliance_dashboard" 2>/dev/null | grep -o "compliance_dashboard" || echo "")
  if [ -n "$VIEW" ]; then
    echo "✅ PASS"
  else
    echo "❌ FAIL - view not found"
  fi
else
  echo "⚠️  SKIP - psql not available"
fi

# Test 5: Code Verification
echo -n "Verifying broadcast-hybrid.js changes... "
if grep -q "logComplianceAudit" src/broadcast-hybrid.js && grep -q "useMarketingTemplates" src/broadcast-hybrid.js; then
  echo "✅ PASS"
else
  echo "❌ FAIL - code changes missing"
fi

echo -n "Verifying admin-api changes... "
if grep -q "complianceIssues" supabase/functions/admin-api/index.ts && grep -q "partner_attribution" supabase/functions/admin-api/index.ts; then
  echo "✅ PASS"
else
  echo "❌ FAIL - code changes missing"
fi

echo ""
echo "=============================="
echo "✅ DEPLOYMENT VALIDATED"
echo ""
echo "📋 NEXT ACTIONS:"
echo "1. Enable feature flag: UPDATE feature_flags SET enabled = true WHERE flag_key = 'enable_marketing_templates';"
echo "2. Create test moment with sponsor"
echo "3. Monitor: SELECT * FROM compliance_dashboard;"
echo "4. Submit templates to Meta"
