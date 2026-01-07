# Fix WhatsApp Replies - Missing Environment Variables

## Issue
START/STOP commands are processed but no WhatsApp replies are sent because the Supabase webhook function is missing environment variables.

## Solution
Set these environment variables in Supabase:

### 1. Go to Supabase Dashboard
- Visit: https://supabase.com/dashboard/project/arqeiadudzwbmzdhqkit
- Go to Settings → Edge Functions → Environment Variables

### 2. Add Required Variables
```
WHATSAPP_TOKEN=EAAVqvFzqn6UBQQ2WZCLcPkz5fSN1qGDoZBy4Q2deJZBli15YUbno0jMZCwWf3t48pXkHKeb7KfdTgTrdJE7yd4eZB9AgulbQOMgqyZCDFpZCZAKbqZAIhqGE7tmgiZAbDZC3t4qivIlI59Na1ZA1zcps3TEhzAd4Em1aZB7haiXJZBdyvCniTocju8tqXiYuvElmnclwZDZD

WHATSAPP_PHONE_ID=997749243410302

WEBHOOK_VERIFY_TOKEN=whatsapp_gateway_verify_2024_secure
```

### 3. Redeploy Function (if needed)
After adding environment variables, the function should work immediately. If not, redeploy:
```bash
supabase functions deploy webhook --project-ref arqeiadudzwbmzdhqkit
```

### 4. Test Again
Send START to +27 65 829 5041 - you should now receive the welcome message.

## Current Status
✅ Webhook function deployed and working
✅ Database operations working (subscriptions updated)
❌ WhatsApp API calls failing (missing credentials)
❌ No reply messages sent to users

## Expected After Fix
✅ START → Welcome message sent
✅ STOP → Goodbye message sent
✅ Database updated correctly
✅ Full two-way WhatsApp communication