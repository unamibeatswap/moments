import { supabase } from '../config/supabase.js';
import { sendTemplateMessage } from '../config/whatsapp.js';
import { selectTemplate, buildTemplateParams, validateMarketingCompliance } from './whatsapp-templates-marketing.js';

// Message cost is configurable via system settings (R0.65-R0.70 per message)
const MESSAGE_COST = parseFloat(process.env.MESSAGE_COST || '0.65');

// Enhanced campaign broadcast with full integration
export async function broadcastCampaign(campaignId, adminUser = 'system') {
  try {
    console.log('📢 Starting campaign broadcast:', campaignId);

    // Get campaign with sponsor
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, sponsors(display_name, tier)')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Campaigns are admin-created, no authority lookup needed
    console.log('📋 Campaign created by admin:', campaign.created_by || 'system');

    // Get active subscribers
    let subscriberQuery = supabase
      .from('subscriptions')
      .select('phone_number, regions, categories')
      .eq('opted_in', true);

    // Filter by target regions
    if (campaign.target_regions?.length > 0) {
      subscriberQuery = subscriberQuery.overlaps('regions', campaign.target_regions);
    }

    const { data: allSubscribers } = await subscriberQuery;
    let subscribers = allSubscribers || [];

    const recipientCount = subscribers.length;
    const estimatedCost = recipientCount * MESSAGE_COST;

    console.log('💰 Estimated cost:', estimatedCost, 'for', recipientCount, 'recipients');

    // Check budget before broadcast
    if (campaign.budget > 0) {
      const { data: budgetCheck } = await supabase.rpc('check_campaign_budget', {
        p_campaign_id: campaignId,
        p_spend_amount: estimatedCost
      });

      if (budgetCheck && !budgetCheck.allowed) {
        throw new Error(`Budget check failed: ${budgetCheck.reason}`);
      }
      console.log('✅ Budget check passed');
    }

    // Create moment from campaign
    const momentData = {
      title: campaign.title,
      content: campaign.content,
      region: campaign.target_regions?.[0] || 'National',
      category: campaign.target_categories?.[0] || 'General',
      sponsor_id: campaign.sponsor_id,
      is_sponsored: !!campaign.sponsor_id,
      content_source: 'campaign',
      campaign_id: campaignId,
      status: 'broadcasted',
      broadcasted_at: new Date().toISOString(),
      media_urls: campaign.media_urls || [],
      created_by: campaign.created_by || 'campaign_system'
    };

    const { data: moment, error: momentError } = await supabase
      .from('moments')
      .insert(momentData)
      .select()
      .single();

    if (momentError) {
      throw new Error(`Moment creation failed: ${momentError.message}`);
    }

    console.log('📝 Moment created:', moment.id);

    // Select template based on sponsor presence (admin campaigns)
    const template = selectTemplate(moment, null, campaign.sponsors);
    const templateParams = buildTemplateParams(moment, null, campaign.sponsors);
    
    console.log('📋 Using template:', template.name);

    // Validate marketing compliance
    const compliance = validateMarketingCompliance(moment, template, templateParams);
    console.log('✅ Compliance score:', compliance.compliance_score);

    // Create broadcast record
    const { data: broadcast } = await supabase
      .from('broadcasts')
      .insert({
        moment_id: moment.id,
        recipient_count: recipientCount,
        status: 'processing',
        broadcast_started_at: new Date().toISOString()
      })
      .select()
      .single();

    // Log marketing compliance
    await supabase.from('marketing_compliance').insert({
      moment_id: moment.id,
      broadcast_id: broadcast.id,
      template_used: template.name,
      template_category: template.category,
      sponsor_disclosed: compliance.sponsor_disclosed,
      opt_out_included: compliance.opt_out_included,
      pwa_link_included: compliance.pwa_link_included,
      compliance_score: compliance.compliance_score
    }).catch(err => console.warn('Compliance log failed:', err.message));

    // Send to subscribers using templates
    let successCount = 0;
    let failureCount = 0;

    for (const subscriber of subscribers) {
      try {
        await sendTemplateMessage(
          subscriber.phone_number,
          template.name,
          template.language,
          templateParams,
          moment.media_urls
        );
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 15)); // Rate limit
      } catch (error) {
        console.error(`Failed to send to ${subscriber.phone_number}:`, error.message);
        failureCount++;
      }
    }

    const actualCost = successCount * MESSAGE_COST;

    // Update broadcast results
    await supabase
      .from('broadcasts')
      .update({
        success_count: successCount,
        failure_count: failureCount,
        status: 'completed',
        broadcast_completed_at: new Date().toISOString()
      })
      .eq('id', broadcast.id);

    // Log budget transaction
    if (actualCost > 0) {
      await supabase.from('budget_transactions').insert({
        campaign_id: campaignId,
        transaction_type: 'spend',
        amount: actualCost,
        recipient_count: successCount,
        cost_per_recipient: MESSAGE_COST,
        description: `Campaign broadcast: ${campaign.title}`,
        created_by: adminUser
      }).catch(err => console.warn('Budget transaction log failed:', err.message));

      // Update campaign budget spent
      await supabase.from('campaign_budgets')
        .update({ 
          spent_amount: supabase.raw(`spent_amount + ${actualCost}`),
          updated_at: new Date().toISOString()
        })
        .eq('campaign_id', campaignId)
        .catch(err => console.warn('Budget update failed:', err.message));
    }

    // Update campaign stats
    await supabase.rpc('update_campaign_stats', {
      p_campaign_id: campaignId,
      p_recipient_count: successCount,
      p_cost: actualCost
    });

    // Log template performance (campaigns don't have authority)
    await supabase.rpc('log_template_performance', {
      p_template_name: template.name,
      p_campaign_id: campaignId,
      p_sends: recipientCount,
      p_deliveries: successCount,
      p_failures: failureCount,
      p_cost: actualCost
    });

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ 
        status: 'published',
        template_name: template.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log('✅ Campaign broadcast complete');

    return {
      success: true,
      broadcast_id: broadcast.id,
      moment_id: moment.id,
      recipients: recipientCount,
      delivered: successCount,
      failed: failureCount,
      cost: actualCost,
      template: template.name,
      compliance_score: compliance.compliance_score
    };

  } catch (error) {
    console.error('❌ Campaign broadcast error:', error.message);
    
    // Mark campaign as failed
    await supabase
      .from('campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId);
    
    throw error;
  }
}

