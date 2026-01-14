#!/bin/bash
# Marketing Template Migration Test Script
# Tests all 5 phases of the playbook implementation

set -e

echo "🧪 MARKETING TEMPLATE MIGRATION TEST SUITE"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://bxmdzcxejcxbinghtyfw.supabase.co}"
ADMIN_API_URL="${SUPABASE_URL}/functions/v1/admin-api"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

echo "📋 Phase 1: Schema Validation"
echo "------------------------------"

# Test 1: Check if marketing_compliance table exists
echo -n "Checking marketing_compliance table... "
if psql "${DATABASE_URL}" -c "\d marketing_compliance" &>/dev/null; then
  pass "marketing_compliance table exists"
else
  fail "marketing_compliance table missing"
fi

# Test 2: Check if template_category column exists in broadcasts
echo -n "Checking broadcasts.template_category column... "
if psql "${DATABASE_URL}" -c "\d broadcasts" | grep -q "template_category"; then
  pass "template_category column exists"
else
  fail "template_category column missing"
fi

# Test 3: Check if partner_attribution column exists in moments
echo -n "Checking moments.partner_attribution column... "
if psql "${DATABASE_URL}" -c "\d moments" | grep -q "partner_attribution"; then
  pass "partner_attribution column exists"
else
  fail "partner_attribution column missing"
fi

# Test 4: Check feature flag
echo -n "Checking enable_marketing_templates feature flag... "
FLAG_STATUS=$(psql "${DATABASE_URL}" -t -c "SELECT enabled FROM feature_flags WHERE flag_key = 'enable_marketing_templates';" | xargs)
if [ "$FLAG_STATUS" = "t" ] || [ "$FLAG_STATUS" = "f" ]; then
  pass "Feature flag exists (enabled: $FLAG_STATUS)"
else
  fail "Feature flag missing"
fi

echo ""
echo "📋 Phase 2: Code Validation"
echo "------------------------------"

# Test 5: Check if broadcast-hybrid.js imports templates
echo -n "Checking broadcast-hybrid.js imports... "
if grep -q "MESSAGE_TEMPLATES" src/broadcast-hybrid.js; then
  pass "Template imports found"
else
  fail "Template imports missing"
fi

# Test 6: Check if formatFreeformMoment uses playbook format
echo -n "Checking freeform message format... "
if grep -q "Community Moment" src/broadcast-hybrid.js && grep -q "Presented by" src/broadcast-hybrid.js; then
  pass "Playbook-compliant formatting found"
else
  fail "Formatting doesn't match playbook"
fi

# Test 7: Check if compliance logging exists
echo -n "Checking compliance audit logging... "
if grep -q "logComplianceAudit" src/broadcast-hybrid.js; then
  pass "Compliance logging implemented"
else
  fail "Compliance logging missing"
fi

# Test 8: Check admin-api compliance validation
echo -n "Checking admin-api compliance validation... "
if grep -q "complianceIssues" supabase/functions/admin-api/index.ts; then
  pass "Compliance validation found"
else
  fail "Compliance validation missing"
fi

echo ""
echo "📋 Phase 3: Template Testing"
echo "------------------------------"

# Test 9: Verify template definitions exist
echo -n "Checking MOMENT_BROADCAST template... "
if grep -q "moment_broadcast_v2" src/whatsapp-templates.js; then
  pass "MOMENT_BROADCAST template defined"
else
  fail "MOMENT_BROADCAST template missing"
fi

# Test 10: Verify SPONSORED_MOMENT template
echo -n "Checking SPONSORED_MOMENT template... "
if grep -q "sponsored_moment_v2" src/whatsapp-templates.js; then
  pass "SPONSORED_MOMENT template defined"
else
  fail "SPONSORED_MOMENT template missing"
fi

# Test 11: Check template categories
echo -n "Checking template categories... "
if grep -q "MARKETING" src/whatsapp-templates.js; then
  pass "MARKETING category found"
else
  fail "MARKETING category missing"
fi

echo ""
echo "📋 Phase 4: Integration Testing"
echo "------------------------------"

# Test 12: Test organic moment creation (no sponsor)
echo -n "Testing organic moment creation... "
ORGANIC_RESPONSE=$(curl -s -X POST "${ADMIN_API_URL}/moments" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Organic Moment",
    "content": "This is a test organic moment for marketing template validation",
    "region": "KZN",
    "category": "Education",
    "pwa_link": "https://moments.unamifoundation.org/test"
  }' 2>/dev/null)

