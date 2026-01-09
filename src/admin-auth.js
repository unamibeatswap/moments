import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Rate limiting check
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;
    
    if (!global.loginAttempts) global.loginAttempts = new Map();
    const attempts = global.loginAttempts.get(clientIP) || { count: 0, resetTime: now + windowMs };
    
    if (now > attempts.resetTime) {
      attempts.count = 0;
      attempts.resetTime = now + windowMs;
    }
    
    if (attempts.count >= maxAttempts) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }
    
    attempts.count++;
    global.loginAttempts.set(clientIP, attempts);

    // Call Supabase admin-api function server-side
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/admin-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (result.error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (result.success && result.token) {
      // Reset login attempts on successful login
      global.loginAttempts.delete(clientIP);
      
      res.json({
        success: true,
        token: result.token,
        user: result.user
      });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}