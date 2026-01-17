# MCP & Moderation System Analysis

## 🔍 Current State

### ✅ What's Working
1. **Webhook Function** - Receives WhatsApp messages, stores in `messages` table
2. **Admin Dashboard** - Shows moderation queue with manual approve/reject
3. **Database Schema** - `advisories` table exists with proper structure
4. **Broadcast System** - Successfully sends to WhatsApp and PWA

### ❌ What's NOT Working

#### 1. **No MCP Analysis on Incoming Messages**
- **Issue**: Messages are stored but NO advisory/risk analysis is performed
- **Evidence**: `advisories` table is empty, no confidence scores
- **Root Cause**: Webhook function doesn't call any MCP analysis
- **Impact**: Risk scores always show 0, no auto-moderation

#### 2. **Placeholder MCP Trigger**
- **Current**: Basic trigger creates dummy advisory with 0.8 confidence
- **Problem**: Not real analysis, just placeholder data
- **Location**: `CLEAN_SCHEMA.sql` line 307-318

#### 3. **n8n Soft Moderation Not Connected**
- **Workflow exists**: `soft-moderation-workflow.json`
- **Problem**: Calls `process_auto_approval_queue` RPC function that doesn't exist
- **Impact**: Auto-approval never happens, everything stays manual

#### 4. **No Real MCP Intelligence**
- **Expected**: Content analysis for harm, spam, urgency
- **Reality**: No AI/ML analysis happening anywhere
- **Missing**: Integration with actual MCP service or Claude API

## 🔧 Required Fixes

### Fix 1: Add Real MCP Analysis to Webhook

**File**: `/workspaces/moments/supabase/functions/webhook/index.ts`

Add after message insert (around line 200):

```typescript
// MCP Analysis using Claude
try {
  const mcpAnalysis = await analyzeMCPContent(content, message.from)
  
  // Store advisory
  await supabase.from('advisories').insert({
    message_id: messageRecord.id,
    advisory_type: 'content_quality',
    confidence: mcpAnalysis.confidence,
    harm_signals: mcpAnalysis.harm_signals,
    spam_indicators: mcpAnalysis.spam_indicators,
    urgency_level: mcpAnalysis.urgency_level,
    escalation_suggested: mcpAnalysis.confidence > 0.7
  })
  
  // Auto-approve if low risk
  if (mcpAnalysis.confidence < 0.3) {
    await supabase.from('messages').update({
      moderation_status: 'approved'
    }).eq('id', messageRecord.id)
    
    // Create moment automatically
    const { data: moment } = await supabase.from('moments').insert({
      title: content.substring(0, 50),
      content: content,
      region: 'National',
      category: 'Community',
      status: 'draft',
      created_by: 'auto_moderation',
      content_source: 'whatsapp'
    }).select().single()
    
    console.log(`✅ Auto-approved message ${messageRecord.id}, created moment ${moment.id}`)
  }
} catch (error) {
  console.error('MCP analysis failed:', error)
}

async function analyzeMCPContent(content: string, phoneNumber: string) {
  // Call Claude API or MCP service
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Analyze this community message for moderation. Return JSON with: confidence (0-1 risk score), harm_signals (violence, harassment, scam), spam_indicators (promotional, repetitive), urgency_level (low/medium/high).

Message: "${content}"

Return only valid JSON.`
      }]
    })
  })
  
  const result = await response.json()
  const analysis = JSON.parse(result.content[0].text)
  
  return {
    confidence: analysis.confidence || 0.5,
    harm_signals: analysis.harm_signals || {},
    spam_indicators: analysis.spam_indicators || {},
    urgency_level: analysis.urgency_level || 'low'
  }
}
```

### Fix 2: Create Auto-Approval RPC Function

**File**: Add to Supabase SQL Editor

```sql
CREATE OR REPLACE FUNCTION process_auto_approval_queue()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  msg RECORD;
BEGIN
  -- Get messages with low risk that are pending
  FOR msg IN 
    SELECT m.id, m.content, m.from_number, a.confidence
    FROM messages m
    LEFT JOIN advisories a ON a.message_id = m.id
    WHERE m.moderation_status = 'pending'
      AND a.confidence < 0.3
      AND m.created_at > NOW() - INTERVAL '24 hours'
    LIMIT 50
  LOOP
    -- Auto-approve message
    UPDATE messages 
    SET moderation_status = 'approved',
        moderation_timestamp = NOW()
    WHERE id = msg.id;
    
    -- Create moment
    INSERT INTO moments (title, content, region, category, status, created_by, content_source)
    VALUES (
      SUBSTRING(msg.content, 1, 50),
      msg.content,
      'National',
      'Community',
      'broadcasted',
      'auto_moderation',
      'whatsapp'
    );
    
    -- Log audit
    INSERT INTO moderation_audit (message_id, action, moderator, reason)
    VALUES (msg.id, 'approved', 'auto_moderation', 'Low risk: ' || msg.confidence::TEXT);
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Fix 3: Deploy n8n Workflow

