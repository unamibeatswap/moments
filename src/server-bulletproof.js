import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
    "connect-src 'self' https://arqeiadudzwbmzdhqkit.supabase.co; " +
    "img-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline';"
  );
  next();
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Basic admin endpoints
app.get('/admin/analytics', (req, res) => {
  res.json({
    totalMoments: 0,
    activeSubscribers: 0,
    totalBroadcasts: 0,
    timestamp: new Date().toISOString()
  });
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