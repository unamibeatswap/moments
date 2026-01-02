import { supabase } from '../config/railway-db.js';
import { sendMessage } from '../config/whatsapp.js';
import { processMedia } from './media.js';
import { detectLanguage } from './language.js';
import { callMCPAdvisory } from './advisory.js';
import { processTrustSignals } from './trust.js';
import { handleUserOptOut, handleUserOptIn } from './broadcast.js';
import axios from 'axios';

export const handleWebhook = async (req, res) => {
  try {
    const { entry } = req.body;
    
    if (!entry || !entry[0]?.changes) {
      return res.status(200).send('OK');
    }
    
    const changes = entry[0].changes[0];
    const messages = changes.value?.messages;
    
    if (!messages) {
      return res.status(200).send('OK');
    }
    
    // Process each message
    for (const message of messages) {
      await processIncomingMessage(message);
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
};

const processIncomingMessage = async (message) => {
  try {
    const { id: whatsappId, from, type, timestamp } = message;
    
    // Handle STOP/opt-out
    if (type === 'text' && /^(stop|unsubscribe|opt.?out)$/i.test(message.text?.body)) {
      await handleUserOptOut(from);
      return;
    }
    
    // Handle START/opt-in
    if (type === 'text' && /^(start|subscribe|opt.?in|join)$/i.test(message.text?.body)) {
      await handleUserOptIn(from);
      return;
    }
    
    // Extract content based on message type
    let content = '';
    let mediaId = null;
    
    switch (type) {
      case 'text':
        content = message.text.body;
        break;
      case 'image':
        content = message.image.caption || '';
        mediaId = message.image.id;
        break;
      case 'audio':
        mediaId = message.audio.id;
        break;
      case 'video':
        content = message.video.caption || '';
        mediaId = message.video.id;
        break;
      case 'document':
        content = message.document.caption || message.document.filename || '';
        mediaId = message.document.id;
        break;
    }
    
    // Detect language
    const language = detectLanguage(content);
    
    // Store message in database
    const { data: messageRecord, error: dbError } = await supabase
      .from('messages')
      .insert({
        whatsapp_id: whatsappId,
        from_number: from,
        message_type: type,
        content,
        media_id: mediaId,
        language_detected: language.code,
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString()
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error:', dbError);
      return;
    }
    
    // Process media if present
    let mediaResult = null;
    if (mediaId) {
      mediaResult = await processMedia(messageRecord.id, mediaId, type);
    }
    
    // Call MCP advisory (silent)
    const advisory = await callMCPAdvisory(messageRecord);
    
    // Process trust signals (soft controls)
    const trustResult = await processTrustSignals(messageRecord, advisory);
    
    // Trigger n8n workflow
    await triggerN8nWorkflow({
      message: messageRecord,
      media: mediaResult,
      advisory,
      trust: trustResult
    });
    
    // Mark as processed
    await supabase
      .from('messages')
      .update({ processed: true })
      .eq('id', messageRecord.id);
    
  } catch (error) {
    console.error('Message processing error:', error);
    
    // Log processing failure
    await supabase.from('flags').insert({
      message_id: null,
      flag_type: 'processing_failed',
      severity: 'high',
      action_taken: 'logged',
      notes: error.message
    });
  }
};

const triggerN8nWorkflow = async (data) => {
  // Disabled for production - n8n not accessible from Railway
  console.log('n8n workflow would be triggered:', data.message?.id);
  return;
  
  try {
    await axios.post(`${process.env.N8N_WEBHOOK_URL}/whatsapp-inbound`, data, {
      timeout: 3000,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('n8n trigger error:', error.message);
  }
};

export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
};