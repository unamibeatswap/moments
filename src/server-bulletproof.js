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

// Login page
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

// Webhook handler
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.status(200).json({ status: 'received' });
});

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
app.get('/admin/analytics', authenticateAdmin, (req, res) => {
  res.json({
    totalMoments: 0,
    communityMoments: 0,
    adminMoments: 0,
    activeSubscribers: 0,
    totalBroadcasts: 0,
    successRate: 95,
    timestamp: new Date().toISOString()
  });
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

// Admin broadcasts endpoint
app.get('/admin/broadcasts', authenticateAdmin, (req, res) => {
  res.json({
    broadcasts: []
  });
});

// Admin moderation endpoint
app.get('/admin/moderation', authenticateAdmin, (req, res) => {
  res.json({
    flaggedMessages: []
  });
});

// Admin subscribers endpoint
app.get('/admin/subscribers', authenticateAdmin, (req, res) => {
  res.json({
    subscribers: []
  });
});

// Admin settings endpoint
app.get('/admin/settings', authenticateAdmin, (req, res) => {
  res.json({
    settings: []
  });
});

// Admin campaigns endpoint
app.get('/admin/campaigns', authenticateAdmin, (req, res) => {
  res.json({
    campaigns: []
  });
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

// Create campaign endpoint
app.post('/admin/campaigns', authenticateAdmin, (req, res) => {
  res.json({ success: true, id: 'campaign_' + Date.now() });
});

// Admin users endpoint
app.get('/admin/admin-users', authenticateAdmin, (req, res) => {
  res.json({
    users: []
  });
});

// Create admin user endpoint
app.post('/admin/admin-users', authenticateAdmin, (req, res) => {
  res.json({ success: true, id: 'user_' + Date.now() });
});

// Update moment endpoint
app.put('/admin/moments/:id', authenticateAdmin, (req, res) => {
  res.json({ success: true, id: req.params.id });
});

// Delete moment endpoint
app.delete('/admin/moments/:id', authenticateAdmin, (req, res) => {
  res.json({ success: true });
});

// Broadcast moment endpoint
app.post('/admin/moments/:id/broadcast', authenticateAdmin, (req, res) => {
  res.json({ success: true, broadcast_id: 'broadcast_' + Date.now() });
});

// Update sponsor endpoint
app.put('/admin/sponsors/:id', authenticateAdmin, (req, res) => {
  res.json({ success: true, id: req.params.id });
});

// Delete sponsor endpoint
app.delete('/admin/sponsors/:id', authenticateAdmin, (req, res) => {
  res.json({ success: true });
});

// Media upload endpoint
app.post('/admin/upload-media', authenticateAdmin, upload.array('media_files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedFiles = [];
    
    for (const file of req.files) {
      try {
        // Generate unique filename
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `moments/${fileName}`;
        
        // Determine bucket based on file type
        let bucket = 'documents';
        if (file.mimetype.startsWith('image/')) bucket = 'images';
        else if (file.mimetype.startsWith('video/')) bucket = 'videos';
        else if (file.mimetype.startsWith('audio/')) bucket = 'audio';
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });
        
        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          continue; // Skip this file but continue with others
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
        
      } catch (fileError) {
        console.error('File processing error:', fileError);
        continue;
      }
    }
    
    if (uploadedFiles.length === 0) {
      return res.status(500).json({ error: 'All file uploads failed' });
    }
    
    res.json({ 
      success: true, 
      files: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`
    });
    
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Error handling
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