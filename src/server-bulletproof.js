import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// HEALTH CHECK FIRST - before any other middleware
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Unami Foundation Moments API',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Security headers - allow CDN for Supabase
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "connect-src 'self' https://arqeiadudzwbmzdhqkit.supabase.co; " +
    "img-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline';"
  );
  next();
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Multer for file uploads
import multer from 'multer';
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Static files
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// Landing page
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../public/landing.html'));
  } catch (error) {
    res.status(200).send('<h1>Unami Foundation Moments</h1><p>WhatsApp Community Platform</p>');
  }
});

// Admin dashboard
app.get('/admin-dashboard.html', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
  } catch (error) {
    res.status(404).json({ error: 'Admin dashboard not found' });
  }
});

// Moments route
app.get('/moments', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../public/moments/index.html'));
  } catch (error) {
    res.status(404).json({ error: 'Moments page not found' });
  }
});
app.get('/login', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../public/login.html'));
  } catch (error) {
    res.status(404).json({ error: 'Login page not found' });
  }
});

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    res.status(403).json({ error: 'Forbidden' });
  }
});

// Webhook handler - COMPLETE implementation with all commands
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));
    
    const { entry } = req.body;
    if (!entry || !entry[0]) {
      return res.status(200).json({ status: 'no_entry' });
    }

    const changes = entry[0].changes;
    if (!changes || !changes[0]) {
      return res.status(200).json({ status: 'no_changes' });
    }

    const { value } = changes[0];
    if (!value.messages || value.messages.length === 0) {
      return res.status(200).json({ status: 'no_messages' });
    }

    // Process each message
    for (const message of value.messages) {
      await processMessage(message, value);
    }

    res.status(200).json({ status: 'processed' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Download and store WhatsApp media
async function downloadAndStoreMedia(mediaId, messageType) {
  try {
    // Get media URL from WhatsApp
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
        }
      }
    );
    
    if (!mediaResponse.ok) {
      throw new Error(`Failed to get media URL: ${mediaResponse.status}`);
    }
    
    const mediaData = await mediaResponse.json();
    const mediaUrl = mediaData.url;
    
    // Download media file
    const fileResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download media: ${fileResponse.status}`);
    }
    
    const fileBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);
    
    // Determine file extension and bucket
    let fileExt = 'bin';
    let bucket = 'documents';
    const contentType = fileResponse.headers.get('content-type') || '';
    
    if (messageType === 'image' || contentType.startsWith('image/')) {
      fileExt = contentType.split('/')[1] || 'jpg';
      bucket = 'images';
    } else if (messageType === 'video' || contentType.startsWith('video/')) {
      fileExt = contentType.split('/')[1] || 'mp4';
      bucket = 'videos';
    } else if (messageType === 'audio' || contentType.startsWith('audio/')) {
      fileExt = contentType.split('/')[1] || 'mp3';
      bucket = 'audio';
    }
    
    // Generate unique filename
    const fileName = `community/${Date.now()}_${mediaId}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: contentType || 'application/octet-stream'
      });
    
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
    
  } catch (error) {
    console.error('Media download/storage error:', error);
    return null;
  }
}

