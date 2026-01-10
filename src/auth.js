import { supabase } from '../config/supabase.js';
import * as Sentry from '@sentry/node';

// Extract user from session token in Authorization header
export async function getUserFromRequest(req) {
  try {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.split(' ')[1];
    if (!token) return null;

    // Check if it's a session token (starts with 'session_')
    if (token.startsWith('session_')) {
      const { data: session, error } = await supabase
        .from('admin_sessions')
        .select('*, admin_users(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !session) {
        console.warn('Session validation error:', error?.message || 'Invalid session');
        return null;
      }

      return {
        id: session.admin_users.id,
        email: session.admin_users.email,
        name: session.admin_users.name
      };
    }

    // Fallback to Supabase auth token
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.warn('Supabase getUser error', error.message || error);
      return null;
    }
    const user = data?.user || null;
    if (user && process.env.SENTRY_DSN) {
      try { Sentry.setUser({ id: user.id, email: user.email }); } catch (e) {}
    }
    return user;
  } catch (err) {
    console.error('getUserFromRequest error', err.message || err);
    return null;
  }
}

export function requireAuth() {
  return async (req, res, next) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  };
}

export function requireRole(allowed = []) {
  return async (req, res, next) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;

    // Get token for session check
    const authHeader = req.get('authorization') || '';
    const token = authHeader.split(' ')[1];

    // Prefer explicit role mapping in `admin_roles` table
    try {
      const { data, error } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) console.warn('admin_roles lookup error', error.message || error);

      // For session tokens, assume admin role
      if (token && token.startsWith('session_')) {
        req.user_role = 'superadmin';
        return next();
      }

      // Use role from database or default
      const userRole = data?.role || 'moderator';
      req.user_role = userRole;

      // Check if user role is allowed
      if (allowed.length > 0 && !allowed.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (err) {
      console.error('requireRole error', err.message || err);
      return res.status(500).json({ error: 'Role verification failed' });
    }
  };
}

export default {
  getUserFromRequest,
  requireAuth,
  requireRole
};
