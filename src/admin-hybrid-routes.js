import { broadcastMomentHybrid, getHybridAnalytics } from './broadcast-hybrid.js';

// Add to your existing admin.js routes

// Hybrid broadcast endpoint
app.post('/admin/moments/:id/broadcast-hybrid', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Starting hybrid broadcast for moment ${id}`);
    const result = await broadcastMomentHybrid(id);
    
    res.json({
      success: true,
      broadcast: result,
      message: `Broadcast sent to ${result.recipients} subscribers using hybrid system`
    });
  } catch (error) {
    console.error('Hybrid broadcast error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Hybrid analytics endpoint
app.get('/admin/analytics/hybrid', authenticateAdmin, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    const analytics = await getHybridAnalytics(timeframe);
    
    res.json({
      success: true,
      analytics,
      system: 'hybrid_2_template'
    });
  } catch (error) {
    console.error('Hybrid analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Template status endpoint
app.get('/admin/templates/status', authenticateAdmin, async (req, res) => {
  try {
    const templates = {
      working: [
        {
          name: 'hello_world',
          category: 'UTILITY',
          status: 'ACTIVE',
          use_case: 'Welcome messages, notifications outside 24h window'
        },
        {
          name: 'unsubscribe_confirmation', 
          category: 'MARKETING',
          status: 'ACTIVE',
          use_case: 'Opt-out confirmations'
        }
      ],
      rejected: [
        'welcome_confirmation',
        'moment_simple',
        'sponsored_simple',
        'community_update',
        'partner_update',
        'subscription_preferences'
      ],
      system_approach: 'hybrid_freeform_template'
    };
    
    res.json({
      success: true,
      templates,
      recommendation: 'Use freeform messages within 24h window for rich content'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});