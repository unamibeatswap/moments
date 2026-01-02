# 🚀 Quick Deployment Guide

## **Vercel Deployment** (Recommended)

### **1. Quick Deploy**
```bash
npm run deploy:vercel
```

### **2. Manual Deploy**
```bash
npm install -g vercel
vercel login
vercel --prod
```

### **3. Environment Variables**
Set these in Vercel dashboard:
```
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_ID=your_phone_id
WEBHOOK_VERIFY_TOKEN=your_verify_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
MCP_ENDPOINT=https://mcp-production.up.railway.app/advisory
NODE_ENV=production
```

## **Railway Deployment**

### **Deploy**
```bash
npm run deploy:railway
```

## **Database Setup**

### **Run in Supabase SQL Editor:**
1. `supabase/schema.sql`
2. `supabase/moments-schema.sql` 
3. `supabase/enhanced-schema.sql`
4. `supabase/system-settings.sql`

## **Post-Deployment**

1. Configure WhatsApp webhook to your domain
2. Test admin dashboard
3. Upload logo via Settings tab
4. Create first moment
5. Test broadcast functionality

## **Access Points**

- **Admin**: `https://your-domain.vercel.app`
- **Settings**: Settings tab in admin
- **Health**: `https://your-domain.vercel.app/health`
- **Webhook**: `https://your-domain.vercel.app/webhook`

**System is production-ready!** 🎉