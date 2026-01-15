#!/bin/bash
# Phase 2 Verification Test

echo "=== Phase 2 Verification ==="
echo ""

echo "1. Testing Admin API is responding..."
ANALYTICS=$(curl -s 'https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/admin-api/analytics')
if echo "$ANALYTICS" | grep -q "totalMoments"; then
    echo "✅ Admin API responding"
else
    echo "❌ Admin API not responding"
    exit 1
fi

echo ""
echo "2. Database verification needed:"
echo "   Run in Supabase SQL Editor:"
echo "   SELECT * FROM system_settings WHERE setting_key IN ('monthly_budget', 'message_cost');"
echo ""

echo "3. Frontend verification:"
echo "   - Open: https://moments.unamifoundation.org/admin-dashboard.html"
echo "   - Login with credentials"
echo "   - Navigate to Budget Controls section"
echo "   - Verify form shows: R3,000 monthly budget, R0.12 message cost"
echo "   - Change monthly budget to R5,000"
echo "   - Click Save Budget Settings"
echo "   - Reload page - should show R5,000"
echo ""

echo "4. API endpoint test (requires session token):"
echo "   GET /budget/settings should return:"
echo '   {"success":true,"settings":{"monthly_budget":3000,"warning_threshold":80,"message_cost":0.12,"daily_limit":500}}'
echo ""

echo "=== Manual verification required for steps 2-4 ==="
