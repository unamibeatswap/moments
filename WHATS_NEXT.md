# Admin API Update Instructions

## What Needs to Change

You need to update `/workspaces/moments/supabase/functions/admin-api/index.ts` with:
1. Enhanced campaign broadcast endpoint (replaces old one)
2. New analytics endpoints (adds to existing)

## Quick Summary

**Database**: ✅ DONE (migration deployed)  
**Admin API**: ⏳ NEEDS UPDATE  
**Testing**: ⏳ AFTER API UPDATE

---

## Next Action: Deploy Admin API

```bash
cd /workspaces/moments
supabase functions deploy admin-api
```

This will deploy the admin-api function with the existing code. The enhanced broadcast logic and analytics endpoints are in separate files ready to be integrated when you're ready to update the main index.ts file.

---

## What's Already Working

With just the database migration deployed, you already have:

✅ **New Database Fields**
- campaigns.created_by
- campaigns.authority_level  
- campaigns.institution_name
- campaigns.template_name
- campaigns.total_cost
- moments.campaign_id

✅ **New Tables**
- template_performance

✅ **New Views**
- campaign_performance

✅ **New Functions**
- lookup_campaign_authority()
- update_campaign_stats()
- log_template_performance()

---

## What Needs Admin API Update

⏳ **Enhanced Broadcast Logic**
- Authority lookup
- Template selection
- Budget enforcement
- Transaction logging

⏳ **New Analytics Endpoints**
- GET /analytics/campaigns
- GET /analytics/campaigns/{id}
- GET /analytics/templates
- GET /analytics/budget

---

## Simple Test (Without API Update)

You can test the database changes directly:

```sql
-- Test authority lookup
SELECT * FROM lookup_campaign_authority('+27123456789');

-- Test campaign performance view
SELECT * FROM campaign_performance LIMIT 5;

-- Test template performance table
SELECT * FROM template_performance;

-- Check new campaign columns
SELECT id, title, created_by, authority_level, template_name, total_cost 
FROM campaigns 
LIMIT 5;
```

---

## When You're Ready to Update Admin API

The enhanced code is in:
- `supabase/functions/admin-api/campaign-broadcast-endpoint.ts` (broadcast logic)
- `supabase/functions/admin-api/campaign-analytics-endpoints.ts` (analytics endpoints)

These need to be integrated into `supabase/functions/admin-api/index.ts` and then deployed.

---

**Current Status**: Database ready, API update pending  
**Impact**: Campaigns still work with old logic until API is updated  
**Risk**: None - all changes are additive and backward compatible
