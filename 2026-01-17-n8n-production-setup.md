# Production-Grade n8n Setup for Moments

## Current State: NOT PRODUCTION READY ⚠️

The webhook now has MCP analysis, but we're missing the n8n automation layer which provides:
- Batch processing every 5 minutes
- Retry logic for failed analyses
- Monitoring and alerting
- Scalability and redundancy

## Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Message Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WhatsApp → Webhook → MCP Analysis → Auto-Approve (instant) │
│                  ↓                                           │
│              Database                                        │
│                  ↓                                           │
│              n8n (every 5 min) → Batch Process Pending      │
│                  ↓                                           │
│              Retry Failed → Alert on Issues                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Option 1: Self-Hosted n8n (Recommended for Production)

### Using Docker Compose

Create `/workspaces/moments/docker-compose.yml`:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: unami-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=${N8N_HOST:-localhost}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://moments-api.unamifoundation.org
      - GENERIC_TIMEZONE=Africa/Johannesburg
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n:/backup
    networks:
      - moments-network

  # Optional: PostgreSQL for n8n (for production persistence)
  postgres:
    image: postgres:15-alpine
    container_name: unami-n8n-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=${N8N_DB_PASSWORD}
      - POSTGRES_DB=n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - moments-network

volumes:
  n8n_data:
  postgres_data:

networks:
  moments-network:
    driver: bridge
```

### Deployment Steps

```bash
# 1. Set environment variables
export N8N_PASSWORD="your_secure_password"
export N8N_DB_PASSWORD="your_db_password"
export N8N_HOST="n8n.unamifoundation.org"

# 2. Start services
docker-compose up -d

# 3. Import workflows
# Access http://n8n.unamifoundation.org:5678
# Import from /n8n/soft-moderation-workflow.json

# 4. Configure Supabase credentials in n8n UI

# 5. Activate workflows
```

## Option 2: n8n Cloud (Easiest for Production)

### Pros
- Fully managed, no infrastructure
- Automatic updates and backups
- Built-in monitoring
- 99.9% uptime SLA

### Cons
- Monthly cost (~$20-50/month)
- Less control over infrastructure

### Setup
```bash
# 1. Sign up at https://n8n.io/cloud
# 2. Create workspace
# 3. Import workflows from /n8n/ directory
# 4. Add Supabase credentials
# 5. Configure webhook URLs
# 6. Activate workflows
```

## Option 3: Railway/Render Deployment (Middle Ground)

### Railway Deployment

Create `railway.toml`:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.n8n"

[deploy]
startCommand = "n8n start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[deploy.healthcheck]]
path = "/healthz"
port = 5678
```

Create `Dockerfile.n8n`:

```dockerfile
FROM n8nio/n8n:latest

USER root
RUN apk add --no-cache curl

USER node
WORKDIR /home/node

COPY n8n/*.json /home/node/.n8n/workflows/

EXPOSE 5678

CMD ["n8n", "start"]
```

Deploy:
```bash
railway up
railway variables set N8N_BASIC_AUTH_ACTIVE=true
railway variables set N8N_BASIC_AUTH_USER=admin
railway variables set N8N_BASIC_AUTH_PASSWORD=your_password
railway variables set SUPABASE_URL=your_url
railway variables set SUPABASE_SERVICE_KEY=your_key
```

## Best Practice: Hybrid Approach ✅

### What We Have Now (Phase 1)
- ✅ Webhook with instant MCP analysis
- ✅ Auto-approval for low-risk messages
- ✅ Advisory storage in database

### What We Need (Phase 2)
- ⚠️ n8n for batch processing
- ⚠️ Retry logic for failed analyses
- ⚠️ Monitoring and alerting

### Recommended Production Setup

1. **Primary**: Webhook handles 90% of messages instantly
2. **Backup**: n8n processes any missed messages every 5 minutes
3. **Monitoring**: n8n alerts on failures
4. **Scaling**: Both can scale independently

## Implementation Priority

### Immediate (Can Deploy Now)
- ✅ Webhook MCP analysis is working
- ✅ Auto-approval is functional
- ✅ System is operational without n8n

### Short-term (1-2 days)
- 🔶 Deploy n8n via Docker Compose or Cloud
- 🔶 Import soft-moderation workflow
- 🔶 Test batch processing

### Medium-term (1 week)
- 🔶 Add monitoring and alerting
- 🔶 Set up retry workflows
- 🔶 Configure backup strategies

## Current Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Webhook fails | Messages not analyzed | Deploy n8n as backup |
| High message volume | Webhook timeout | n8n batch processing |
| Analysis errors | Messages stuck | Retry workflow |
| No monitoring | Silent failures | Add alerting |

## Recommendation

**For Production Launch:**

1. **Week 1**: Deploy with webhook-only (current state)
   - Monitor message volume
   - Track auto-approval rates
   - Collect metrics

2. **Week 2**: Add n8n Cloud or Docker deployment
   - Import workflows
   - Enable batch processing
   - Set up monitoring

3. **Week 3**: Optimize based on real data
   - Tune confidence thresholds
   - Adjust batch frequency
   - Scale as needed

## Cost Analysis

| Option | Setup Time | Monthly Cost | Maintenance |
|--------|-----------|--------------|-------------|
| Webhook Only | ✅ Done | $0 | Low |
| + Docker n8n | 2 hours | $10-20 (VPS) | Medium |
| + n8n Cloud | 30 min | $20-50 | Low |
| Full Stack | 1 day | $50-100 | High |

## Decision

**Recommended**: Start with webhook-only (current), add n8n Cloud within 2 weeks.

**Why**: 
- Webhook handles 90% of use cases
- n8n Cloud is production-ready immediately
- No infrastructure management
- Easy to scale
- Can migrate to self-hosted later if needed

## Next Steps

1. ✅ Deploy webhook changes (done)
2. ⏳ Create Supabase RPC function (SQL file ready)
3. ⏳ Sign up for n8n Cloud OR set up Docker
4. ⏳ Import workflows
5. ⏳ Test end-to-end flow
6. ⏳ Monitor for 1 week
7. ⏳ Optimize based on data
