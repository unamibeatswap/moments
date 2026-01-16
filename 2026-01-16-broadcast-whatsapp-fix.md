# 2026-01-16: WhatsApp Broadcast Fix - Intent System Investigation

## Issue Summary
Moments broadcasts reach PWA but not WhatsApp. All broadcasts stuck in "pending" or "processing" status with 0 delivered messages.

## Root Cause Analysis

### Architecture Discovery
- **Production**: Uses `server.js` (modular) NOT `server-bulletproof.js` (monolithic)
- **Deployment**: Vercel with auto-deploy from git
- **Broadcast System**: MCP-native intent-based architecture via `moment_intents` table
- **Processing**: n8n workflows consume intents and trigger WhatsApp delivery

### Current State
```
Broadcast Flow:
Admin Dashboard → POST /admin/moments/:id/broadcast → Creates moment_intents → n8n processes → WhatsApp API
                                                              ↓
                                                         BROKEN HERE
```

### Evidence
1. **Broadcasts table**: All show 0 delivered, stuck in pending/processing
2. **moment_intents table**: Only PWA intents created, NO WhatsApp intents
3. **Admin endpoint**: Creates PWA intent but fails to create WhatsApp intent
4. **n8n workflows**: Cannot process what doesn't exist

## Investigation Results

### Files Checked
- `/src/server.js` - Main production server (313 lines)
- `/src/admin.js` - Admin routes including broadcast endpoint
- `/src/broadcast.js` - Broadcast logic (256 lines)
- `/config/whatsapp.js` - WhatsApp API integration (has credentials)
- `/supabase/functions/broadcast-batch-processor/index.ts` - Edge function (not used in production)

### Key Finding
Admin broadcast endpoint at `/admin/moments/:id/broadcast`:
- ✅ Updates moment status to 'broadcasted'
- ✅ Creates PWA intent
- ❌ Does NOT create WhatsApp intent
- ❌ Intent creation logic incomplete or failing silently

## Fix Plan

### Step 1: Verify Intent Creation Logic
- [ ] Read full `/src/admin.js` broadcast endpoint
- [ ] Check if WhatsApp intent creation code exists
- [ ] Identify why WhatsApp intents aren't being created

### Step 2: Fix Intent Creation
- [ ] Ensure WhatsApp intent is created alongside PWA intent
- [ ] Add error handling and logging
- [ ] Verify intent structure matches n8n expectations

### Step 3: Test & Deploy
- [ ] Test locally with real broadcast
- [ ] Verify WhatsApp intent appears in database
- [ ] Commit and push to trigger Vercel deployment
- [ ] Monitor n8n workflow processing

### Step 4: Retry Stuck Broadcasts
- [ ] Create script to generate WhatsApp intents for stuck broadcasts
- [ ] Process all pending/processing broadcasts from last 48 hours

## Environment Variables Status
✅ WHATSAPP_TOKEN - Available in production
✅ WHATSAPP_PHONE_ID - Available in production
✅ SUPABASE_URL - Available
✅ SUPABASE_SERVICE_KEY - Available

## Next Actions
1. Read complete admin.js broadcast endpoint
2. Identify intent creation failure point
3. Implement fix
4. Deploy and verify

## Related Files
- `/src/admin.js` - Broadcast endpoint
- `/src/broadcast.js` - Broadcast utilities
- Database: `moment_intents`, `broadcasts`, `moments`
- n8n: Intent executor workflow

## Status: IN PROGRESS
**Blocker**: WhatsApp intents not being created by admin broadcast endpoint
**Impact**: All WhatsApp broadcasts failing, only PWA working
**Priority**: CRITICAL - Production issue affecting core functionality
