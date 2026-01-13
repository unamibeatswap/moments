#!/bin/bash

# Comprehensive Admin Dashboard Test Script
echo "🔍 COMPREHENSIVE ADMIN DASHBOARD TESTING"
echo "========================================"

# Test configuration
SUPABASE_URL="https://bxmdzcxejcxbinghtyfw.supabase.co"
ADMIN_API_BASE="${SUPABASE_URL}/functions/v1/admin-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test
run_test() {
    local test_name="$1"
    local url="$2"
    local method="${3:-GET}"
    local expected_status="${4:-200}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing $test_name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/test_response "$url" 2>/dev/null)
    else
        response=$(curl -s -w "%{http_code}" -X "$method" -o /tmp/test_response "$url" 2>/dev/null)
    fi
    
    status_code="${response: -3}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Status: $status_code, Expected: $expected_status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        
        # Show response for debugging
        if [ -f /tmp/test_response ]; then
            echo -e "${YELLOW}Response:${NC}"
            head -n 5 /tmp/test_response | sed 's/^/  /'
        fi
        return 1
    fi
}

echo -e "${BLUE}Phase 1: Basic Connectivity Tests${NC}"
echo "=================================="

# Test 1: Health check
run_test "System Health Check" "https://moments.unamifoundation.org/health"

# Test 2: Admin dashboard page
run_test "Admin Dashboard Page" "https://moments.unamifoundation.org/admin-dashboard.html"

# Test 3: Public moments page
run_test "Public Moments Page" "https://moments.unamifoundation.org/moments"

echo ""
echo -e "${BLUE}Phase 2: Supabase Edge Functions Tests${NC}"
echo "======================================"

# Test 4: Webhook endpoint (should return 403 without proper verification)
run_test "Webhook Endpoint" "${SUPABASE_URL}/functions/v1/webhook" "GET" "403"

# Test 5: Admin API without auth (should return 401)
run_test "Admin API (No Auth)" "${ADMIN_API_BASE}/analytics" "GET" "401"

# Test 6: Admin API login endpoint
echo -n "Testing Admin Login... "
login_response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"info@unamifoundation.org","password":"Proof321#"}' \
    "${ADMIN_API_BASE}" 2>/dev/null)

login_status="${login_response: -3}"
if [ "$login_status" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Status: $login_status)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    
    # Extract token for authenticated tests
    AUTH_TOKEN=$(echo "$login_response" | head -c -4 | jq -r '.token' 2>/dev/null)
    if [ "$AUTH_TOKEN" != "null" ] && [ -n "$AUTH_TOKEN" ]; then
        echo -e "  ${GREEN}Auth token obtained${NC}"
    else
        echo -e "  ${YELLOW}Warning: Could not extract auth token${NC}"
        AUTH_TOKEN=""
    fi
else
    echo -e "${RED}✗ FAIL${NC} (Status: $login_status)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    AUTH_TOKEN=""
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo -e "${BLUE}Phase 3: Authenticated Admin API Tests${NC}"
echo "====================================="

if [ -n "$AUTH_TOKEN" ]; then
    # Function for authenticated requests
    run_auth_test() {
        local test_name="$1"
        local endpoint="$2"
        local method="${3:-GET}"
        local expected_status="${4:-200}"
        
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        echo -n "Testing $test_name... "
        
        response=$(curl -s -w "%{http_code}" -X "$method" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -o /tmp/test_response \
            "${ADMIN_API_BASE}${endpoint}" 2>/dev/null)
        
        status_code="${response: -3}"
        
        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            
            # Show data summary for successful requests
            if [ "$status_code" = "200" ] && [ -f /tmp/test_response ]; then
                data_summary=$(head -n 1 /tmp/test_response | jq -r 'keys | join(", ")' 2>/dev/null)
                if [ "$data_summary" != "null" ] && [ -n "$data_summary" ]; then
                    echo -e "  ${BLUE}Data keys: $data_summary${NC}"
                fi
            fi
            return 0
        else
            echo -e "${RED}✗ FAIL${NC} (Status: $status_code, Expected: $expected_status)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            
            # Show error for debugging
            if [ -f /tmp/test_response ]; then
                error_msg=$(head -n 1 /tmp/test_response | jq -r '.error // empty' 2>/dev/null)
                if [ -n "$error_msg" ]; then
                    echo -e "  ${YELLOW}Error: $error_msg${NC}"
                fi
            fi
            return 1
        fi
    }
    
    # Test authenticated endpoints
    run_auth_test "Analytics Data" "/analytics"
    run_auth_test "Moments List" "/moments"
    run_auth_test "Sponsors List" "/sponsors"
    run_auth_test "Campaigns List" "/campaigns"
    run_auth_test "Subscribers List" "/subscribers"
    run_auth_test "Broadcasts List" "/broadcasts"
    run_auth_test "Moderation Queue" "/moderation"
    run_auth_test "Admin Users List" "/admin-users"
    