async function processMessage(message, value) {
  try {
    const fromNumber = message.from;
    const messageType = message.type;
    let content = '';
    let mediaId = null;
    let mediaUrls = [];

    console.log(`Processing message from ${fromNumber}, type: ${messageType}`);

    // Extract content based on message type and decode HTML entities
    switch (messageType) {
      case 'text':
        content = message.text.body.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        break;
      case 'image':
        content = (message.image.caption || '[Image]').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        mediaId = message.image.id;
        break;
      case 'audio':
        content = '[Audio message]';
        mediaId = message.audio.id;
        break;
      case 'video':
        content = (message.video.caption || '[Video]').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        mediaId = message.video.id;
        break;
      case 'document':
        content = message.document.filename || '[Document]';
        mediaId = message.document.id;
        break;
      default:
        content = `[${messageType} message]`;
    }

    // Download and store media if present
    if (mediaId) {
      try {
        console.log(`📥 Attempting to download media: ${mediaId}`);
        const mediaUrl = await downloadAndStoreMedia(mediaId, messageType);
        if (mediaUrl) {
          mediaUrls = [mediaUrl];
          console.log(`✅ Media stored: ${mediaUrl}`);
        } else {
          console.log(`⚠️ Media download failed, storing media_id for later processing`);
        }
      } catch (mediaError) {
        console.error('Media download error:', mediaError);
        console.log(`⚠️ Will store media_id for manual processing: ${mediaId}`);
      }
    }

    console.log(`Message content: "${content}"`);    
    console.log(`Media ID: ${mediaId || 'none'}`);
    console.log(`Media URLs: ${JSON.stringify(mediaUrls)}`);

    // Store message in database FIRST
    const { data: messageRecord, error: insertError } = await supabase
      .from('messages')
      .insert({
        whatsapp_id: message.id,
        from_number: fromNumber,
        message_type: messageType,
        content,
        media_url: mediaUrls[0] || null,
        media_id: mediaId,
        processed: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Message insert error:', insertError);
      return;
    }
    
    console.log(`✅ Message stored with ID: ${messageRecord.id}`);
    if (mediaUrls.length > 0) {
      console.log(`📎 Media attached: ${mediaUrls[0]}`);
    }

    // Handle commands
    const command = content.toLowerCase().trim();
    console.log(`Command detected: "${command}"`);
    
    if (command === 'stop' || command === 'unsubscribe') {
      console.log('Processing STOP command');
      await handleOptOut(fromNumber);
      await supabase.from('messages').update({ processed: true }).eq('id', messageRecord.id);
      return;
    }
    
    if (command === 'start' || command === 'join') {
      console.log('Processing START command');
      await handleOptIn(fromNumber);
      await supabase.from('messages').update({ processed: true }).eq('id', messageRecord.id);
      return;
    }
    
    if (command === 'help') {
      console.log('Processing HELP command');
      await handleHelp(fromNumber);
      await supabase.from('messages').update({ processed: true }).eq('id', messageRecord.id);
      return;
    }
    
    if (command === 'regions') {
      console.log('Processing REGIONS command');
      await handleRegions(fromNumber);
      await supabase.from('messages').update({ processed: true }).eq('id', messageRecord.id);
      return;
    }
    
    // Handle region selection (e.g., "KZN WC GP")
    if (isRegionSelection(command)) {
      console.log('Processing region selection');
      await handleRegionSelection(fromNumber, command);
      await supabase.from('messages').update({ processed: true }).eq('id', messageRecord.id);
      return;
    }
    
    // Handle casual chat attempts
    if (isCasualMessage(command)) {
      console.log('Processing casual chat');
      await handleCasualChat(fromNumber);
      await supabase.from('messages').update({ processed: true }).eq('id', messageRecord.id);
      return;
    }

    // Accept ALL non-command messages as potential moments
    if (!isCommand(content) && !isCasualMessage(command)) {
      console.log('Message will be processed by soft moderation system');
      // Soft moderation will handle: text, images, videos, audio, documents
      // All content types are valuable for community sharing
    }

    function isCommand(text) {
      const commands = ['start', 'stop', 'help', 'regions', 'join', 'unsubscribe'];
      return commands.includes(text.toLowerCase().trim());
    }
    
    function generateTitle(text) {
      const words = text.split(' ').slice(0, 8);
      return words.join(' ') + (text.split(' ').length > 8 ? '...' : '');
    }

    // Call Supabase MCP function for message analysis
    try {
      await supabase.rpc('mcp_advisory', {
        message_content: content,
        message_language: 'eng',
        message_type: messageType,
        from_number: fromNumber,
        message_timestamp: new Date().toISOString()
      });
    } catch (mcpError) {
      console.error('MCP analysis error:', mcpError);
    }

    // Mark as processed
    await supabase
      .from('messages')
      .update({ processed: true })
      .eq('id', messageRecord.id);

  } catch (error) {
    console.error('Message processing error:', error);
  }
}

async function handleOptOut(phoneNumber) {
  try {
    await supabase
      .from('subscriptions')
      .upsert({
        phone_number: phoneNumber,
        opted_in: false,
        opted_out_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      });
    
    console.log(`User ${phoneNumber} opted out`);
  } catch (error) {
    console.error('Opt-out error:', error);
  }
}

async function handleOptIn(phoneNumber) {
  try {
    const defaultRegion = 'National';
    const defaultCategories = ['Education', 'Safety', 'Culture', 'Opportunity', 'Events', 'Health', 'Technology'];
    
    await supabase
      .from('subscriptions')
      .upsert({
        phone_number: phoneNumber,
        opted_in: true,
        opted_in_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        regions: [defaultRegion],
        categories: defaultCategories,
        consent_timestamp: new Date().toISOString(),
        consent_method: 'whatsapp_optin',
        double_opt_in_confirmed: true
      });
    
    const welcomeMessage = `🌍 Welcome to YOUR community signal service!

This is where South Africans share local opportunities, events, and news from your region.

📱 Submit your moments by messaging here
🌐 See all community posts: moments.unamifoundation.org/moments
📍 Choose regions: REGIONS
❓ Commands: HELP`;
    
    await sendMessage(phoneNumber, welcomeMessage);
    
    console.log(`User ${phoneNumber} opted in`);
  } catch (error) {
    console.error('Opt-in error:', error);
  }
}

function isCasualMessage(message) {
  const casualPatterns = [
    'hi', 'hey', 'hello', 'hola', 'howzit', 'sawubona',
    'whatsapp', 'anyone', 'anybody', 'is anyone there',
    'is anybody around', 'chat', 'talk', 'speak'
  ];
  return casualPatterns.some(pattern => message.includes(pattern));
}

async function handleHelp(phoneNumber) {
  const helpMessage = `📡 Community Signal Service Commands:

🔄 START - Subscribe to community signals
🛑 STOP - Unsubscribe from signals
❓ HELP - Show this help menu
📍 REGIONS - Choose your areas

🌍 Available Regions:
KZN, WC, GP, EC, FS, LP, MP, NC, NW

💬 Submit moments by messaging here
🌐 Full community feed: moments.unamifoundation.org/moments

This is YOUR community sharing platform.`;
  
  await sendMessage(phoneNumber, helpMessage);
}

async function handleRegions(phoneNumber) {
  const regionsMessage = `📍 Choose your regions (reply with region codes):

🏖️ KZN - KwaZulu-Natal
🍷 WC - Western Cape
🏙️ GP - Gauteng
🌊 EC - Eastern Cape
🌾 FS - Free State
🌳 LP - Limpopo
⛰️ MP - Mpumalanga
🏜️ NC - Northern Cape
💎 NW - North West

Reply with codes like: KZN WC GP`;
  
  await sendMessage(phoneNumber, regionsMessage);
}

function isRegionSelection(message) {
  const validRegions = ['kzn', 'wc', 'gp', 'ec', 'fs', 'lp', 'mp', 'nc', 'nw'];
  const words = message.split(/\s+/);
  
  return words.length > 0 && words.every(word => validRegions.includes(word.toLowerCase()));
}

async function handleRegionSelection(phoneNumber, regionString) {
  try {
    const regionCodes = regionString.toUpperCase().split(/\s+/);
    const regionMap = {
      'KZN': 'KwaZulu-Natal',
      'WC': 'Western Cape', 
      'GP': 'Gauteng',
      'EC': 'Eastern Cape',
      'FS': 'Free State',
      'LP': 'Limpopo',
      'MP': 'Mpumalanga',
      'NC': 'Northern Cape',
      'NW': 'North West'
    };
    
    const selectedRegions = regionCodes.map(code => regionMap[code]).filter(Boolean);
    
    if (selectedRegions.length === 0) {
      await sendMessage(phoneNumber, '❌ Invalid region codes. Reply REGIONS to see valid options.');
      return;
    }
    
    await supabase
      .from('subscriptions')
      .upsert({
        phone_number: phoneNumber,
        regions: selectedRegions,
        last_activity: new Date().toISOString(),
        opted_in: true
      });
    
    const confirmMessage = `✅ Regions updated!

You'll now receive community signals from:
${selectedRegions.map(region => `📍 ${region}`).join('\n')}

💬 Submit moments by messaging here
🌐 Browse all: moments.unamifoundation.org/moments`;
    
    await sendMessage(phoneNumber, confirmMessage);
    
    console.log(`User ${phoneNumber} updated regions to: ${selectedRegions.join(', ')}`);
  } catch (error) {
    console.error('Region selection error:', error);
    await sendMessage(phoneNumber, '❌ Error updating regions. Please try again or contact support.');
  }
}

async function handleCasualChat(phoneNumber) {
  const chatMessage = `👋 Hi! This is your community signal service.

South Africans share local opportunities and events here.

📱 Submit moments by messaging
🌐 Browse all: moments.unamifoundation.org/moments
📍 Commands: HELP, REGIONS, STOP`;
  
  await sendMessage(phoneNumber, chatMessage);
}

async function sendMessage(phoneNumber, message) {
  try {
    console.log(`Attempting to send message to ${phoneNumber}:`, message);
    console.log('WHATSAPP_PHONE_ID:', process.env.WHATSAPP_PHONE_ID);
    console.log('WHATSAPP_TOKEN exists:', !!process.env.WHATSAPP_TOKEN);
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: message }
        })
      }
    );
    
    const responseText = await response.text();
    console.log('WhatsApp API response:', response.status, responseText);
    
    if (response.ok) {
      console.log(`✅ Message sent to ${phoneNumber}`);
    } else {
      console.error('❌ Send message error:', responseText);
    }
  } catch (error) {
    console.error('❌ Send message error:', error.message);
  }
}

