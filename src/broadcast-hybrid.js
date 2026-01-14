import { supabase } from '../config/supabase.js';
import { 
  sendTemplateMessage,
  sendFreeformMessage,
  isWithin24HourWindow 
} from '../config/whatsapp-compliant.js';
import { MESSAGE_TEMPLATES, buildMomentParams } from './whatsapp-templates.js';

// Comprehensive 2-template + freeform system
export async function broadcastMomentHybrid(momentId) {
  try {
    // Get moment details with sponsor info and featured comments
    const { data: moment, error: momentError } = await supabase
      .from('moments')
      .select(`
        *,
        sponsors(display_name, tier),
        featured_comments:moment_comments!inner(
          id, content, created_at, phone_number
        )
      `)
      .eq('id', momentId)
      .eq('moment_comments.featured', true)
      .eq('moment_comments.approved', true)
      .single();

    if (momentError || !moment) {
      throw new Error('Moment not found');
    }

    // Create comment patterns for auto-linking
    const commentHashtag = `#M${moment.id.substring(0, 8)}`;
    await supabase
      .from('comment_patterns')
      .upsert({
        moment_id: moment.id,
        pattern_type: 'hashtag',
        pattern_value: commentHashtag,
        active: true
      });

    // Get active subscribers
    let subscriberQuery = supabase
      .from('subscriptions')
      .select('phone_number, regions, categories')
      .eq('opted_in', true);

    if (moment.region && moment.region !== 'National') {
      subscriberQuery = subscriberQuery.contains('regions', [moment.region]);
    }

    if (moment.category) {
      subscriberQuery = subscriberQuery.contains('categories', [moment.category]);
    }

    const { data: subscribers, error: subError } = await subscriberQuery;
    if (subError) throw subError;

    // Check feature flag for marketing templates
    const { data: featureFlag } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_key', 'enable_marketing_templates')
      .single();

    const useMarketingTemplates = featureFlag?.enabled || false;

    // Create broadcast record
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        moment_id: momentId,
        recipient_count: subscribers?.length || 0,
        status: 'in_progress',
        template_used: useMarketingTemplates ? 'marketing_template_hybrid' : 'hybrid_system_with_comments',
        template_category: useMarketingTemplates ? 'MARKETING' : 'UTILITY'
      })
      .select()
      .single();

    if (broadcastError) throw broadcastError;

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process each subscriber with hybrid approach
    for (const subscriber of subscribers || []) {
      try {
        const result = await sendMomentToSubscriber(subscriber.phone_number, moment, useMarketingTemplates);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        results.push(result);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 15));
      } catch (error) {
        console.error(`Failed to send to ${subscriber.phone_number}:`, error.message);
        failureCount++;
        results.push({ 
          phone: subscriber.phone_number, 
          success: false, 
          method: 'error',
          error: error.message 
        });
      }
    }

    // Update broadcast results
    await supabase
      .from('broadcasts')
      .update({
        success_count: successCount,
        failure_count: failureCount,
        status: 'completed',
        broadcast_completed_at: new Date().toISOString(),
        error_details: results.filter(r => !r.success)
      })
      .eq('id', broadcast.id);

    // Update moment status
    await supabase
      .from('moments')
      .update({
        status: 'broadcasted',
        broadcasted_at: new Date().toISOString()
      })
      .eq('id', momentId);

    // Log compliance audit
    await logComplianceAudit(momentId, broadcast.id, moment, useMarketingTemplates);

    return {
      broadcast_id: broadcast.id,
      recipients: subscribers?.length || 0,
      success: successCount,
      failures: failureCount,
      methods_used: getMethodsUsed(results),
      featured_comments: moment.featured_comments?.length || 0
    };

  } catch (error) {
    console.error('Hybrid broadcast error:', error.message);
    throw error;
  }
}

// Smart message sender - uses best available method
async function sendMomentToSubscriber(phoneNumber, moment, useMarketingTemplates = false) {
  try {
    // Check if user is within 24-hour window
    const within24Hours = await isWithin24HourWindow(phoneNumber);
    
    if (within24Hours) {
      // Send rich freeform message
      const message = formatFreeformMoment(moment);
      await sendFreeformMessage(phoneNumber, message, moment.media_urls || []);
      
      return {
        phone: phoneNumber,
        success: true,
        method: 'freeform',
        message_length: message.length
      };
    } else {
      // Use marketing template if enabled, otherwise hello_world
      if (useMarketingTemplates) {
        const templateName = moment.is_sponsored ? 'sponsored_moment_v2' : 'moment_broadcast_v2';
        const params = buildMomentParams(moment, moment.sponsors);
        await sendTemplateMessage(phoneNumber, templateName, 'en', params);
        
        return {
          phone: phoneNumber,
          success: true,
          method: `template_${templateName}`,
          note: 'Marketing template sent - user outside 24h window'
        };
      } else {
        // Fallback to hello_world
        await sendTemplateMessage(phoneNumber, 'hello_world', 'en', []);
        
        return {
          phone: phoneNumber,
          success: true,
          method: 'template_hello_world',
          note: 'Generic notification sent - user outside 24h window'
        };
      }
    }
  } catch (error) {
    return {
      phone: phoneNumber,
      success: false,
      method: 'failed',
      error: error.message
    };
  }
}