if echo "$ORGANIC_RESPONSE" | grep -q "moment"; then
  ORGANIC_MOMENT_ID=$(echo "$ORGANIC_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  pass "Organic moment created (ID: ${ORGANIC_MOMENT_ID:0:8}...)"
else
  fail "Organic moment creation failed"
fi

# Test 13: Test sponsored moment creation (with sponsor)
echo -n "Testing sponsored moment creation... "

# First, get a sponsor ID
SPONSOR_ID=$(psql "${DATABASE_URL}" -t -c "SELECT id FROM sponsors WHERE active = true LIMIT 1;" | xargs)

if [ -n "$SPONSOR_ID" ]; then
  SPONSORED_RESPONSE=$(curl -s -X POST "${ADMIN_API_URL}/moments" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"Test Sponsored Moment\",
      \"content\": \"This is a test sponsored moment for marketing template validation\",
      \"region\": \"GP\",
      \"category\": \"Opportunity\",
      \"sponsor_id\": \"${SPONSOR_ID}\",
      \"pwa_link\": \"https://moments.unamifoundation.org/test-sponsored\"
    }" 2>/dev/null)
  
  if echo "$SPONSORED_RESPONSE" | grep -q "moment"; then
    SPONSORED_MOMENT_ID=$(echo "$SPONSORED_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    pass "Sponsored moment created (ID: ${SPONSORED_MOMENT_ID:0:8}...)"
  else
    fail "Sponsored moment creation failed"
  fi
else
  warn "No active sponsors found - skipping sponsored moment test"
fi

# Test 14: Verify compliance audit was logged
echo -n "Checking compliance audit logs... "
COMPLIANCE_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM marketing_compliance;" | xargs)
if [ "$COMPLIANCE_COUNT" -gt 0 ]; then
  pass "Compliance audits logged (count: $COMPLIANCE_COUNT)"
else
  warn "No compliance audits found (may be expected if broadcasts haven't run)"
fi

# Test 15: Check feature flag status
echo -n "Checking feature flag status... "
FLAG_ENABLED=$(psql "${DATABASE_URL}" -t -c "SELECT enabled FROM feature_flags WHERE flag_key = 'enable_marketing_templates';" | xargs)
if [ "$FLAG_ENABLED" = "t" ]; then
  warn "Marketing templates ENABLED - production traffic affected"
elif [ "$FLAG_ENABLED" = "f" ]; then
  pass "Marketing templates DISABLED - safe for testing"
else
  fail "Feature flag status unknown"
fi

echo ""
echo "📋 Phase 5: Compliance Validation"
echo "------------------------------"

# Test 16: Verify opt-out mechanism in templates
echo -n "Checking opt-out in templates... "
if grep -q "Reply STOP to unsubscribe" src/whatsapp-templates.js; then
  pass "Opt-out mechanism present"
else
  fail "Opt-out mechanism missing"
fi

# Test 17: Verify PWA links in templates
echo -n "Checking PWA links in templates... "
if grep -q "moments.unamifoundation.org" src/whatsapp-templates.js; then
  pass "PWA verification links present"
else
  fail "PWA verification links missing"
fi

# Test 18: Verify sponsor attribution in templates
echo -n "Checking sponsor attribution... "
if grep -q "Proudly sponsored by" src/whatsapp-templates.js || grep -q "Presented by" src/broadcast-hybrid.js; then
  pass "Sponsor attribution present"
else
  fail "Sponsor attribution missing"
fi

# Test 19: Check for prohibited content
echo -n "Checking for prohibited content... "
PROHIBITED_FOUND=false
if grep -qi "CMS\|backend\|automation" src/whatsapp-templates.js src/broadcast-hybrid.js; then
  fail "Prohibited content references found"
  PROHIBITED_FOUND=true
else
  pass "No prohibited content references"
fi

# Test 20: Verify compliance dashboard view
echo -n "Checking compliance dashboard view... "
if psql "${DATABASE_URL}" -c "\d compliance_dashboard" &>/dev/null; then
  pass "Compliance dashboard view exists"
else
  fail "Compliance dashboard view missing"
fi

echo ""
echo "=========================================="
echo "📊 TEST SUMMARY"
echo "=========================================="
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "🚀 NEXT STEPS:"
  echo "1. Run schema migration: supabase/marketing_template_migration.sql"
  echo "2. Deploy updated functions: ./deploy-moments.sh"
  echo "3. Enable feature flag: UPDATE feature_flags SET enabled = true WHERE flag_key = 'enable_marketing_templates';"
  echo "4. Test with 10% traffic first"
  echo "5. Submit templates to Meta for approval"
  echo "6. Monitor compliance dashboard"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo ""
  echo "🔧 REQUIRED FIXES:"
  echo "1. Review failed tests above"
  echo "2. Fix issues in code/schema"
  echo "3. Re-run this test script"
  echo "4. Do not deploy until all tests pass"
  exit 1
fi