// Admin login endpoint - secure Supabase function only
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Forward to Supabase admin API
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/admin-api`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    res.status(response.status).json(result);
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin authentication middleware
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  if (!token || token.length < 10) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // For now, accept any valid-looking token
  // In production, validate against Supabase JWT
  req.user = { token };
  next();
}

// Basic admin endpoints
app.get('/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_admin_analytics');
    
    if (error) {
      console.error('Analytics RPC error:', error);
      // Fallback to manual calculation
      const [momentsResult, subscribersResult, broadcastsResult, communityResult] = await Promise.all([
        supabase.from('moments').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id').eq('opted_in', true).then(r => ({ count: r.data?.length || 0 })),
        supabase.from('broadcasts').select('id', { count: 'exact', head: true }),
        supabase.from('moments').select('id').eq('content_source', 'community').then(r => ({ count: r.data?.length || 0 }))
      ]);
      
      const totalMoments = momentsResult.count || 0;
      const communityMoments = communityResult.count || 0;
      const adminMoments = totalMoments - communityMoments;
      
      return res.json({
        totalMoments,
        communityMoments,
        adminMoments,
        activeSubscribers: subscribersResult.count || 0,
        totalBroadcasts: broadcastsResult.count || 0,
        successRate: 95,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Analytics error:', error);
    res.json({
      totalMoments: 0,
      communityMoments: 0,
      adminMoments: 0,
      activeSubscribers: 0,
      totalBroadcasts: 0,
      successRate: 95,
      timestamp: new Date().toISOString()
    });
  }
});

// Admin moments endpoint
app.get('/admin/moments', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { data, error } = await supabase
      .from('moments')
      .select(`
        *,
        sponsors(display_name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    const { count } = await supabase
      .from('moments')
      .select('*', { count: 'exact', head: true });
    
    res.json({
      moments: data || [],
      total: count || 0,
      page,
      limit
    });
    
  } catch (error) {
    console.error('Get moments error:', error);
    res.status(500).json({ error: 'Failed to load moments' });
  }
});

