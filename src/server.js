import express from 'express';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleWebhook, verifyWebhook } from './webhook.js';
import { supabase } from '../config/supabase.js';
import { callMCPAdvisory } from './advisory.js';
import { healthCheck } from './health.js';
import { scheduleNextBroadcasts } from './broadcast.js';
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
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
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
app.get('/admin.html', csrfCookieSetter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});

app.get('/admin-dashboard.html', csrfCookieSetter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});

// Mount admin routes with CSRF enforcement for state-changing requests
app.use('/admin', csrfMiddleware, adminRoutes);

// Admin login endpoint (no CSRF for login)
app.post('/admin/login', adminLogin);

// Mount public routes (no auth required)
app.use('/public', publicRoutes);

// Health check
app.get('/health', async (req, res) => {
  const health = await healthCheck();
  res.json(health);
});

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
    const testData = {
      id: 'test',
      content: 'test message',
      language_detected: 'eng',
      message_type: 'text',
      from_number: '27123456789',
      timestamp: new Date().toISOString()
    };
    const advisory = await callMCPAdvisory(testData);
    res.json({ status: 'mcp_working', advisory });
  } catch (err) {
    res.json({ status: 'mcp_failed', error: err.message });
  }
});

// Admin API routes (mounted above with CSRF middleware)

// WhatsApp webhook endpoints
app.get('/webhook', verifyWebhook);

// Middleware to verify incoming webhook requests from WhatsApp and internal systems.
const verifyIncomingWebhook = (req, res, next) => {
  // Internal n8n retries provide an internal secret header
  const internalSecret = req.get('x-internal-secret');
  if (internalSecret && process.env.INTERNAL_WEBHOOK_SECRET && internalSecret === process.env.INTERNAL_WEBHOOK_SECRET) {
    return next();
  }

  // Verify HMAC signature if provided (e.g., X-Hub-Signature-256)
  const signature = req.get('x-hub-signature-256') || req.get('x-hub-signature');
  const hmacSecret = process.env.WEBHOOK_HMAC_SECRET;
  if (signature && hmacSecret && req.rawBody) {
    try {
      import('crypto').then(({ createHmac }) => {
        const hmac = createHmac('sha256', hmacSecret).update(req.rawBody).digest('hex');
        const prefixed = `sha256=${hmac}`;
        if (signature === prefixed) return next();
        console.warn('Webhook HMAC mismatch');
        return res.status(403).json({ error: 'Invalid signature' });
      });
      return;
    } catch (err) {
      console.error('HMAC verification error', err.message);
      return res.status(500).json({ error: 'Signature verification failure' });
    }
  }

  // Fallback: if no signature or internal secret, reject
  return res.status(403).json({ error: 'Forbidden' });
};

app.post('/webhook', verifyIncomingWebhook, handleWebhook);

// PWA routes - Serve production landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});

app.get('/moments', (req, res) => {
  res.redirect('https://moments-pwa.unamifoundation.org/moments');
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

    // Start broadcast scheduler (check every 5 minutes) - with error handling
    try {
      setInterval(async () => {
        try {
          await scheduleNextBroadcasts();
        } catch (err) {
          console.error('Broadcast scheduler error:', err.message);
          if (process.env.SENTRY_DSN) Sentry.captureException(err);
        }
      }, 5 * 60 * 1000);
      console.log('Broadcast scheduler started');
    } catch (err) {
      console.error('Failed to start broadcast scheduler:', err.message);
    }
  });
}

export default app;