else
    echo -e "${YELLOW}Skipping authenticated tests - no auth token available${NC}"
fi

echo ""
echo -e "${BLUE}Phase 4: Public API Tests${NC}"
echo "========================="

# Test public endpoints (no auth required)
run_test "Public Stats API" "${ADMIN_API_BASE}/api/stats"
run_test "Public Moments API" "${ADMIN_API_BASE}/api/moments"

echo ""
echo -e "${BLUE}Phase 5: Database Schema Verification${NC}"
echo "===================================="

# Test if we can check database schema
echo -n "Testing Database Schema... "
if [ -f "/workspaces/moments/supabase/CLEAN_SCHEMA.sql" ]; then
    table_count=$(grep -c "CREATE TABLE" /workspaces/moments/supabase/CLEAN_SCHEMA.sql)
    echo -e "${GREEN}✓ PASS${NC} (Found $table_count tables in schema)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAIL${NC} (Schema file not found)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo -e "${BLUE}Phase 6: File Structure Verification${NC}"
echo "==================================="

# Check critical files
files_to_check=(
    "/workspaces/moments/public/admin-dashboard.html"
    "/workspaces/moments/public/js/admin.js"
    "/workspaces/moments/supabase/functions/admin-api/index.ts"
    "/workspaces/moments/supabase/functions/webhook/index.ts"
    "/workspaces/moments/vercel.json"
    "/workspaces/moments/.env"
)

for file in "${files_to_check[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Checking $(basename "$file")... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ EXISTS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ MISSING${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
done

echo ""
echo -e "${BLUE}Phase 7: Configuration Verification${NC}"
echo "=================================="

# Check environment variables
echo -n "Checking Environment Config... "
if grep -q "SUPABASE_URL=https://bxmdzcxejcxbinghtyfw.supabase.co" /workspaces/moments/.env; then
    echo -e "${GREEN}✓ PASS${NC} (Supabase URL correct)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAIL${NC} (Supabase URL mismatch)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Check Vercel config
echo -n "Checking Vercel Config... "
if grep -q "bxmdzxejcxbinghtytfw.supabase.co" /workspaces/moments/vercel.json; then
    echo -e "${GREEN}✓ PASS${NC} (Vercel routes correct)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAIL${NC} (Vercel config mismatch)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Check admin.js API base
echo -n "Checking Admin.js Config... "
if grep -q "bxmdzxejcxbinghtytfw.supabase.co" /workspaces/moments/public/js/admin.js; then
    echo -e "${GREEN}✓ PASS${NC} (Admin.js API base correct)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAIL${NC} (Admin.js API base mismatch)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "========================================"
echo -e "${BLUE}COMPREHENSIVE TEST RESULTS${NC}"
echo "========================================"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! System is fully operational.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the details above.${NC}"
    
    # Provide specific recommendations
    echo ""
    echo -e "${BLUE}RECOMMENDATIONS:${NC}"
    
    if [ -z "$AUTH_TOKEN" ]; then
        echo -e "• ${YELLOW}Fix admin authentication - check login credentials${NC}"
    fi
    
    if grep -q "✗ FAIL" /tmp/test_output 2>/dev/null; then
        echo -e "• ${YELLOW}Check Supabase Edge Functions deployment${NC}"
        echo -e "• ${YELLOW}Verify environment variables are correct${NC}"
        echo -e "• ${YELLOW}Ensure database schema is properly deployed${NC}"
    fi
    
    exit 1
fi

# Cleanup
rm -f /tmp/test_response /tmp/test_output