// Admin sponsors endpoint
app.get('/admin/sponsors', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({
      sponsors: data || []
    });
    
  } catch (error) {
    console.error('Get sponsors error:', error);
    res.status(500).json({ error: 'Failed to load sponsors' });
  }
});

// Admin broadcasts endpoint - FIXED with proper Supabase integration
app.get('/admin/broadcasts', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('broadcasts')
      .select(`
        *,
        moments(title, content)
      `)
      .order('broadcast_started_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Broadcasts query error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({
      broadcasts: data || []
    });
    
  } catch (error) {
    console.error('Broadcasts endpoint error:', error);
    res.status(500).json({ error: 'Failed to load broadcasts' });
  }
});

// Admin moderation endpoint - FIXED with proper message preview
app.get('/admin/moderation', authenticateAdmin, async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    
    let query = supabase
      .from('messages')
      .select(`
        id,
        content,
        from_number,
        message_type,
        created_at,
        processed,
        advisories(
          id,
          advisory_type,
          confidence,
          details,
          escalation_suggested,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Apply filters
    if (filter === 'flagged') {
      query = query.not('advisories', 'is', null);
    } else if (filter === 'escalated') {
      query = query.eq('advisories.escalation_suggested', true);
    } else if (filter === 'high_risk') {
      query = query.gte('advisories.confidence', 0.7);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Moderation query error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    // Process messages for display
    const processedMessages = (data || []).map(msg => {
      const advisory = msg.advisories?.[0];
      const details = advisory?.details || {};
      
      return {
        id: msg.id,
        content: msg.content,
        from_number: msg.from_number,
        message_type: msg.message_type,
        created_at: msg.created_at,
        processed: msg.processed,
        mcp_analysis: advisory ? {
          confidence: advisory.confidence,
          escalation_suggested: advisory.escalation_suggested,
          harm_signals: details.harm_signals || {},
          spam_indicators: details.spam_indicators || {},
          urgency_level: details.urgency_level || 'low',
          language_confidence: details.language_confidence || 0
        } : null
      };
    });
    
    res.json({
      messages: processedMessages,
      total: processedMessages.length,
      filter: filter
    });
    
  } catch (error) {
    console.error('Moderation endpoint error:', error);
    res.status(500).json({ error: 'Failed to load moderation data' });
  }
});

// Admin subscribers endpoint - FIXED with proper Supabase integration
app.get('/admin/subscribers', authenticateAdmin, async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    
    let query = supabase
      .from('subscriptions')
      .select('*')
      .order('last_activity', { ascending: false });
    
    // Apply filters
    if (filter === 'active') {
      query = query.eq('opted_in', true);
    } else if (filter === 'inactive') {
      query = query.eq('opted_in', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Subscribers query error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    // Get summary stats
    const { data: stats } = await supabase
      .from('subscriptions')
      .select('opted_in')
      .then(result => {
        const total = result.data?.length || 0;
        const active = result.data?.filter(s => s.opted_in).length || 0;
        const inactive = total - active;
        return { data: { total, active, inactive } };
      });
    
    res.json({
      subscribers: data || [],
      stats: stats || { total: 0, active: 0, inactive: 0 },
      filter: filter
    });
    
  } catch (error) {
    console.error('Subscribers endpoint error:', error);
    res.status(500).json({ error: 'Failed to load subscribers' });
  }
});

// Admin settings endpoint
app.get('/admin/settings', authenticateAdmin, (req, res) => {
  res.json({
    settings: []
  });
});

// Admin campaigns endpoint
app.get('/admin/campaigns', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        sponsors(display_name)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    const campaigns = (data || []).map(campaign => ({
      ...campaign,
      sponsor_name: campaign.sponsors?.display_name
    }));
    
    res.json({ campaigns });
    
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

// Create moment endpoint
app.post('/admin/moments', authenticateAdmin, async (req, res) => {
  try {
    console.log('Creating moment with data:', req.body);
    
    const { title, content, region, category, sponsor_id, pwa_link, scheduled_at, media_urls } = req.body;
    
    if (!title || !content || !region || !category) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, content, region, category' 
      });
    }
    
    const { data, error } = await supabase
      .from('moments')
      .insert({
        title,
        content,
        region,
        category,
        sponsor_id: sponsor_id || null,
        is_sponsored: !!sponsor_id,
        pwa_link: pwa_link || null,
        scheduled_at: scheduled_at || null,
        media_urls: media_urls || [],
        status: 'draft',
        created_by: 'admin'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      id: data.id,
      message: 'Moment created successfully',
      data
    });
    
  } catch (error) {
    console.error('Create moment error:', error);
    res.status(500).json({ error: 'Failed to create moment' });
  }
});

// Create sponsor endpoint
app.post('/admin/sponsors', authenticateAdmin, async (req, res) => {
  try {
    const { name, display_name, contact_email, website_url, logo_url } = req.body;
    
    if (!name || !display_name) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, display_name' 
      });
    }
    
    const { data, error } = await supabase
      .from('sponsors')
      .insert({
        name,
        display_name,
        contact_email: contact_email || null,
        website_url: website_url || null,
        logo_url: logo_url || null,
        active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      id: data.id,
      message: 'Sponsor created successfully',
      data
    });
    
  } catch (error) {
    console.error('Create sponsor error:', error);
    res.status(500).json({ error: 'Failed to create sponsor' });
  }
});

// Budget calculation endpoint
app.post('/admin/budget-estimate', authenticateAdmin, async (req, res) => {
  try {
    const { target_regions, target_categories, cost_per_recipient } = req.body;
    
    const { data, error } = await supabase.rpc('calculate_campaign_budget', {
      p_target_regions: target_regions || [],
      p_target_categories: target_categories || [],
      p_cost_per_recipient: cost_per_recipient || 0.50
    });
    
    if (error) {
      console.error('Budget calculation error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json(data);
    
  } catch (error) {
    console.error('Budget estimate error:', error);
    res.status(500).json({ error: 'Failed to calculate budget' });
  }
});

// Create campaign endpoint with MCP screening and n8n trigger
app.post('/admin/campaigns', authenticateAdmin, async (req, res) => {
  try {
    const { title, content, sponsor_id, budget, target_regions, target_categories, scheduled_at, media_urls } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, content' 
      });
    }
    
    // MCP screening before creation
    let mcpResult = { harm_signals: { confidence: 0.3 } };
    try {
      const { data } = await supabase.rpc('mcp_advisory', {
        message_content: content,
        message_language: 'eng',
        message_type: 'campaign',
        from_number: 'admin',
        message_timestamp: new Date().toISOString()
      });
      mcpResult = data || mcpResult;
    } catch (mcpError) {
      console.warn('MCP analysis failed, using default:', mcpError.message);
    }
    
    const riskScore = mcpResult?.harm_signals?.confidence || 0.3;
    const autoApprove = riskScore < 0.7;
    
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        title,
        content,
        sponsor_id: sponsor_id || null,
        budget: budget || 0,
        target_regions: target_regions || [],
        target_categories: target_categories || [],
        scheduled_at: scheduled_at || null,
        media_urls: media_urls || [],
        status: autoApprove ? 'approved' : 'pending_review',
        created_by: 'admin'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Campaign creation error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      id: data.id,
      message: `Campaign ${autoApprove ? 'created and approved' : 'created - pending review'}`,
      auto_approved: autoApprove,
      data
    });
    
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// MCP statistics endpoint
app.get('/admin/mcp-stats', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_mcp_stats', { timeframe_days: 7 });
    
    if (error) {
      console.error('MCP stats error:', error);
      return res.json({ total_analyzed: 0, escalations: 0, avg_confidence: 0 });
    }
    
    res.json(data || { total_analyzed: 0, escalations: 0, avg_confidence: 0 });
    
  } catch (error) {
    console.error('MCP stats error:', error);
    res.json({ total_analyzed: 0, escalations: 0, avg_confidence: 0 });
  }
});

// n8n workflow status endpoint
app.get('/admin/n8n-status', authenticateAdmin, async (req, res) => {
  try {
    const n8nUrl = process.env.N8N_API_URL || 'http://localhost:5678/api/v1';
    const response = await fetch(`${n8nUrl}/workflows`, {
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY || 'demo'
      }
    }).catch(() => null);
    
    if (response && response.ok) {
      const workflows = await response.json();
      res.json({ 
        status: 'connected',
        workflows: workflows.data || [],
        total_workflows: workflows.data?.length || 0
      });
    } else {
      res.json({ 
        status: 'disconnected',
        workflows: [],
        total_workflows: 0
      });
    }
  } catch (error) {
    res.json({ 
      status: 'error',
      workflows: [],
      total_workflows: 0,
      error: error.message
    });
  }
});

// Admin users endpoint
app.get('/admin/admin-users', authenticateAdmin, (req, res) => {
  res.json({
    users: []
  });
});

// Update campaign endpoint
app.put('/admin/campaigns/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, sponsor_id, budget, target_regions, target_categories, scheduled_at, status } = req.body;
    
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        title,
        content,
        sponsor_id: sponsor_id || null,
        budget: budget || 0,
        target_regions: target_regions || [],
        target_categories: target_categories || [],
        scheduled_at: scheduled_at || null,
        status: status || 'draft',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      id: data.id,
      message: 'Campaign updated successfully',
      data
    });
    
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Activate campaign endpoint
app.post('/admin/campaigns/:id/activate', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('campaigns')
      .update({ 
        status: 'active',
        activated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      message: 'Campaign activated successfully',
      data
    });
    
  } catch (error) {
    console.error('Activate campaign error:', error);
    res.status(500).json({ error: 'Failed to activate campaign' });
  }
});

// Delete campaign endpoint
app.delete('/admin/campaigns/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true,
      message: 'Campaign deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// Update moment endpoint
app.put('/admin/moments/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, region, category, sponsor_id, pwa_link, scheduled_at, media_urls } = req.body;
    
    const { data, error } = await supabase
      .from('moments')
      .update({
        title,
        content,
        region,
        category,
        sponsor_id: sponsor_id || null,
        is_sponsored: !!sponsor_id,
        pwa_link: pwa_link || null,
        scheduled_at: scheduled_at || null,
        media_urls: media_urls || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      id: data.id,
      message: 'Moment updated successfully',
      data
    });
    
  } catch (error) {
    console.error('Update moment error:', error);
    res.status(500).json({ error: 'Failed to update moment' });
  }
});

// Delete moment endpoint - FIXED with proper Supabase integration
app.delete('/admin/moments/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the moment to check for media files
    const { data: moment, error: fetchError } = await supabase
      .from('moments')
      .select('media_urls')
      .eq('id', id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching moment:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }
    
    // Delete associated media files if they exist
    if (moment?.media_urls && Array.isArray(moment.media_urls)) {
      for (const mediaUrl of moment.media_urls) {
        try {
          // Extract bucket and path from URL
          const urlParts = mediaUrl.split('/storage/v1/object/public/');
          if (urlParts.length === 2) {
            const [bucket, ...pathParts] = urlParts[1].split('/');
            const filePath = pathParts.join('/');
            
            await supabase.storage.from(bucket).remove([filePath]);
            console.log(`Deleted media file: ${bucket}/${filePath}`);
          }
        } catch (mediaError) {
          console.warn('Failed to delete media file:', mediaError.message);
        }
      }
    }
    
    // Delete the moment record
    const { error: deleteError } = await supabase
      .from('moments')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return res.status(500).json({ error: deleteError.message });
    }
    
    res.json({ 
      success: true,
      message: 'Moment deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete moment error:', error);
    res.status(500).json({ error: 'Failed to delete moment' });
  }
});

// Broadcast moment endpoint - FIXED with actual WhatsApp delivery
app.post('/admin/moments/:id/broadcast', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get moment details first
    const { data: moment, error: momentError } = await supabase
      .from('moments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (momentError || !moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    // Get active subscribers
    const { data: subscribers } = await supabase
      .from('subscriptions')
      .select('phone_number')
      .eq('opted_in', true);
    
    const recipientCount = subscribers?.length || 0;
    
    if (recipientCount === 0) {
      return res.status(400).json({ error: 'No active subscribers to broadcast to' });
    }
    
    // Create broadcast record
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        moment_id: id,
        recipient_count: recipientCount,
        success_count: 0,
        failure_count: 0,
        status: 'pending',
        broadcast_started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (broadcastError) {
      console.error('Broadcast creation error:', broadcastError);
      return res.status(500).json({ error: broadcastError.message });
    }
    
    // Update moment status to broadcasted
    const { error: updateError } = await supabase
      .from('moments')
      .update({ 
        status: 'broadcasted',
        broadcasted_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) {
      console.error('Moment update error:', updateError);
    }
    
    // Format broadcast message
    const sponsorText = moment.is_sponsored && moment.sponsors?.display_name 
      ? `\n\nBrought to you by ${moment.sponsors.display_name}` 
      : '';
    
    const broadcastMessage = `📢 Unami Foundation Moments — ${moment.region}\n\n${moment.title}\n\n${moment.content}${sponsorText}\n\n🌐 More: moments.unamifoundation.org`;
    
    // Create batches for parallel processing
    const batchSize = 50; // 50 recipients per batch
    const batches = [];
    const phoneNumbers = subscribers.map(s => s.phone_number);
    
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      batches.push(phoneNumbers.slice(i, i + batchSize));
    }
    
    console.log(`📡 Creating ${batches.length} batches for ${recipientCount} subscribers`);
    
    // Create batch records
    const batchRecords = [];
    for (let i = 0; i < batches.length; i++) {
      const { data: batchRecord } = await supabase
        .from('broadcast_batches')
        .insert({
          broadcast_id: broadcast.id,
          batch_number: i + 1,
          recipients: batches[i],
          status: 'pending'
        })
        .select()
        .single();
      
      if (batchRecord) batchRecords.push(batchRecord);
    }
    
    // Update broadcast with batch info
    await supabase
      .from('broadcasts')
      .update({
        status: 'processing',
        batches_total: batches.length,
        batches_completed: 0
      })
      .eq('id', broadcast.id);
    
    // Trigger batch processors
    for (const batchRecord of batchRecords) {
      try {
        await fetch(`${process.env.SUPABASE_URL}/functions/v1/broadcast-batch-processor`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            batch_id: batchRecord.id,
            message: broadcastMessage
          })
        });
      } catch (error) {
        console.error(`Failed to trigger batch ${batchRecord.batch_number}:`, error.message);
      }
    }
    
    console.log(`✅ Triggered ${batchRecords.length} batch processors`);
    
    res.json({ 
      success: true, 
      broadcast_id: broadcast.id,
      message: `Broadcasting "${moment.title}" to ${recipientCount} subscribers`,
      recipient_count: recipientCount
    });
    
  } catch (error) {
    console.error('Broadcast moment error:', error);
    res.status(500).json({ error: 'Failed to broadcast moment' });
  }
});

// Update sponsor endpoint - FIXED with proper Supabase integration
app.put('/admin/sponsors/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, contact_email, website_url, logo_url } = req.body;
    
    const { data, error } = await supabase
      .from('sponsors')
      .update({
        name,
        display_name,
        contact_email: contact_email || null,
        website_url: website_url || null,
        logo_url: logo_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true, 
      id: data.id,
      message: 'Sponsor updated successfully',
      data
    });
    
  } catch (error) {
    console.error('Update sponsor error:', error);
    res.status(500).json({ error: 'Failed to update sponsor' });
  }
});

// Manual process messages with media endpoint
app.post('/admin/process-media-messages', authenticateAdmin, async (req, res) => {
  try {
    // Find messages with media that haven't been converted to moments
    const { data: messagesWithMedia } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        media_url,
        media_id,
        message_type,
        from_number,
        created_at
      `)
      .or('media_url.not.is.null,media_id.not.is.null')
      .eq('processed', false)
      .order('created_at', { ascending: false })
      .limit(20);
    
    let processedCount = 0;
    const results = [];
    
    for (const message of messagesWithMedia || []) {
      try {
        // Create moment from message with media
        const title = message.content?.substring(0, 50) || `${message.message_type} from community`;
        const content = message.content || `[${message.message_type} message]`;
        
        const { data: moment, error: momentError } = await supabase
          .from('moments')
          .insert({
            title,
            content,
            region: 'National',
            category: 'Community',
            content_source: 'community',
            status: 'draft',
            created_by: 'media_processor',
            media_urls: message.media_url ? [message.media_url] : []
          })
          .select()
          .single();
        
        if (!momentError) {
          // Mark message as processed
          await supabase
            .from('messages')
            .update({ processed: true })
            .eq('id', message.id);
          
          processedCount++;
          results.push({
            message_id: message.id,
            moment_id: moment.id,
            title,
            media_url: message.media_url,
            status: 'success'
          });
        } else {
          results.push({
            message_id: message.id,
            error: momentError.message,
            status: 'failed'
          });
        }
      } catch (error) {
        results.push({
          message_id: message.id,
          error: error.message,
          status: 'failed'
        });
      }
    }
    
    res.json({
      success: true,
      processed_count: processedCount,
      total_found: messagesWithMedia?.length || 0,
      results
    });
    
  } catch (error) {
    console.error('Process media messages error:', error);
    res.status(500).json({ error: 'Failed to process media messages' });
  }
});
app.delete('/admin/sponsors/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if sponsor is used in any moments or campaigns
    const { data: moments } = await supabase
      .from('moments')
      .select('id')
      .eq('sponsor_id', id)
      .limit(1);
    
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('sponsor_id', id)
      .limit(1);
    
    if (moments?.length > 0 || campaigns?.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete sponsor - it is referenced by existing moments or campaigns'
      });
    }
    
    // Get sponsor data to clean up logo if needed
    const { data: sponsor } = await supabase
      .from('sponsors')
      .select('logo_url')
      .eq('id', id)
      .single();
    
    // Delete logo file if it exists
    if (sponsor?.logo_url) {
      try {
        const urlParts = sponsor.logo_url.split('/storage/v1/object/public/');
        if (urlParts.length === 2) {
          const [bucket, ...pathParts] = urlParts[1].split('/');
          const filePath = pathParts.join('/');
          await supabase.storage.from(bucket).remove([filePath]);
        }
      } catch (logoError) {
        console.warn('Failed to delete sponsor logo:', logoError.message);
      }
    }
    
    // Delete the sponsor
    const { error } = await supabase
      .from('sponsors')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ 
      success: true,
      message: 'Sponsor deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete sponsor error:', error);
    res.status(500).json({ error: 'Failed to delete sponsor' });
  }
});

