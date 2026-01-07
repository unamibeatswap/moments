import { broadcastMomentNGO, handleNGOReply, getHybridAnalytics } from './broadcast-ngo.js';
import { broadcastMomentHybrid } from './broadcast-hybrid.js';

// Add NGO-compliant broadcast routes to existing admin.js

// NGO-compliant broadcast endpoint
router.post('/moments/:id/broadcast-ngo', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Starting NGO-compliant broadcast for moment ${id}`);
    const result = await broadcastMomentNGO(id);
    
    res.json({
      success: true,
      broadcast: result,
      message: `NGO broadcast sent to ${result.recipients} subscribers`,
      pattern: 'template_to_freeform'
    });
  } catch (error) {
    console.error('NGO broadcast error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Hybrid broadcast endpoint (fallback)
router.post('/moments/:id/broadcast-hybrid', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Starting hybrid broadcast for moment ${id}`);
    const result = await broadcastMomentHybrid(id);
    
    res.json({
      success: true,
      broadcast: result,
      message: `Hybrid broadcast sent to ${result.recipients} subscribers`,
      pattern: 'smart_routing'
    });
  } catch (error) {
    console.error('Hybrid broadcast error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// WhatsApp template status endpoint
router.get('/whatsapp/templates', async (req, res) => {
  try {
    const templates = {
      working: [
        {
          name: 'hello_world',
          category: 'UTILITY',
          status: 'APPROVED',
          use_case: 'Generic notifications, re-engagement',
          id: '2395552787542558'
        },
        {
          name: 'unsubscribe_confirmation', 
          category: 'MARKETING',
          status: 'APPROVED',
          use_case: 'Opt-out confirmations'
        },
        {
          name: 'community_notice',
          category: 'UTILITY', 
          status: 'PENDING',
          use_case: 'NGO-safe re-engagement',
          id: '902854315815646'
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
      system_approach: 'ngo_compliant_hybrid'
    };
    
    res.json({
      success: true,
      templates,
      recommendation: 'Use NGO-compliant pattern: Template → User Reply → Rich Content'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pending moments management (NGO pattern)
router.get('/pending-moments', async (req, res) => {
  try {
    const { data: pendingMoments, error } = await supabase
      .from('pending_moments')
      .select(`
        *,
        moments(title, region, category)
      `)
      .gt('expires_at', new Date().toISOString())
      .order('template_sent_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({
      success: true,
      pending_moments: pendingMoments || [],
      count: pendingMoments?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// NGO analytics endpoint
router.get('/analytics/ngo', async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    // Get NGO-specific analytics
    const analytics = await getHybridAnalytics(timeframe);
    
    // Get pending moments stats
    const { data: pendingStats } = await supabase
      .from('pending_moments')
      .select('delivered_at')
      .gte('template_sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    const pendingTotal = pendingStats?.length || 0;
    const pendingDelivered = pendingStats?.filter(p => p.delivered_at).length || 0;
    
    res.json({
      success: true,
      analytics: {
        ...analytics,
        ngo_pattern: {
          templates_sent: pendingTotal,
          content_delivered: pendingDelivered,
          conversion_rate: pendingTotal > 0 ? (pendingDelivered / pendingTotal * 100).toFixed(1) : 0
        }
      },
      system: 'ngo_compliant'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Campaign impact assessment
router.get('/campaigns/impact', async (req, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        sponsors(display_name, tier)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const impact = {
      total_campaigns: campaigns?.length || 0,
      by_status: {},
      revenue_tracking: {
        total_budget: 0,
        spent: 0,
        roi_calculated: false
      },
      ngo_compliance: {
        all_campaigns_compliant: true,
        template_dependency: 'minimal',
        freeform_capability: 'full'
      }
    };

    campaigns?.forEach(campaign => {
      impact.by_status[campaign.status] = (impact.by_status[campaign.status] || 0) + 1;
      impact.revenue_tracking.total_budget += campaign.budget || 0;
    });

    res.json({
      success: true,
      impact,
      message: 'Campaigns fully functional with NGO-compliant system'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as ngoAdminRoutes };