```bash
# Check if n8n is running
curl http://localhost:5678/healthz

# If not running, start it
cd /workspaces/moments
./start-n8n.sh

# Import workflow via n8n UI
# 1. Open http://localhost:5678
# 2. Import n8n/soft-moderation-workflow.json
# 3. Activate workflow
```

### Fix 4: Add Environment Variable

```bash
# Add to Supabase edge function secrets
ANTHROPIC_API_KEY=your_claude_api_key_here
```

## 🎯 Expected Behavior After Fixes

1. **Message Received** → Webhook stores + MCP analyzes
2. **Low Risk (< 0.3)** → Auto-approved + Moment created instantly
3. **Medium Risk (0.3-0.7)** → Queued for admin review
4. **High Risk (> 0.7)** → Flagged + Escalated
5. **n8n Every 5 min** → Processes any pending low-risk messages
6. **Admin Dashboard** → Shows real confidence scores

## 📊 Verification Steps

```bash
# 1. Send test message via WhatsApp
# 2. Check advisory was created
curl "https://yfkqxqfzgfnssmgqzwwu.supabase.co/rest/v1/advisories?select=*&order=created_at.desc&limit=1" \
  -H "apikey: YOUR_KEY"

# 3. Check if auto-approved
curl "https://yfkqxqfzgfnssmgqzwwu.supabase.co/rest/v1/messages?select=id,content,moderation_status,advisories(confidence)&order=created_at.desc&limit=1" \
  -H "apikey: YOUR_KEY"

# 4. Check n8n logs
curl http://localhost:5678/rest/executions?limit=5
```

## 🚨 Priority Order

1. **HIGH**: Add MCP analysis to webhook (Fix 1) - Without this, no risk scores
2. **HIGH**: Create auto-approval RPC (Fix 2) - Enables automation
3. **MEDIUM**: Deploy n8n workflow (Fix 3) - Batch processing
4. **LOW**: Optimize MCP prompts - Fine-tuning

## 💡 Quick Win: Fake MCP for Testing

If you want to test the flow without Claude API:

```typescript
async function analyzeMCPContent(content: string, phoneNumber: string) {
  // Simple rule-based analysis
  const lowerContent = content.toLowerCase()
  
  let confidence = 0.2 // Default low risk
  const harm_signals = {}
  const spam_indicators = {}
  
  // Check for spam patterns
  if (content.includes('http') || content.includes('www.')) {
    confidence += 0.3
    spam_indicators.links = true
  }
  
  if (content.length < 10) {
    confidence += 0.2
    spam_indicators.too_short = true
  }
  
  // Check for harm patterns
  const harmWords = ['kill', 'attack', 'bomb', 'weapon']
  if (harmWords.some(word => lowerContent.includes(word))) {
    confidence += 0.5
    harm_signals.violence = true
  }
  
  return {
    confidence: Math.min(confidence, 1.0),
    harm_signals,
    spam_indicators,
    urgency_level: confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low'
  }
}
```

This gives you working risk scores immediately while you set up the real Claude integration.
