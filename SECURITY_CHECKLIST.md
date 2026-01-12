# 🔐 SECURITY REMEDIATION CHECKLIST

## URGENT ACTIONS REQUIRED:

### 1. Token Rotation (DO IMMEDIATELY):
- [ ] Generate new WhatsApp Business API token
- [ ] Create new Supabase project or rotate service role key
- [ ] Generate new WEBHOOK_HMAC_SECRET
- [ ] Update WEBHOOK_VERIFY_TOKEN
- [ ] Generate new JWT_SECRET

### 2. Environment Management:
- [ ] Set environment variables in Vercel dashboard
- [ ] Set environment variables in Supabase Edge Functions
- [ ] Remove all .env files from repository
- [ ] Verify .gitignore includes .env*

### 3. Webhook Security:
- [ ] Enable HMAC verification in webhook handlers
- [ ] Update WhatsApp webhook URL with new verify token
- [ ] Test webhook verification

### 4. Authentication Security:
- [ ] Implement proper password hashing (bcrypt)
- [ ] Remove plaintext password fallbacks
- [ ] Implement JWT with proper expiration

### 5. Database Security:
- [ ] Audit service role key usage
- [ ] Replace with anon key where possible
- [ ] Enable Row Level Security on all tables