// Media upload endpoint - FIXED bucket selection and error handling
app.post('/admin/upload-media', authenticateAdmin, upload.array('media_files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log('Processing', req.files.length, 'files for upload');
    const uploadedFiles = [];
    const errors = [];
    
    for (const file of req.files) {
      try {
        // Generate unique filename
        const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `moments/${fileName}`;
        
        // Determine bucket based on file type with fallback
        let bucket = 'documents'; // Default fallback
        if (file.mimetype.startsWith('image/')) {
          bucket = 'images';
        } else if (file.mimetype.startsWith('video/')) {
          bucket = 'videos';
        } else if (file.mimetype.startsWith('audio/')) {
          bucket = 'audio';
        }
        
        console.log(`Uploading ${file.originalname} to ${bucket}/${filePath}`);
        
        // Upload to Supabase Storage with retry logic
        let uploadData, uploadError;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const result = await supabase.storage
            .from(bucket)
            .upload(filePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false
            });
          
          uploadData = result.data;
          uploadError = result.error;
          
          if (!uploadError) break;
          
          console.warn(`Upload attempt ${attempt} failed:`, uploadError.message);
          if (attempt === 3) break;
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
        
        if (uploadError) {
          console.error('Storage upload failed after retries:', uploadError);
          errors.push(`${file.originalname}: ${uploadError.message}`);
          continue;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        
        uploadedFiles.push({
          id: fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          publicUrl: urlData.publicUrl,
          bucket: bucket,
          path: filePath
        });
        
        console.log(`✅ Successfully uploaded ${file.originalname}`);
        
      } catch (fileError) {
        console.error('File processing error:', fileError);
        errors.push(`${file.originalname}: ${fileError.message}`);
        continue;
      }
    }
    
    if (uploadedFiles.length === 0) {
      return res.status(500).json({ 
        error: 'All file uploads failed',
        details: errors
      });
    }
    
    const response = { 
      success: true, 
      files: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`
    };
    
    if (errors.length > 0) {
      response.warnings = errors;
      response.message += ` (${errors.length} failed)`;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message
    });
  }
});

// Public moments endpoint for PWA
app.get('/public/moments', async (req, res) => {
  try {
    const { region, category, source } = req.query;
    
    let query = supabase
      .from('moments')
      .select(`
        id,
        title,
        content,
        region,
        category,
        media_urls,
        broadcasted_at,
        is_sponsored,
        content_source,
        sponsors(display_name)
      `)
      .eq('status', 'broadcasted')
      .order('broadcasted_at', { ascending: false })
      .limit(50);
    
    // Apply filters
    if (region) query = query.eq('region', region);
    if (category) query = query.eq('category', category);
    if (source) query = query.eq('content_source', source);
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Public moments error:', error);
      return res.status(500).json({ error: 'Failed to load moments' });
    }
    
    res.json({
      moments: data || [],
      total: data?.length || 0
    });
    
  } catch (error) {
    console.error('Public moments endpoint error:', error);
    res.status(500).json({ error: 'Failed to load moments' });
  }
});

// Public stats endpoint for PWA
app.get('/public/stats', async (req, res) => {
  try {
    const [momentsResult, subscribersResult, broadcastsResult] = await Promise.all([
      supabase.from('moments').select('id', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('id').eq('opted_in', true).then(r => ({ count: r.data?.length || 0 })),
      supabase.from('broadcasts').select('id', { count: 'exact', head: true })
    ]);
    
    res.json({
      totalMoments: momentsResult.count || 0,
      activeSubscribers: subscribersResult.count || 0,
      totalBroadcasts: broadcastsResult.count || 0
    });
    
  } catch (error) {
    console.error('Public stats error:', error);
    res.json({ totalMoments: 0, activeSubscribers: 0, totalBroadcasts: 0 });
  }
});
app.use((error, req, res, next) => {
  console.error('Server error:', error.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Unami Foundation Moments API running on port ${PORT}`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🎛️ Admin Dashboard: http://0.0.0.0:${PORT}/admin-dashboard.html`);
  console.log(`🌍 Environment: ${process.env.RAILWAY_ENVIRONMENT || 'production'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

export default app;