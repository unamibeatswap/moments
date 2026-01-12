#!/bin/bash
# SECURITY REMEDIATION - URGENT
# Remove secrets from repository and prepare for token rotation

echo "🚨 SECURITY REMEDIATION - Phase 0"
echo "=================================="

# 1. Remove .env files from git tracking
echo "1. Removing .env files from git..."
git rm --cached .env .env.vercel .env.railway-free 2>/dev/null || true
echo ".env*" >> .gitignore

# 2. Create .env.example without secrets
echo "2. Creating .env.example template..."
cat > .env.example << 'EOF'
# WhatsApp Business API
WHATSAPP_TOKEN=your_whatsapp_token_here
WHATSAPP_PHONE_ID=your_phone_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Webhook Security
WEBHOOK_VERIFY_TOKEN=your_verify_token_here
WEBHOOK_HMAC_SECRET=your_hmac_secret_here
INTERNAL_WEBHOOK_SECRET=your_internal_secret_here

# Application Configuration
N8N_WEBHOOK_URL=https://your-domain.com/webhook
MCP_ENDPOINT=https://your-domain.com/mcp
PORT=8080
NODE_ENV=production

# Authentication
JWT_SECRET=your_jwt_secret_here
ADMIN_PASSWORD=your_secure_admin_password_here
EOF

# 3. Create security checklist
echo "3. Creating security checklist..."
cat > SECURITY_CHECKLIST.md << 'EOF'
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
EOF

echo "✅ Security remediation preparation complete!"
echo ""
echo "🚨 NEXT STEPS (MANUAL):"
echo "1. Rotate all tokens listed in SECURITY_CHECKLIST.md"
echo "2. Set new environment variables in deployment platforms"
echo "3. Run git add . && git commit -m 'security: remove secrets from repository'"
echo "4. Deploy with new environment variables"