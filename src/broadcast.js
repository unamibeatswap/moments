import { supabase } from '../config/supabase.js';
import { sendMessage } from '../config/whatsapp.js';

export const broadcastMoment = async (momentId) => {
  try {
    // Get moment details
    const { data: moment, error: momentError } = await supabase
      .from('moments')
      .select(`
        *,
        sponsors(display_name)
      `)
      .eq('id', momentId)
      .single();

    if (momentError || !moment) {
      throw new Error('Moment not found');
    }

    // Get subscribed users for this region
    const { data: subscribers, error: subError } = await supabase
      .from('subscriptions')
      .select('phone_number, regions, categories')
      .eq('opted_in', true)
      .or(`regions.cs.{${moment.region}},regions.is.null`);

    if (subError) {
      throw new Error('Failed to get subscribers');
    }

    // Create broadcast record
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        moment_id: momentId,
        recipient_count: subscribers.length,
        status: 'in_progress'
      })
      .select()
      .single();

    if (broadcastError) {
      throw new Error('Failed to create broadcast record');
    }

    // Format WhatsApp message
    const whatsappMessage = formatMomentMessage(moment);
    
    let successCount = 0;
    let failureCount = 0;

    // Send to each subscriber
    for (const subscriber of subscribers) {
      try {
        await sendMessage(subscriber.phone_number, whatsappMessage);
        successCount++;
        
        // Update last activity
        await supabase
          .from('subscriptions')
          .update({ last_activity: new Date().toISOString() })
          .eq('phone_number', subscriber.phone_number);
          
      } catch (error) {
        console.error(`Failed to send to ${subscriber.phone_number}:`, error.message);
        failureCount++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update broadcast status
    await supabase
      .from('broadcasts')
      .update({
        success_count: successCount,
        failure_count: failureCount,
        status: 'completed',
        broadcast_completed_at: new Date().toISOString()
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
      broadcastId: broadcast.id,
      recipientCount: subscribers.length,
      successCount,
      failureCount
    };

  } catch (error) {
    console.error('Broadcast error:', error);
    throw error;
  }
};

const formatMomentMessage = (moment) => {
  const sponsorText = moment.is_sponsored && moment.sponsors 
    ? `Brought to you by ${moment.sponsors.display_name}` 
    : '';
  
  const pwLink = moment.pwa_link 
    ? `\n🌐 More info: ${moment.pwa_link}` 
    : '';

  let messageText = `📢 ${moment.is_sponsored ? '[Sponsored] ' : ''}Moment — ${moment.region}\n\n${moment.content}`;
  
  if (sponsorText) {
    messageText += `\n\n${sponsorText}`;
  }
  
  if (pwLink) {
    messageText += pwLink;
  }

  const message = {
    type: 'text',
    text: { body: messageText }
  };

  // Add media if present
  if (moment.media_urls && moment.media_urls.length > 0) {
    // For now, send first media item
    const mediaUrl = moment.media_urls[0];
    const mediaType = getMediaType(mediaUrl);
    
    if (mediaType === 'image') {
      return {
        type: 'image',
        image: {
          link: mediaUrl,
          caption: messageText
        }
      };
    } else if (mediaType === 'video') {
      return {
        type: 'video',
        video: {
          link: mediaUrl,
          caption: messageText
        }
      };
    } else if (mediaType === 'audio') {
      // Send audio separately, then text
      return {
        type: 'audio',
        audio: { link: mediaUrl }
      };
    }
  }

  return message;
};

const getMediaType = (url) => {
  const extension = url.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return 'image';
  } else if (['mp4', 'mov', 'avi', 'webm'].includes(extension)) {
    return 'video';
  } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension)) {
    return 'audio';
  }
  return 'document';
};

export const scheduleNextBroadcasts = async () => {
  try {
    const now = new Date().toISOString();
    
    // Get moments scheduled for now or past
    const { data: scheduledMoments, error } = await supabase
      .from('moments')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (error) {
      console.error('Failed to get scheduled moments:', error);
      return;
    }

    // Broadcast each scheduled moment
    for (const moment of scheduledMoments) {
      try {
        await broadcastMoment(moment.id);
        console.log(`Broadcasted moment ${moment.id}`);
      } catch (error) {
        console.error(`Failed to broadcast moment ${moment.id}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Schedule check error:', error);
  }
};

export const handleUserOptOut = async (phoneNumber) => {
  try {
    await supabase
      .from('subscriptions')
      .upsert({
        phone_number: phoneNumber,
        opted_in: false,
        opted_out_at: new Date().toISOString()
      });
    
    console.log(`User ${phoneNumber} opted out`);
  } catch (error) {
    console.error('Opt-out error:', error);
  }
};

export const handleUserOptIn = async (phoneNumber, regions = [], categories = []) => {
  try {
    await supabase
      .from('subscriptions')
      .upsert({
        phone_number: phoneNumber,
        opted_in: true,
        regions: regions.length > 0 ? regions : ['KZN', 'WC', 'GP'], // Default regions
        categories: categories.length > 0 ? categories : ['Education', 'Safety', 'Opportunity'],
        opted_in_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      });
    
    console.log(`User ${phoneNumber} opted in`);
  } catch (error) {
    console.error('Opt-in error:', error);
  }
};