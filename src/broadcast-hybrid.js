import { supabase } from '../config/supabase.js';
import { 
  sendTemplateMessage,
  sendFreeformMessage,
  isWithin24HourWindow 
} from '../config/whatsapp-compliant.js';

// Comprehensive 2-template + freeform system
export async function broadcastMomentHybrid(momentId) {
  try {
    // Get moment details with sponsor info
    const { data: moment, error: momentError } = await supabase
      .from('moments')
      .select(`
        *,
        sponsors(display_name, tier)
      `)
      .eq('id', momentId)
      .single();

    if (momentError || !moment) {
      throw new Error('Moment not found');
    }

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

    // Create broadcast record
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        moment_id: momentId,
        recipient_count: subscribers?.length || 0,
        status: 'in_progress',
        template_used: 'hybrid_system'
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
        const result = await sendMomentToSubscriber(subscriber.phone_number, moment);
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

    return {
      broadcast_id: broadcast.id,
      recipients: subscribers?.length || 0,
      success: successCount,
      failures: failureCount,
      methods_used: getMethodsUsed(results)
    };

  } catch (error) {
    console.error('Hybrid broadcast error:', error.message);
    throw error;
  }
}

// Smart message sender - uses best available method
async function sendMomentToSubscriber(phoneNumber, moment) {
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
      // Use hello_world template as notification trigger
      await sendTemplateMessage(phoneNumber, 'hello_world', 'en', []);
      
      return {
        phone: phoneNumber,
        success: true,
        method: 'template_hello_world',
        note: 'Generic notification sent - user outside 24h window'
      };
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

// Format rich freeform message (within 24h window)
function formatFreeformMoment(moment) {
  let message = '';
  
  // Header with branding
  if (moment.is_sponsored && moment.sponsors?.display_name) {
    const emoji = getSponsorEmoji(moment.sponsors.tier || 'standard');
    message += `${emoji} [Sponsored] Moment — ${moment.region}\n\n`;
  } else {
    message += `📢 Unami Foundation Moment — ${moment.region}\n\n`;
  }
  
  // Content
  message += `${moment.title}\n\n`;
  message += `${moment.content}\n\n`;
  
  // Metadata
  message += `🏷️ ${moment.category}`;
  if (moment.region !== 'National') {
    message += ` • 📍 ${moment.region}`;
  }
  message += '\n\n';
  
  // Sponsor attribution
  if (moment.is_sponsored && moment.sponsors?.display_name) {
    const tier = moment.sponsors.tier || 'standard';
    if (tier === 'premium' || tier === 'enterprise') {
      message += `✨ Proudly sponsored by ${moment.sponsors.display_name}\n\n`;
    } else {
      message += `Brought to you by ${moment.sponsors.display_name}\n\n`;
    }
  }
  
  // Call to action
  if (moment.pwa_link) {
    const trackingUrl = `${moment.pwa_link}?utm_source=whatsapp&utm_medium=freeform&utm_campaign=${moment.id}`;
    message += `🌐 More info: ${trackingUrl}\n\n`;
  } else {
    message += `🌐 More: https://moments.unamifoundation.org\n\n`;
  }
  
  // Footer
  message += '📱 Reply STOP to unsubscribe';
  
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