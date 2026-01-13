# UNAMI FOUNDATION MOMENTS — SYSTEM DOCUMENTATION v2.0

**Production-Ready WhatsApp Community Engagement Platform**  
*Last Updated: January 13, 2026*

## 🏗️ SYSTEM ARCHITECTURE

### Core Infrastructure
- **WhatsApp Business API** (+27 65 829 5041) - Message distribution
- **Supabase** (bxmdzcxejcxbinghtyfw.supabase.co) - Database, storage, edge functions
- **Admin Dashboard** (PWA) - Content management interface  
- **Public Moments** (PWA) - Community display interface
- **Media Storage** - Supabase Storage bucket: `media`

### Authentication & Security
- **Admin Login**: `info@unamifoundation.org` / `Proof321#`
- **Session Management**: 24-hour tokens stored in `admin_sessions` table
- **Content Moderation**: 65% confidence threshold (was 80%)
- **CORS Enabled**: All origins allowed for development

## 📊 DATABASE SCHEMA

### Core Tables
```sql
-- Messages from WhatsApp
messages (id, whatsapp_id, from_number, content, media_url, timestamp, processed, moderation_status)

-- Content for broadcast  
moments (id, title, content, region, category, sponsor_id, media_urls, status, broadcasted_at)

-- User subscriptions
subscriptions (id, phone_number, opted_in, regions, categories, last_activity)

-- Broadcast history
broadcasts (id, moment_id, recipient_count, success_count, failure_count, status)

-- Content moderation
advisories (id, message_id, moment_id, confidence, harm_signals, urgency_level)

-- Sponsor management
sponsors (id, name, display_name, contact_email, website_url, logo_url, active)

-- Campaign system
campaigns (id, title, content, sponsor_id, budget, target_regions, status)

-- Admin access
admin_users (id, email, name, password_hash, active)
admin_sessions (id, token, admin_user_id, expires_at)
```

## 🔧 API ENDPOINTS

### Public APIs (No Auth)
- `GET /api/stats` - System statistics
- `GET /api/moments` - Public moments feed

### Admin APIs (Session Auth Required)
- `POST /` - Login (email/password)
- `GET /help` - API documentation
- `GET /analytics` - Dashboard metrics
- `GET /moments` - List all moments
- `POST /moments` - Create moment
- `PUT /moments/{id}` - Update moment  
- `DELETE /moments/{id}` - Delete moment
- `POST /moments/{id}/broadcast` - Broadcast now
- `GET /moderation` - Flagged content
- `POST /messages/{id}/approve` - Approve message
- `POST /messages/{id}/flag` - Flag message
- `POST /upload-media` - Upload files
- `GET /sponsors` - List sponsors
- `POST /sponsors` - Create sponsor
- `GET /campaigns` - List campaigns
- `POST /campaigns` - Create campaign
- `GET /subscribers` - Subscriber management
- `GET /broadcasts` - Broadcast history

## 📱 WHATSAPP INTEGRATION

### Phone Number: +27 65 829 5041
### Phone ID: 997749243410302

### User Commands
- `START` / `JOIN` - Subscribe to updates
- `STOP` / `UNSUBSCRIBE` - Opt out
- `HELP` - Get assistance
- `REGIONS` - Manage region preferences  
- `INTERESTS` - Manage category preferences
- `MOMENTS` - Content submission guidelines

### Message Flow
1. **Inbound**: WhatsApp → Webhook → Messages table → MCP analysis
2. **Moderation**: Admin review → Approve/Flag → Advisory creation
3. **Broadcasting**: Moment creation → Subscriber query → WhatsApp API
4. **Tracking**: Delivery status → Broadcast analytics

## 🎛️ ADMIN DASHBOARD FEATURES

### Dashboard Overview
- Real-time analytics (moments, subscribers, broadcasts)
- Success rate monitoring
- System health indicators

### Content Management
- **Moments**: Create, edit, schedule, broadcast
- **Media**: Upload images, videos, audio (Supabase Storage)
- **Sponsors**: Manage sponsor profiles and branding
- **Campaigns**: Advanced campaign management

### Moderation System
- **Confidence Scoring**: 65% threshold for flagging
- **Risk Levels**: HIGH (>65%), MEDIUM (>40%), LOW (≤40%)
- **Actions**: Approve, Flag, Preview
- **Audit Trail**: All actions logged

### User Management
- **Subscribers**: View, filter (active/inactive)
- **Admins**: User management (basic)
- **Sessions**: 24-hour token expiry

## 🌍 REGIONAL & CATEGORY SUPPORT

### Regions
- **KZN** - KwaZulu-Natal
- **WC** - Western Cape  
- **GP** - Gauteng
- **EC** - Eastern Cape
- **FS** - Free State
- **LP** - Limpopo
- **MP** - Mpumalanga
- **NC** - Northern Cape
- **NW** - North West

### Categories
- Education, Safety, Culture, Opportunity, Events, Health, Technology

## 📊 CONTENT MODERATION (MCP)

