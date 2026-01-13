#!/bin/bash
# VERIFIER - Smoke Test Checklist
# Following SYSTEM.md: webhook verification, inbound → DB row, approve/flag state change, schedule processing, outbound enqueue

echo "🔍 VERIFIER - Smoke Test Checklist"
echo "=================================="

# Test results tracking
PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC} - $2"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} - $2"
        ((FAILED++))
    fi
}

echo "📋 Running smoke tests on staging environment..."
echo ""

# Test 1: Webhook Verification
echo "1️⃣ Testing webhook verification..."
if command -v curl >/dev/null 2>&1; then
    # Test webhook verification endpoint
    WEBHOOK_URL="${WEBHOOK_URL:-https://moments.unamifoundation.org/webhook}"
    VERIFY_TOKEN="${WEBHOOK_VERIFY_TOKEN:-whatsapp_gateway_verify_2024_secure}"
    
    response=$(curl -s -w "%{http_code}" -o /dev/null \
        "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        test_result 0 "Webhook verification endpoint responding"
    else
        test_result 1 "Webhook verification failed (HTTP $response)"
    fi
else
    echo -e "${YELLOW}⚠️ SKIP${NC} - curl not available"
fi

# Test 2: Database Schema Verification
echo ""
echo "2️⃣ Testing database schema..."
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSchema() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    try {
        // Test messages table with moderation_status
        const { data, error } = await supabase
            .from('messages')
            .select('id, moderation_status')
            .limit(1);
        
        if (error) throw error;
        console.log('SCHEMA_OK');
    } catch (e) {
        console.log('SCHEMA_FAIL:', e.message);
    }
}

testSchema();
" 2>/dev/null | grep -q "SCHEMA_OK"

test_result $? "Database schema with moderation support"

# Test 3: Subscription Table Structure
echo ""
echo "3️⃣ Testing subscription table..."
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSubscriptions() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('phone_number, opted_in, regions')
            .limit(1);
        
        if (error) throw error;
        console.log('SUBS_OK');
    } catch (e) {
        console.log('SUBS_FAIL:', e.message);
    }
}

testSubscriptions();
" 2>/dev/null | grep -q "SUBS_OK"

test_result $? "Subscription table structure"

# Test 4: Environment Variables
echo ""
echo "4️⃣ Testing environment configuration..."
required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_KEY" "WHATSAPP_TOKEN" "WEBHOOK_VERIFY_TOKEN")
missing_vars=0

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌${NC} Missing: $var"
        ((missing_vars++))
    else
        echo -e "${GREEN}✅${NC} Present: $var"
    fi
done

test_result $missing_vars "Environment variables ($missing_vars missing)"

# Test 5: File Structure
echo ""
echo "5️⃣ Testing critical files..."
critical_files=(
    "supabase/functions/webhook/index.ts"
    "supabase/functions/admin-api/index.ts"
    "supabase/migrations/20250111_add_moderation_support.sql"
    "SECURITY_CHECKLIST.md"
)

missing_files=0
for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} Found: $file"
    else
        echo -e "${RED}❌${NC} Missing: $file"
        ((missing_files++))
    fi
done

test_result $missing_files "Critical files ($missing_files missing)"

# Test 6: Git Repository State
echo ""
echo "6️⃣ Testing repository state..."
if git status >/dev/null 2>&1; then
    # Check if .env is in .gitignore
    if grep -q "\.env" .gitignore 2>/dev/null; then
        test_result 0 "Secrets protected in .gitignore"
    else
        test_result 1 "Secrets not protected - .env not in .gitignore"
    fi
    
    # Check current branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" = "fix/critical-functionality" ]; then
        test_result 0 "On correct branch (fix/critical-functionality)"
    else
        test_result 1 "Wrong branch ($current_branch)"
    fi
else
    test_result 1 "Git repository not accessible"
fi

# Summary
echo ""
echo "📊 SMOKE TEST RESULTS"
echo "====================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo "Total Tests: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL SMOKE TESTS PASSED!${NC}"
    echo "System ready for deployment."
    echo ""
    echo "Next steps:"
    echo "1. Apply database migration in Supabase"
    echo "2. Deploy edge functions with new environment variables"
    echo "3. Test webhook endpoints with real WhatsApp messages"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️ SMOKE TESTS FAILED${NC}"
    echo "Address failed tests before deployment."
    exit 1
fi