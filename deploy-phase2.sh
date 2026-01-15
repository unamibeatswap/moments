#!/bin/bash
# Phase 2 Deployment: Dynamic Budget Values
# Run this script to deploy Phase 2 changes

echo "=== Phase 2: Dynamic Budget Values Deployment ==="
echo ""

echo "Step 1: Seed database with default budget settings"
echo "Run this SQL in Supabase SQL Editor:"
echo "---"
cat supabase/seed_budget_settings.sql
echo "---"
echo ""

echo "Step 2: Deploy admin API function"
echo "The admin-api function has been updated with:"
echo "  - GET /budget/settings endpoint to retrieve dynamic values"
echo "  - Existing PUT /budget/settings endpoint for saving"
echo ""
echo "Deploy via Supabase Dashboard:"
echo "  1. Go to Edge Functions"
echo "  2. Select admin-api"
echo "  3. Click 'Deploy new version'"
echo "  4. Upload: supabase/functions/admin-api/index.ts"
echo ""

echo "Step 3: Frontend changes deployed automatically"
echo "  - admin.js updated to load settings from database"
echo "  - Budget form now uses dynamic values"
echo "  - Hardcoded defaults removed"
echo ""

echo "Step 4: Verification"
echo "After deployment, verify:"
echo "  1. Budget settings page loads values from database"
echo "  2. Save button updates database correctly"
echo "  3. Values persist across page reloads"
echo ""

echo "=== Phase 2 Complete ==="
