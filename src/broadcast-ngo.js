import { supabase } from '../config/supabase.js';
import { 
  sendTemplateMessage,
  sendFreeformMessage,
  isWithin24HourWindow 
} from '../config/whatsapp-compliant.js';

// NGO-Compliant Broadcast System
// Pattern: Template → User Reply → Rich Freeform Content

export async function broadcastMomentNGO(momentId) {
  try {
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
      .select('phone_number, regions, categories, last_activity')
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
        template_used: 'ngo_compliant_pattern'
      })
      .select()
      .single();

    if (broadcastError) throw broadcastError;

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process subscribers with NGO-compliant pattern
    for (const subscriber of subscribers || []) {
      try {
        const result = await sendNGOCompliantMessage(subscriber, moment);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        results.push(result);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 20));
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
      pattern: 'ngo_compliant',
      methods_used: getMethodsUsed(results)
    };

  } catch (error) {
    console.error('NGO broadcast error:', error.message);
    throw error;
  }
}

// NGO-Compliant Message Sender
async function sendNGOCompliantMessage(subscriber, moment) {
  try {
    const within24Hours = await isWithin24HourWindow(subscriber.phone_number);
    
    if (within24Hours) {
      // Send rich freeform content (user recently interacted)
      const message = formatNGOFreeformMoment(moment);
      await sendFreeformMessage(subscriber.phone_number, message, moment.media_urls || []);
      
      return {
        phone: subscriber.phone_number,
        success: true,
        method: 'freeform_rich_content',
        message_length: message.length
      };
    } else {
      // Send NGO-safe re-engagement template
      const userName = extractUserName(subscriber.phone_number) || 'Community Member';
      await sendTemplateMessage(subscriber.phone_number, 'community_notice', 'en', [userName]);
      
      // Store pending moment for when user replies
      await supabase
        .from('pending_moments')
        .upsert({
          phone_number: subscriber.phone_number,
          moment_id: moment.id,
          template_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
        });
      
      return {
        phone: subscriber.phone_number,
        success: true,
        method: 'ngo_template_reengagement',
        note: 'Template sent - awaiting user reply for rich content'
      };
    }
  } catch (error) {
    return {
      phone: subscriber.phone_number,
      success: false,
      method: 'failed',
      error: error.message
    };
  }
}

// Format rich freeform moment (within 24h window)
function formatNGOFreeformMoment(moment) {
  let message = '';
  
  // NGO Header
  message += `📢 Unami Foundation Community Update\n`;
  message += `Region: ${moment.region}\n\n`;
  
  // Content
  message += `${moment.title}\n\n`;
  message += `${moment.content}\n\n`;
  
  // Metadata
  message += `Category: ${moment.category}\n`;
  if (moment.region !== 'National') {
    message += `Location: ${moment.region}\n`;
  }
  
  // Sponsor attribution (NGO-compliant)
  if (moment.is_sponsored && moment.sponsors?.display_name) {
    message += `\nSupported by: ${moment.sponsors.display_name}\n`;
  }
  
  // Call to action
  if (moment.pwa_link) {
    const trackingUrl = `${moment.pwa_link}?utm_source=whatsapp&utm_medium=ngo&utm_campaign=${moment.id}`;
    message += `\nMore information: ${trackingUrl}\n`;
  } else {
    message += `\nMore: https://moments.unamifoundation.org\n`;
  }
  
  // Footer
  message += `\n---\nUnami Foundation Moments\nReply STOP to unsubscribe`;
  
  return message;
}

// Handle user replies to re-engagement templates
export async function handleNGOReply(phoneNumber, replyContent) {
  try {
    // Check for pending moments
    const { data: pendingMoments, error } = await supabase
      .from('pending_moments')
      .select(`
        *,
        moments(*)
      `)
      .eq('phone_number', phoneNumber)
      .gt('expires_at', new Date().toISOString())
      .order('template_sent_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (pendingMoments && pendingMoments.length > 0) {
      const pendingMoment = pendingMoments[0];
      
      // Check if user replied positively
      if (replyContent.toLowerCase().includes('yes') || 
          replyContent.toLowerCase().includes('ok') ||
          replyContent.toLowerCase().includes('sure')) {
        
        // Send rich freeform content
        const message = formatNGOFreeformMoment(pendingMoment.moments);
        await sendFreeformMessage(phoneNumber, message, pendingMoment.moments.media_urls || []);
        
        // Mark as delivered
        await supabase
          .from('pending_moments')
          .update({ 
            delivered_at: new Date().toISOString(),
            user_reply: replyContent 
          })
          .eq('id', pendingMoment.id);
        
        return {
          success: true,
          action: 'rich_content_delivered',
          moment_id: pendingMoment.moment_id
        };
      }
    }
    
    return {
      success: true,
      action: 'no_pending_moments',
      note: 'User reply processed but no pending content'
    };
    
  } catch (error) {
    console.error('NGO reply handling error:', error);
    throw error;
  }
}

// Create pending moments table
export async function createPendingMomentsTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS pending_moments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone_number TEXT NOT NULL,
        moment_id UUID REFERENCES moments(id),
        template_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        delivered_at TIMESTAMP WITH TIME ZONE,
        user_reply TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_pending_moments_phone ON pending_moments(phone_number);
      CREATE INDEX IF NOT EXISTS idx_pending_moments_expires ON pending_moments(expires_at);
    `
  });
  
  if (error) {
    console.error('Table creation error:', error);
  }
}

// Helper functions
function extractUserName(phoneNumber) {
  // Simple name extraction - could be enhanced with contact lookup
  return null; // Use generic greeting for now
}

function getMethodsUsed(results) {
  const methods = {};
  results.forEach(r => {
    methods[r.method] = (methods[r.method] || 0) + 1;
  });
  return methods;
}