# Claude API Deployment Guide

## ✅ Implementation Complete

The webhook now includes:
- **Claude API integration** for sophisticated AI analysis
- **Rule-based fallback** if API fails or key missing
- **Hybrid approach** for cost optimization

## 🚀 Deployment Steps

### Step 1: Get Claude API Key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Navigate to API Keys
4. Create new key
5. Copy the key (starts with `sk-ant-`)

### Step 2: Add to Supabase

```bash
# Via Supabase Dashboard:
# 1. Go to https://supabase.com/dashboard/project/yfkqxqfzgfnssmgqzwwu
# 2. Settings → Edge Functions → Secrets
# 3. Click "Add Secret"
# 4. Name: ANTHROPIC_API_KEY
# 5. Value: sk-ant-your-key-here
# 6. Save
```

### Step 3: Deploy Webhook Function

```bash
cd /workspaces/moments

# Deploy webhook with Claude integration
supabase functions deploy webhook --project-ref yfkqxqfzgfnssmgqzwwu
```

### Step 4: Deploy Auto-Approval RPC

```bash
# Run in Supabase SQL Editor:
# https://supabase.com/dashboard/project/yfkqxqfzgfnssmgqzwwu/sql

# Copy and paste contents from:
cat supabase/auto-approval-function.sql
```

### Step 5: Test

```bash
# Send test message via WhatsApp to +27 65 829 5041
# Message: "Hello, I want to share information about a local skills training program"

# Check logs
supabase functions logs webhook --project-ref yfkqxqfzgfnssmgqzwwu

# Should see: "🤖 Claude analysis: confidence=0.XX"
```

## 🔍 Verification

### Check Advisory Created
```bash
curl "https://yfkqxqfzgfnssmgqzwwu.supabase.co/rest/v1/advisories?select=*&order=created_at.desc&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlma3F4cWZ6Z2Zuc3NtZ3F6d3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NTU0NzksImV4cCI6MjA1MjUzMTQ3OX0.Aq-Vu-Yx-Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0" | jq .
```

### Check Auto-Approval
```bash
curl "https://yfkqxqfzgfnssmgqzwwu.supabase.co/rest/v1/messages?select=id,content,moderation_status,advisories(confidence)&order=created_at.desc&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlma3F4cWZ6Z2Zuc3NtZ3F6d3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NTU0NzksImV4cCI6MjA1MjUzMTQ3OX0.Aq-Vu-Yx-Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0Yx0" | jq .
```

## 🎯 How It Works

### With Claude API Key
```
Message → Webhook → Claude API → Risk Score → Auto-approve if < 0.3
                         ↓ (if fails)
                    Rule-based fallback
```

### Without Claude API Key
```
Message → Webhook → Rule-based analysis → Risk Score → Auto-approve if < 0.3
```

## 💰 Cost Monitoring

### Check Usage
```bash
# Visit: https://console.anthropic.com/settings/usage
# Monitor daily/monthly usage
```

### Expected Costs
- **Low volume** (100 messages/day): ~$0.75/month
- **Medium volume** (1,000 messages/day): ~$7.50/month
- **High volume** (10,000 messages/day): ~$75/month

### Cost Optimization
The system automatically falls back to free rule-based analysis if:
- API key not set
- API fails
- Rate limit reached

## 🔧 Troubleshooting

### Claude API Not Working
```bash
# Check logs
supabase functions logs webhook --project-ref yfkqxqfzgfnssmgqzwwu

# Look for:
# ✅ "🤖 Claude analysis: confidence=X.XX" (working)
# ⚠️ "Claude API failed, using rules" (fallback)
# 📋 "Rule-based analysis: confidence=X.XX" (no API key)
```

### API Key Issues
```bash
# Verify secret is set
supabase secrets list --project-ref yfkqxqfzgfnssmgqzwwu

# Should show: ANTHROPIC_API_KEY
```

### Rate Limits
```
Free tier: 50 requests/minute
Paid tier: 1,000 requests/minute

If exceeded, system falls back to rule-based automatically
```

## 📊 Monitoring

### Admin Dashboard
1. Go to Moderation section
2. Check confidence scores
3. Verify they're not all 0.2 (rule-based default)
4. Claude scores will vary: 0.05-0.95

### Database Queries
```sql
-- Check analysis distribution
SELECT 
  CASE 
    WHEN confidence < 0.3 THEN 'low_risk'
    WHEN confidence < 0.7 THEN 'medium_risk'
    ELSE 'high_risk'
  END as risk_level,
  COUNT(*) as count
FROM advisories
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY risk_level;

-- Check auto-approval rate
SELECT 
  moderation_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM messages
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY moderation_status;
```

## ✅ Success Criteria

After deployment, you should see:
- ✅ Confidence scores varying (not all 0.2)
- ✅ Auto-approval rate 60-70%
- ✅ Logs showing "Claude analysis" or "Rule-based analysis"
- ✅ Advisories table populated
- ✅ Admin dashboard showing risk scores

## 🎓 Next Steps

1. Deploy webhook with Claude integration
2. Add API key to Supabase secrets
3. Deploy auto-approval RPC function
4. Test with real messages
5. Monitor costs and accuracy
6. Adjust confidence thresholds if needed

## 📞 Support

If you encounter issues:
1. Check Supabase function logs
2. Verify API key is set correctly
3. Test with simple message first
4. Check Claude API console for errors
5. Fallback to rule-based will always work