### Confidence Scoring System
- **0.0-0.40**: LOW RISK - Auto-approve eligible
- **0.41-0.65**: MEDIUM RISK - Review recommended  
- **0.66-1.0**: HIGH RISK - Manual review required

### Current Threshold: 65%
- **Rationale**: Balanced approach between safety and usability
- **Previous**: 80% (too conservative, flagged everything)
- **Impact**: More content flows through while maintaining safety

### Advisory Data Structure
```json
{
  "confidence": 0.65,
  "advisory_type": "content_quality",
  "harm_signals": {},
  "spam_indicators": {},
  "urgency_level": "medium",
  "escalation_suggested": false
}
```

## 💾 MEDIA HANDLING

### Storage Configuration
- **Bucket**: `media` (public)
- **Path Structure**: `moments/{timestamp}_{random}_{filename}`
- **Supported Types**: Images (jpg, png, gif), Videos (mp4, webm), Audio (mp3, wav)
- **Upload Endpoint**: `POST /upload-media` (multipart/form-data)

### Frontend Display
- **Single Image**: 16:9 aspect ratio, max 300px height
- **Multiple Images**: Responsive grid (2x2, 3x1, etc.)
- **Gallery Modal**: Click to expand with navigation
- **Mobile Optimized**: Touch-friendly controls

## 🚀 DEPLOYMENT STATUS

### Current Environment: Production
- **Supabase Project**: bxmdzcxejcxbinghtyfw.supabase.co
- **Admin Dashboard**: moments.unamifoundation.org/admin-dashboard.html
- **Public Moments**: moments.unamifoundation.org/moments
- **WhatsApp Webhook**: Supabase Edge Function

### Edge Functions Deployed
- `admin-api` - Main admin API (1267 lines, 32 endpoints)
- `webhook` - WhatsApp message processing
- `broadcast-webhook` - Message broadcasting

### Environment Variables
```bash
SUPABASE_URL=https://bxmdzcxejcxbinghtyfw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[REDACTED]
WHATSAPP_TOKEN=[REDACTED]  
WHATSAPP_PHONE_ID=997749243410302
WEBHOOK_VERIFY_TOKEN=[REDACTED]
```

## ✅ VERIFICATION CHECKLIST

### Core Functionality ✅
- [x] WhatsApp webhook processing
- [x] Admin authentication & sessions
- [x] Moment creation & broadcasting  
- [x] Media upload & display
- [x] Content moderation (65% threshold)
- [x] Subscriber management
- [x] Sponsor management
- [x] Campaign system
- [x] Analytics dashboard
- [x] Mobile-responsive design

### Recent Fixes ✅
- [x] Moderation buttons (approve/flag) working
- [x] Moment deletion with cascade cleanup
- [x] Mobile stats visibility (white text issue)
- [x] Broadcast history with context
- [x] Media gallery with responsive layouts
- [x] Confidence threshold updated to 65%
- [x] Admin help endpoint added

## 🔐 SECURITY & COMPLIANCE

### Data Protection
- **No individual tracking** - Aggregate metrics only
- **GDPR/POPIA compliant** - User data protection
- **Opt-out respect** - Immediate unsubscribe processing
- **Audit trails** - All admin actions logged

### Content Guidelines
- **Prohibited**: Politics, financial advice, medical advice, gambling
- **Encouraged**: Education, safety, culture, opportunities, events, health, environment
- **Sponsored content**: Clearly labeled and disclosed

## 📈 ANALYTICS & METRICS

### Dashboard Metrics
- Total moments created/broadcasted
- Active subscriber count  
- Broadcast success/failure rates
- Regional and category engagement
- MCP advisory outcomes

### Performance Indicators
- **Success Rate**: Delivery success percentage
- **Engagement**: Click-through to PWA
- **Growth**: Subscriber acquisition rate
- **Quality**: Content approval rate

## 🛠️ MAINTENANCE & OPERATIONS

### Regular Tasks
- Monitor broadcast success rates
- Review flagged content in moderation queue
- Update sponsor information
- Analyze engagement metrics
- System health monitoring

### Troubleshooting
- **Login Issues**: Check admin_users table, verify password
- **Broadcast Failures**: Check WhatsApp token, subscriber count
- **Media Upload**: Verify Supabase Storage permissions
- **Moderation**: Check confidence threshold, advisory creation

### Support Contacts
- **Technical**: System administrator
- **Content**: Community moderators  
- **WhatsApp**: Meta Business support

---

## 📝 CHANGELOG

### v2.0.0 (January 13, 2026)
- Restored full admin-api functionality (1267 lines)
- Updated confidence threshold: 80% → 65%
- Added comprehensive help endpoint
- Fixed moderation approve/flag buttons
- Enhanced broadcast history with context
- Optimized media display for mobile
- Removed deprecated Railway references
- Added responsive media gallery

### v1.0.0 (Previous)
- Initial system implementation
- Basic WhatsApp integration
- Admin dashboard MVP
- Content moderation system

---

**System Status**: ✅ PRODUCTION READY  
**Last Verification**: January 13, 2026  
**Next Review**: February 13, 2026