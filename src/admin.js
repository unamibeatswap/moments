import express from 'express';
import { supabase } from '../config/supabase.js';
import { broadcastMoment, scheduleNextBroadcasts } from './broadcast.js';

const router = express.Router();

// Get all moments with pagination and filters
router.get('/moments', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, region, category } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('moments')
      .select(`
        *,
        sponsors(display_name),
        broadcasts(recipient_count, success_count, failure_count, status)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (region) query = query.eq('region', region);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ moments: data || [], page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new moment
router.post('/moments', async (req, res) => {
  try {
    const {
      title,
      content,
      region,
      category,
      language = 'eng',
      sponsor_id,
      is_sponsored = false,
      pwa_link,
      media_urls = [],
      scheduled_at,
      created_by = 'admin'
    } = req.body;

    if (!title || !content || !region || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const status = scheduled_at ? 'scheduled' : 'draft';

    const { data, error } = await supabase
      .from('moments')
      .insert({
        title,
        content,
        region,
        category,
        language,
        sponsor_id,
        is_sponsored,
        pwa_link,
        media_urls,
        scheduled_at,
        status,
        created_by
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ moment: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update moment
router.put('/moments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating broadcasted moments
    const { data: existing } = await supabase
      .from('moments')
      .select('status')
      .eq('id', id)
      .single();

    if (existing?.status === 'broadcasted') {
      return res.status(400).json({ error: 'Cannot update broadcasted moments' });
    }

    const { data, error } = await supabase
      .from('moments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ moment: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete moment
router.delete('/moments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('moments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast moment immediately
router.post('/moments/:id/broadcast', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await broadcastMoment(id);

    res.json({
      success: true,
      broadcast: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sponsors
router.get('/sponsors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    res.json({ sponsors: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create sponsor
router.post('/sponsors', async (req, res) => {
  try {
    const { name, display_name, contact_email } = req.body;

    if (!name || !display_name) {
      return res.status(400).json({ error: 'Name and display name required' });
    }

    const { data, error } = await supabase
      .from('sponsors')
      .insert({ name, display_name, contact_email })
      .select()
      .single();

    if (error) throw error;

    res.json({ sponsor: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get broadcast analytics
router.get('/analytics', async (req, res) => {
  try {
    const { data: moments } = await supabase
      .from('moments')
      .select('status')
      .not('status', 'eq', 'draft');

    const { data: broadcasts } = await supabase
      .from('broadcasts')
      .select('recipient_count, success_count, failure_count');

    const { data: subscribers } = await supabase
      .from('subscriptions')
      .select('opted_in');

    const totalMoments = moments?.length || 0;
    const totalBroadcasts = broadcasts?.length || 0;
    const totalRecipients = broadcasts?.reduce((sum, b) => sum + (b.recipient_count || 0), 0) || 0;
    const totalSuccess = broadcasts?.reduce((sum, b) => sum + (b.success_count || 0), 0) || 0;
    const activeSubscribers = subscribers?.filter(s => s.opted_in).length || 0;

    res.json({
      totalMoments,
      totalBroadcasts,
      totalRecipients,
      totalSuccess,
      activeSubscribers,
      successRate: totalRecipients > 0 ? (totalSuccess / totalRecipients * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get flagged content for moderation
router.get('/moderation', async (req, res) => {
  try {
    const { filter = 'all' } = req.query;
    
    let query = supabase
      .from('messages')
      .select(`
        *,
        advisories(*),
        flags(*)
      `)
      .eq('processed', true)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data, error } = await query;
    if (error) throw error;

    // Filter messages based on criteria
    let flaggedMessages = data || [];
    
    if (filter === 'flagged') {
      flaggedMessages = flaggedMessages.filter(msg => 
        msg.advisories?.some(adv => adv.confidence > 0.7) || msg.flags?.length > 0
      );
    } else if (filter === 'escalated') {
      flaggedMessages = flaggedMessages.filter(msg => 
        msg.advisories?.some(adv => adv.escalation_suggested)
      );
    }

    res.json({ flaggedMessages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sponsor
router.put('/sponsors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('sponsors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ sponsor: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sponsor
router.delete('/sponsors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('sponsors')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get broadcasts
router.get('/broadcasts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('broadcasts')
      .select(`
        *,
        moments(title, region, category)
      `)
      .order('broadcast_started_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ broadcasts: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get subscribers
router.get('/subscribers', async (req, res) => {
  try {
    const { filter = 'all' } = req.query;
    
    let query = supabase
      .from('subscriptions')
      .select('*')
      .order('last_activity', { ascending: false });

    if (filter === 'active') query = query.eq('opted_in', true);
    if (filter === 'inactive') query = query.eq('opted_in', false);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ subscribers: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('setting_key');

    if (error) throw error;
    res.json({ settings: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update system setting
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const { data, error } = await supabase
      .from('system_settings')
      .update({ 
        setting_value: value, 
        updated_by: 'admin', 
        updated_at: new Date().toISOString() 
      })
      .eq('setting_key', key)
      .select()
      .single();

    if (error) throw error;
    res.json({ setting: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process scheduled broadcasts (called by cron or manually)
router.post('/process-scheduled', async (req, res) => {
  try {
    await scheduleNextBroadcasts();
    res.json({ success: true, message: 'Scheduled broadcasts processed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;