// Get campaign performance analytics
export async function getCampaignPerformance(campaignId = null, timeframe = '30d') {
  try {
    let query = supabase.from('campaign_performance').select('*');
    
    if (campaignId) {
      query = query.eq('id', campaignId).single();
    } else {
      const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
      query = query.gte('created_at', `now() - interval '${days} days'`);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Campaign performance error:', error);
    return null;
  }
}

// Get template performance comparison
export async function getTemplatePerformance(timeframe = '30d') {
  try {
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
    
    const { data } = await supabase
      .from('template_performance')
      .select('*')
      .gte('created_at', `now() - interval '${days} days'`)
      .order('sends', { ascending: false });

    // Aggregate by template name
    const aggregated = {};
    data?.forEach(row => {
      if (!aggregated[row.template_name]) {
        aggregated[row.template_name] = {
          template_name: row.template_name,
          total_sends: 0,
          total_deliveries: 0,
          total_failures: 0,
          campaigns_used: 0,
          avg_delivery_rate: 0,
          avg_cost: 0
        };
      }
      
      const agg = aggregated[row.template_name];
      agg.total_sends += row.sends;
      agg.total_deliveries += row.deliveries;
      agg.total_failures += row.failures;
      agg.campaigns_used++;
    });

    // Calculate averages
    Object.values(aggregated).forEach(agg => {
      agg.avg_delivery_rate = agg.total_sends > 0 
        ? (agg.total_deliveries / agg.total_sends * 100).toFixed(1)
        : 0;
    });

    return Object.values(aggregated);
  } catch (error) {
    console.error('Template performance error:', error);
    return [];
  }
}
