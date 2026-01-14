import express from 'express';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleWebhook, verifyWebhook } from './webhook.js';
import { supabase } from '../config/supabase.js';
import { healthCheck } from './health.js';
import { scheduleNextBroadcasts } from './broadcast.js';
import { processUrgentMoments, processWeeklyDigest } from './urgency.js';
import adminRoutes from './admin.js';
import publicRoutes from './public.js';
import { adminLogin } from './admin-auth.js';
import cookieParser from 'cookie-parser';
import { csrfMiddleware, csrfCookieSetter } from './csrf.js';
import cors from 'cors';

dotenv.config();

// Initialize Sentry if DSN provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development'
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Capture raw body for webhook HMAC verification
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Basic security headers (lightweight replacement for Helmet)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
  // Content Security Policy: restrict to same-origin and known CDNs
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://bxmdzcxejcxbinghtyfw.supabase.co https://api.supabase.com; img-src 'self' data: https:; media-src 'self' https:; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';");
  next();
});

// Attach Sentry request handler if enabled
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
}

// Simple in-memory rate limiter (per IP)
const rateWindowMs = 15 * 60 * 1000; // 15 minutes
const maxRequests = 300; // per window per IP
const ipMap = new Map();
app.use((req, res, next) => {
  try {
    const now = Date.now();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const entry = ipMap.get(ip) || { count: 0, start: now };
    if (now - entry.start > rateWindowMs) {
      entry.count = 1;
      entry.start = now;
    } else {
      entry.count += 1;
    }
    ipMap.set(ip, entry);
    if (entry.count > maxRequests) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
  } catch (err) {
    // do not block on rate limiter errors
  }
  next();
});

// Serve PWA static files
// Serve public assets and enable CORS for admin UI assets
app.use(cors({
  origin: process.env.ADMIN_ORIGIN || true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret']
}));

// Serve static files but exclude index.html to prevent conflicts
app.use(express.static(path.join(__dirname, '../public'), {
  index: false // Don't serve index.html automatically
}));

// parse cookies for CSRF handling
app.use(cookieParser());

// serve admin.html with csrf cookie set when ADMIN_CSRF_TOKEN is configured
app.get('/admin', csrfCookieSetter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});

app.get('/admin-dashboard.html', csrfCookieSetter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Admin login endpoint (no CSRF for login) - MUST be before admin routes
app.post('/admin/login', adminLogin);

// Mount admin routes with CSRF enforcement for state-changing requests
app.use('/admin', csrfMiddleware, adminRoutes);

// Mount public routes (no auth required)
app.use('/public', publicRoutes);

// API aliases for frontend compatibility
app.use('/api', (req, res, next) => {
  // Proxy to public-api function for stats and moments
  if (req.path === '/stats' || req.path === '/moments') {
    const proxyUrl = `https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/public-api${req.path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    
    fetch(proxyUrl)
      .then(response => response.json())
      .then(data => res.json(data))
      .catch(error => {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Service unavailable' });
      });
  } else {
    next();
  }
});
app.use('/api', publicRoutes);

// Health check
app.get('/health', async (req, res) => {
  const health = await healthCheck();
  res.json(health);
});

// Test endpoints
// Test endpoints
app.get('/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase.from('messages').select('count').limit(1);
    if (error) throw error;
    res.json({ status: 'supabase_connected', data });
  } catch (err) {
    res.json({ status: 'supabase_failed', error: err.message });
  }
});

app.get('/test-mcp', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('mcp_advisory', {
      message_content: 'test message',
      message_language: 'eng',
      message_type: 'text',
      from_number: '27123456789',
      message_timestamp: new Date().toISOString()
    });
    
    if (error) throw error;
    res.json({ status: 'supabase_mcp_working', advisory: data });
  } catch (err) {
    res.json({ status: 'supabase_mcp_failed', error: err.message });
  }
});

// Admin API routes (mounted above with CSRF middleware)

// WhatsApp webhook endpoints
app.get('/webhook', verifyWebhook);

// Middleware to verify incoming webhook requests from WhatsApp and internal systems.
const verifyIncomingWebhook = async (req, res, next) => {
  // Internal n8n retries provide an internal secret header
  const internalSecret = req.get('x-internal-secret');
  if (internalSecret && process.env.INTERNAL_WEBHOOK_SECRET && internalSecret === process.env.INTERNAL_WEBHOOK_SECRET) {
    return next();
  }

  // Verify HMAC signature if provided (e.g., X-Hub-Signature-256)
  const signature = req.get('x-hub-signature-256') || req.get('x-hub-signature');
  const hmacSecret = process.env.WEBHOOK_HMAC_SECRET;
  
  if (!signature && !hmacSecret) {
    console.warn('No HMAC signature or secret configured - webhook security disabled');
    return next();
  }
  
  if (signature && hmacSecret && req.rawBody) {
    try {
      const crypto = await import('crypto');
      const hmac = crypto.createHmac('sha256', hmacSecret).update(req.rawBody).digest('hex');
      const prefixed = `sha256=${hmac}`;
      
      if (signature === prefixed) {
        return next();
      }
      
      console.error('Webhook HMAC verification failed:', {
        expected: prefixed.substring(0, 20) + '...',
        received: signature.substring(0, 20) + '...'
      });
      return res.status(403).json({ error: 'Invalid signature' });
    } catch (err) {
      console.error('HMAC verification error:', err.message);
      return res.status(500).json({ error: 'Signature verification failure' });
    }
  }

  // If HMAC is configured but no signature provided, reject
  if (hmacSecret && !signature) {
    console.warn('HMAC secret configured but no signature provided');
    return res.status(403).json({ error: 'Missing signature' });
  }

  // Fallback: if no signature or internal secret, reject
  console.warn('Webhook request rejected - no valid authentication');
  return res.status(403).json({ error: 'Forbidden' });
};

app.post('/webhook', verifyIncomingWebhook, handleWebhook);

// PWA routes - Serve production landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Public PWA moments page
app.get('/moments', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/moments/index.html'));
});

app.get('/moments/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/moments/index.html'));
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  if (process.env.SENTRY_DSN) {
    try { import('@sentry/node').then(Sentry => Sentry.captureException(error)); } catch (e) {}
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Capture unhandled errors via Sentry error handler
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Export app for testing; start server only when not in test env
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Unami Foundation Moments API running on port ${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`Admin Dashboard: http://0.0.0.0:${PORT}`);

    // Start broadcast scheduler with urgency processing
    try {
      // Check urgent moments every 2 minutes
      setInterval(async () => {
        try {
          await processUrgentMoments();
        } catch (err) {
          console.error('Urgent broadcast error:', err.message);
          if (process.env.SENTRY_DSN) Sentry.captureException(err);
        }
      }, 2 * 60 * 1000);
      
      // Check scheduled broadcasts every 5 minutes
      setInterval(async () => {
        try {
          await scheduleNextBroadcasts();
        } catch (err) {
          console.error('Scheduled broadcast error:', err.message);
          if (process.env.SENTRY_DSN) Sentry.captureException(err);
        }
      }, 5 * 60 * 1000);
      
      // Weekly digest on Sundays at 9 AM
      setInterval(async () => {
        const now = new Date();
        if (now.getDay() === 0 && now.getHours() === 9) {
          try {
            await processWeeklyDigest();
          } catch (err) {
            console.error('Weekly digest error:', err.message);
          }
        }
      }, 60 * 60 * 1000); // Check every hour
      
      console.log('Enhanced broadcast scheduler started');
    } catch (err) {
      console.error('Failed to start broadcast scheduler:', err.message);
    }
  });
}

export default app;