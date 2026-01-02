# Unami Foundation Moments App

**100% WhatsApp-native community engagement platform** for South Africa, featuring sponsored content distribution, MCP intelligence, and comprehensive admin controls.

## 🏗️ System Architecture

### Core Components
- **WhatsApp Business API** (+27 65 829 5041) - Message distribution
- **Supabase** - Database, media storage, real-time features
- **MCP Advisory System** - Content moderation and intelligence
- **PWA Admin Dashboard** - Content management interface
- **Railway API** - Webhook processing and broadcast system
- **n8n Workflows** - Automation and orchestration

### Agent Roles
1. **MCP Agent** - Content analysis and advisory generation
2. **Broadcast Agent** - WhatsApp message distribution
3. **Admin Agent** - Content and sponsor management
4. **PWA Agent** - Web interface and user experience
5. **Webhook Agent** - Message processing and routing

## 🚀 Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
# Configure your environment variables
```

### 2. Database Setup
```bash
# Run in Supabase SQL Editor:
# 1. supabase/schema.sql (base tables)
# 2. supabase/moments-schema.sql (Moments features)
```

### 3. Deploy
```bash
./deploy-moments.sh
npm start
```

### 4. Access Admin Dashboard
- Local: `http://localhost:3000`
- Production: `https://moments-api.unamifoundation.org`

## 📱 WhatsApp Integration

### Message Flow
1. **User sends message** → WhatsApp webhook → API processing
2. **MCP analysis** → Advisory generation → Database storage
3. **Admin creates Moment** → Broadcast system → WhatsApp distribution
4. **Users receive Moments** → No replies processed (broadcast only)

### Broadcast Format
```
📢 [Sponsored] Moment — KZN
Local women-led farming co-op opens new training hub.
📍 Open day: Friday
🌱 Skills & mentorship
Brought to you by Unami Foundation Partners
🌐 More info: /moments?province=KZN
```

### User Commands
- `START` / `JOIN` - Opt into broadcasts
- `STOP` / `UNSUBSCRIBE` - Opt out of broadcasts

## 🎛️ Admin Dashboard Features

### Dashboard
- Analytics overview (moments, subscribers, broadcasts)
- Success rates and engagement metrics
- Real-time status monitoring

### Moments Management
- Create/edit/schedule Moments
- Region and category targeting
- Media attachment support
- Sponsor assignment and labeling
- Broadcast scheduling and immediate sending

### Content Moderation
- MCP-flagged content review
- Advisory confidence scoring
- Escalation management
- Audit trail access

### Sponsor Management
- Sponsor profile creation
- Contact information management
- Sponsored content tracking

## 🗄️ Database Schema

### Core Tables
- `messages` - Incoming WhatsApp messages
- `media` - Media attachments and storage
- `advisories` - MCP intelligence outputs
- `flags` - Trust and safety markers

### Moments Tables
- `moments` - Content for broadcast
- `sponsors` - Sponsor information
- `broadcasts` - Broadcast logs and analytics
- `subscriptions` - User opt-in/opt-out status

## 🔒 Content Moderation

### MCP Advisory System
- **Language Detection** - Multilingual South African content
- **Harm Analysis** - Violence, harassment, scam detection
- **Spam Detection** - Pattern recognition and confidence scoring
- **Escalation Logic** - High-threshold flagging for human review

### Moderation Principles
- **Log everything, block nothing** - Advisory-only approach
- **Context over keywords** - Cultural and linguistic awareness
- **Human oversight** - Admin review for escalated content

## 🌍 Regional & Category Support

### Regions
- KZN (KwaZulu-Natal)
- WC (Western Cape)
- GP (Gauteng)
- EC (Eastern Cape)
- FS (Free State)
- LP (Limpopo)
- MP (Mpumalanga)
- NC (Northern Cape)
- NW (North West)

### Categories
- Education
- Safety
- Culture
- Opportunity
- Events
- Health
- Technology

## 📊 Analytics & Compliance

### Metrics Tracked
- Total Moments created and broadcasted
- Active subscriber count
- Broadcast success/failure rates
- MCP advisory outcomes
- Regional and category engagement

### Privacy & Compliance
- **No individual tracking** - Aggregate metrics only
- **GDPR/POPIA compliant** - User data protection
- **Sponsored content disclosure** - Clear labeling
- **Opt-out respect** - Immediate unsubscribe processing

## 🔧 API Endpoints

### Public
- `GET /health` - System health check
- `GET /webhook` - WhatsApp webhook verification
- `POST /webhook` - WhatsApp message processing

### Admin
- `GET /admin/analytics` - Dashboard metrics
- `GET /admin/moments` - Moments list with pagination
- `POST /admin/moments` - Create new Moment
- `PUT /admin/moments/:id` - Update Moment
- `POST /admin/moments/:id/broadcast` - Broadcast immediately
- `GET /admin/sponsors` - Sponsor management
- `GET /admin/moderation` - Flagged content review

## 🚀 Deployment

### Railway Configuration
```bash
# Environment variables required:
WHATSAPP_TOKEN=your_business_api_token
WHATSAPP_PHONE_ID=your_phone_number_id
WEBHOOK_VERIFY_TOKEN=your_webhook_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
MCP_ENDPOINT=https://mcp-production.up.railway.app/advisory
```

### WhatsApp Business API Setup
1. Configure webhook URL: `https://moments-api.unamifoundation.org/webhook`
2. Subscribe to message events
3. Verify webhook with your verify token
4. Test message flow

### Supabase Setup
1. Create new project
2. Run `supabase/schema.sql`
3. Run `supabase/moments-schema.sql`
4. Configure storage buckets for media
5. Set up RLS policies

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific components
npm test tests/webhook.test.js
npm test tests/integration.test.js

# Integration testing
./test-integration.sh
```

## 📝 Development

### Local Development
```bash
npm run dev  # Start with file watching
```

### Adding New Features
1. Update database schema if needed
2. Add API endpoints in `src/admin.js`
3. Update PWA frontend in `public/index.html`
4. Add tests in `tests/`
5. Update documentation

### MCP Integration
- Advisory endpoint: `/advisory`
- Input: Message content, metadata
- Output: Structured advisory with confidence scores
- Fallback: Safe defaults when MCP unavailable

## 🔗 Related Services

- **MCP Railway Service**: Content intelligence and moderation
- **n8n Workflows**: Message routing and automation
- **Supabase**: Database and real-time features
- **WhatsApp Business API**: Message distribution
- **Unami Foundation**: Main website and compliance pages

---

**Mission**: Empower South African communities through accessible, privacy-respecting, WhatsApp-native engagement while maintaining content quality and sponsor transparency.