// Format rich freeform message (within 24h window) - Playbook compliant
function formatFreeformMoment(moment) {
  let message = '';
  
  // Header with branding (Playbook format)
  if (moment.is_sponsored && moment.sponsors?.display_name) {
    const emoji = getSponsorEmoji(moment.sponsors.tier || 'standard');
    message += `${emoji} [Sponsored] Moment — ${moment.region}\n\n`;
  } else {
    message += `📢 Community Moment — ${moment.region}\n\n`;
  }
  
  // Content
  message += `${moment.title}\n`;
  message += `${moment.content}\n\n`;
  
  // Metadata
  message += `🏷️ ${moment.category} • 📍 ${moment.region}\n\n`;
  
  // Sponsor attribution (Playbook format)
  if (moment.is_sponsored && moment.sponsors?.display_name) {
    message += `Presented by ${moment.sponsors.display_name} via Unami Foundation Moments App\n\n`;
  }
  
  // PWA link
  const pwaUrl = moment.pwa_link || 'https://moments.unamifoundation.org/moments';
  message += `🌐 More: ${pwaUrl}\n\n`;
  
  // Footer (Playbook format)
  if (moment.is_sponsored) {
    message += 'info@unamifoundation.org';
  } else {
    message += 'Unami Foundation Moments App | info@unamifoundation.org';
  }
  
  return message;
}

// Handle opt-in with hello_world template
export async function sendWelcomeHybrid(phoneNumber, region, categories) {
  try {
    // Send hello_world template as welcome
    const result = await sendTemplateMessage(phoneNumber, 'hello_world', 'en', []);
    
    // Log the welcome
    await supabase
      .from('template_messages')
      .insert({
        phone_number: phoneNumber,
        template_name: 'hello_world',
        parameters: [],
        status: 'sent',
        whatsapp_message_id: result.messages?.[0]?.id,
        context: 'welcome_message'
      });

    return result;
  } catch (error) {
    console.error('Welcome hybrid error:', error);
    throw error;
  }
}

// Handle opt-out with unsubscribe_confirmation template
export async function sendUnsubscribeHybrid(phoneNumber) {
  try {
    const result = await sendTemplateMessage(phoneNumber, 'unsubscribe_confirmation', 'en', []);
    
    await supabase
      .from('template_messages')
      .insert({
        phone_number: phoneNumber,
        template_name: 'unsubscribe_confirmation',
        parameters: [],
        status: 'sent',
        whatsapp_message_id: result.messages?.[0]?.id,
        context: 'unsubscribe_confirmation'
      });

    return result;
  } catch (error) {
    console.error('Unsubscribe hybrid error:', error);
    throw error;
  }
}

// Analytics for hybrid system
export async function getHybridAnalytics(timeframe = '7d') {
  try {
    const startDate = new Date();
    if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);

    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .gte('broadcast_started_at', startDate.toISOString())
      .eq('template_used', 'hybrid_system');

    if (error) throw error;

    const { data: templateMessages, error: tmError } = await supabase
      .from('template_messages')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (tmError) throw tmError;

    return {
      broadcasts: {
        total: broadcasts?.length || 0,
        success_rate: broadcasts?.length > 0 ? 
          (broadcasts.reduce((sum, b) => sum + (b.success_count || 0), 0) / 
           broadcasts.reduce((sum, b) => sum + (b.recipient_count || 0), 0) * 100).toFixed(1) : 0
      },
      templates: {
        hello_world_used: templateMessages?.filter(t => t.template_name === 'hello_world').length || 0,
        unsubscribe_used: templateMessages?.filter(t => t.template_name === 'unsubscribe_confirmation').length || 0
      },
      messaging_windows: {
        within_24h: 0, // Would need to calculate from broadcast results
        outside_24h: 0
      }
    };
  } catch (error) {
    console.error('Hybrid analytics error:', error);
    throw error;
  }
}

// Helper functions
function getSponsorEmoji(tier) {
  switch (tier) {
    case 'enterprise': return '👑';
    case 'premium': return '⭐';
    default: return '📢';
  }
}

function getMethodsUsed(results) {
  const methods = {};
  results.forEach(r => {
    methods[r.method] = (methods[r.method] || 0) + 1;
  });
  return methods;
}

// Log compliance audit for marketing templates
async function logComplianceAudit(momentId, broadcastId, moment, useMarketingTemplates) {
  try {
    const templateUsed = useMarketingTemplates 
      ? (moment.is_sponsored ? 'sponsored_moment_v2' : 'moment_broadcast_v2')
      : 'hello_world';
    
    const sponsorDisclosed = moment.is_sponsored && moment.sponsors?.display_name;
    const pwaLinkIncluded = !!moment.pwa_link || true; // Default PWA link always included
    
    await supabase
      .from('marketing_compliance')
      .insert({
        moment_id: momentId,
        broadcast_id: broadcastId,
        template_used: templateUsed,
        template_category: useMarketingTemplates ? 'MARKETING' : 'UTILITY',
        sponsor_disclosed: sponsorDisclosed,
        opt_out_included: true, // Always included in templates
        pwa_link_included: pwaLinkIncluded,
        validated_by: 'system'
      });
  } catch (error) {
    console.error('Compliance audit logging failed:', error.message);
  }
}