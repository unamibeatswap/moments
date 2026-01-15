#!/bin/bash
# Phase 1 Deployment Script
# Deploys critical fixes for campaign activation, budget settings, and sponsor refresh

set -e

echo "🚀 PHASE 1 DEPLOYMENT - Critical Fixes"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root"
    exit 1
fi

echo "📋 Pre-deployment checks..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Backup current function
echo "💾 Creating backup..."
if [ -f "supabase/functions/admin-api/index.ts.backup" ]; then
    rm supabase/functions/admin-api/index.ts.backup
fi
cp supabase/functions/admin-api/index.ts supabase/functions/admin-api/index.ts.backup
echo "✅ Backup created: admin-api/index.ts.backup"
echo ""

# Deploy admin-api function
echo "🚀 Deploying admin-api function..."
supabase functions deploy admin-api

if [ $? -eq 0 ]; then
    echo "✅ Admin API deployed successfully"
else
    echo "❌ Deployment failed"
    echo "💾 Restoring backup..."
    mv supabase/functions/admin-api/index.ts.backup supabase/functions/admin-api/index.ts
    exit 1
fi

echo ""
echo "🧪 Running post-deployment tests..."
echo ""

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/admin-api/help)

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check returned: $HEALTH_RESPONSE"
fi

echo ""
echo "✅ PHASE 1 DEPLOYMENT COMPLETE"
echo "======================================"
echo ""
echo "📝 Next Steps:"
echo "1. Clear browser cache and reload admin dashboard"
echo "2. Test campaign activation"
echo "3. Test budget settings save"
echo "4. Test sponsor creation and refresh"
echo ""
echo "📊 Monitoring:"
echo "- Check Supabase logs for errors"
echo "- Monitor browser console for issues"
echo "- Verify no CORS errors"
echo ""
echo "🔄 Rollback (if needed):"
echo "   mv supabase/functions/admin-api/index.ts.backup supabase/functions/admin-api/index.ts"
echo "   supabase functions deploy admin-api"
echo ""
echo "📈 Ready for Phase 2: Dynamic Budget Values"
