# Campaign Enhancements - Deployment Instructions

## ✅ Step 1: Database Migration (DONE)
```bash
# Already deployed to Supabase
✓ campaigns table updated with authority fields
✓ moments table has campaign_id
✓ template_performance table created
✓ campaign_performance view created
✓ Functions created: lookup_campaign_authority, update_campaign_stats, log_template_performance
```

## 🔧 Step 2: Update Admin API Function

### Option A: Manual Update (Recommended)

1. Open `/workspaces/moments/supabase/functions/admin-api/index.ts`

2. Find line 1614 (search for: `if (path.includes('/campaigns/') && path.includes('/broadcast')`)

3. Replace lines 1614-1750 with the content from:
   `/workspaces/moments/supabase/functions/admin-api/campaign-broadcast-endpoint.ts`

4. Add analytics endpoints after line 460 (after existing analytics section):
   Copy content from: `/workspaces/moments/supabase/functions/admin-api/campaign-analytics-endpoints.ts`

5. Deploy:
```bash
cd /workspaces/moments
supabase functions deploy admin-api
```

### Option B: Automated Script

```bash
# Create backup
cp supabase/functions/admin-api/index.ts supabase/functions/admin-api/index.ts.backup

# Apply changes (you'll need to manually merge the files)
# Then deploy
supabase functions deploy admin-api
```

## 🧪 Step 3: Test

### Test Campaign Broadcast
```bash
# Get a campaign ID
CAMPAIGN_ID="your-campaign-id"

# Broadcast it
curl -X POST "https://your-project.supabase.co/functions/v1/admin-api/campaigns/$CAMPAIGN_ID/broadcast" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "message": "Broadcasting campaign to X subscribers",
  "campaign_id": "...",
  "moment_id": "...",
  "broadcast_id": "...",
  "recipient_count": 100,
  "template": "verified_moment_v1",
  "authority_level": 3,
  "estimated_cost": 12.00
}
```

### Test Analytics
```bash
# Campaign analytics
curl "https://your-project.supabase.co/functions/v1/admin-api/analytics/campaigns?timeframe=30d" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Template performance
curl "https://your-project.supabase.co/functions/v1/admin-api/analytics/templates?timeframe=30d" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Budget overview
curl "https://your-project.supabase.co/functions/v1/admin-api/analytics/budget?timeframe=30d" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 📊 Step 4: Verify Database

```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'campaigns' 
AND column_name IN ('created_by', 'authority_level', 'template_name', 'total_cost');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('lookup_campaign_authority', 'update_campaign_stats', 'log_template_performance');

-- Check view exists
SELECT COUNT(*) FROM campaign_performance;

-- Check template_performance table
SELECT COUNT(*) FROM template_performance;
```

## 🎯 What's Working Now

After deployment:

✅ **Template Integration**
- Campaigns use approved WhatsApp templates
- Template selected based on authority level
- Marketing compliance logged

✅ **Authority Integration**
- Authority lookup for campaign creators
- Blast radius limits enforced
- Institution names in templates

✅ **Budget Enforcement**
- Budget checked before broadcast
- Transactions logged after broadcast
- Campaign stats updated automatically

✅ **Analytics**
- Campaign performance tracking
- Template performance comparison
- Budget overview dashboard

## 🚨 Troubleshooting

### Issue: "Function lookup_campaign_authority does not exist"
**Solution**: Re-run database migration
```bash
supabase db push --file supabase/migrations/20260117_campaign_enhancements.sql
```

### Issue: "Column created_by does not exist"
**Solution**: Check migration was applied
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'campaigns';
```

### Issue: "Budget check failed"
**Solution**: Ensure campaign_budgets table has entry
```sql
INSERT INTO campaign_budgets (campaign_id, total_budget, cost_per_message)
VALUES ('your-campaign-id', 100.00, 0.12);
```

### Issue: "Template not found"
**Solution**: Ensure templates are submitted to Meta and approved
- Check META_TEMPLATE_SUBMISSION.md for submission guide

## 📝 Next Steps

1. **Update Admin Dashboard UI** (optional)
   - Add campaign analytics tab
   - Show template performance
   - Display budget tracking

2. **Test with Real Campaigns**
   - Create campaign with authority
   - Broadcast and verify template used
   - Check analytics endpoints

3. **Monitor Performance**
   - Watch budget transactions
   - Track template delivery rates
   - Measure campaign ROI

## 🎉 Success Criteria

- [ ] Database migration applied
- [ ] Admin API deployed with new endpoints
- [ ] Campaign broadcast uses templates
- [ ] Authority limits enforced
- [ ] Budget tracking working
- [ ] Analytics endpoints returning data
- [ ] No errors in Supabase logs

---

**Status**: Database ✅ | API ⏳ | Testing ⏳  
**Next**: Deploy admin-api function
