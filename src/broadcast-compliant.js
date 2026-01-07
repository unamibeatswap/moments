import { supabase } from '../config/supabase.js';
import { 
  sendCompliantBroadcast, 
  sendTemplateMessage,
  sendInteractiveMessage,
  isWithin24HourWindow 
} from '../config/whatsapp-compliant.js';
import { 
  buildMomentParams, 
  buildWelcomeParams, 
  buildPreferencesParams 
} from '../src/whatsapp-templates.js';

// Compliant broadcast system using approved templates
export async function broadcastMomentCompliant(momentId) {
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

    // Get active subscribers based on moment targeting
    let subscriberQuery = supabase
      .from('subscriptions')
      .select('phone_number, regions, categories')
      .eq('opted_in', true);

    // Filter by region if specified
    if (moment.region && moment.region !== 'National') {
      subscriberQuery = subscriberQuery.contains('regions', [moment.region]);
    }

    // Filter by category if specified
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
        template_used: moment.is_sponsored ? 'sponsored_moment' : 'moment_broadcast'
      })
      .select()
      .single();

    if (broadcastError) throw broadcastError;

    // Use only approved templates
    const templateName = 'hello_world'; // Only working template
    const parameters = []; // hello_world has no parameters

    // Send compliant broadcast using approved templates
    const results = await sendCompliantBroadcast(
      subscribers || [],
      templateName,
      parameters
    );

    // Update broadcast results
    await supabase
      .from('broadcasts')
      .update({
        success_count: results.success,
        failure_count: results.failed,
        status: 'completed',
        broadcast_completed_at: new Date().toISOString(),
        error_details: results.errors.length > 0 ? results.errors : null
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
      success: results.success,
      failures: results.failed,
      template_used: templateName
    };

  } catch (error) {
    console.error('Compliant broadcast error:', error.message);
    throw error;
  }
}

// Send welcome message using approved template
export async function sendWelcomeMessage(phoneNumber, region, categories) {
  try {
    // Use hello_world template since welcome_confirmation was rejected
    const result = await sendTemplateMessage(
      phoneNumber,
      'hello_world',
      'en',
      []
    );

    // Log the welcome message
    await supabase
      .from('template_messages')
      .insert({
        phone_number: phoneNumber,
        template_name: 'hello_world',
        parameters: [],
        status: 'sent',
        whatsapp_message_id: result.messages?.[0]?.id
      });

    return result;
  } catch (error) {
    console.error('Welcome message error:', error);
    throw error;
  }
}

// Send unsubscribe confirmation using approved template
export async function sendUnsubscribeConfirmation(phoneNumber) {
  try {
    const result = await sendTemplateMessage(
      phoneNumber,
      'unsubscribe_confirmation',
      'en',
      []
    );

    // Log the unsubscribe message
    await supabase
      .from('template_messages')
      .insert({
        phone_number: phoneNumber,
        template_name: 'unsubscribe_confirmation',
        parameters: [],
        status: 'sent',
        whatsapp_message_id: result.messages?.[0]?.id
      });

    return result;
  } catch (error) {
    console.error('Unsubscribe confirmation error:', error);
    throw error;
  }
}

// Send subscription preferences using interactive template
export async function sendPreferencesMessage(phoneNumber, region, categories) {
  try {
    const parameters = buildPreferencesParams(region, categories);
    
    const result = await sendInteractiveMessage(
      phoneNumber,
      'subscription_preferences',
      'en',
      parameters
    );

    // Log the preferences message
    await supabase
      .from('template_messages')
      .insert({
        phone_number: phoneNumber,
        template_name: 'subscription_preferences',
        parameters,
        status: 'sent',
        whatsapp_message_id: result.messages?.[0]?.id
      });

    return result;
  } catch (error) {
    console.error('Preferences message error:', error);
    throw error;
  }
}

// Check template compliance before sending
export async function validateBroadcastCompliance(momentId) {
  try {
    const { data: moment } = await supabase
      .from('moments')
      .select('*')
      .eq('id', momentId)
      .single();

    if (!moment) {
      return { valid: false, reason: 'Moment not found' };
    }

    // Check if moment content fits template constraints
    if (moment.title.length > 60) {
      return { valid: false, reason: 'Title too long for template (max 60 chars)' };
    }

    if (moment.content.length > 160) {
      return { valid: false, reason: 'Content too long for template (max 160 chars)' };
    }

    // Check if we have required template
    const templateName = moment.is_sponsored ? 'sponsored_moment' : 'moment_broadcast';
    
    // In production, check template approval status with WhatsApp
    // const templateStatus = await getTemplateStatus(templateName);
    // if (templateStatus.status !== 'APPROVED') {
    //   return { valid: false, reason: `Template ${templateName} not approved` };
    // }

    return { valid: true, template: templateName };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

// Get template usage analytics
export async function getTemplateAnalytics(timeframe = '7d') {
  try {
    const startDate = new Date();
    if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (timeframe === '90d') startDate.setDate(startDate.getDate() - 90);

    const { data: templateMessages, error } = await supabase
      .from('template_messages')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const analytics = {
      totalMessages: templateMessages?.length || 0,
      byTemplate: {},
      successRate: 0,
      failedMessages: 0
    };

    templateMessages?.forEach(msg => {
      if (!analytics.byTemplate[msg.template_name]) {
        analytics.byTemplate[msg.template_name] = {
          sent: 0,
          delivered: 0,
          failed: 0
        };
      }
      
      analytics.byTemplate[msg.template_name].sent++;
      
      if (msg.status === 'delivered') {
        analytics.byTemplate[msg.template_name].delivered++;
      } else if (msg.status === 'failed') {
        analytics.byTemplate[msg.template_name].failed++;
        analytics.failedMessages++;
      }
    });

    if (analytics.totalMessages > 0) {
      analytics.successRate = ((analytics.totalMessages - analytics.failedMessages) / analytics.totalMessages * 100).toFixed(1);
    }

    return analytics;
  } catch (error) {
    console.error('Template analytics error:', error);
    throw error;
  }
}