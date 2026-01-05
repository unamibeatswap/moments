import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists in admin_roles table
    const { data: adminUser, error } = await supabase
      .from('admin_roles')
      .select('*')
      .eq('user_id', email)
      .single();

    if (error || !adminUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // For development, accept any password for admin users
    // In production, implement proper password hashing
    const validPassword = process.env.NODE_ENV === 'development' || 
                         password === process.env.ADMIN_PASSWORD;

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: adminUser.user_id,
        role: adminUser.role,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      JWT_SECRET
    );

    res.json({ 
      token,
      user: {
        id: adminUser.user_id,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}