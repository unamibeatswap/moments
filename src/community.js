import { supabase } from '../config/supabase.js';

// Process community messages into moments using Supabase MCP
export async function processUserMessage(messageId) {
  try {
    // Get message
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (msgError || !message || message.processed) return null;

    // Call Supabase MCP function
    const { data: advisory, error: mcpError } = await supabase.rpc('mcp_advisory', {
      message_content: message.content,
      message_language: message.language_detected || 'eng',
      message_type: message.message_type,
      from_number: message.from_number,
      message_timestamp: message.timestamp
    });

    // Use advisory or safe defaults
    const safeAdvisory = advisory || {
      harm_signals: { confidence: 0 },
      spam_indicators: { confidence: 0 },
      urgency_level: 'low'
    };

    // Auto-publish if safe
    const shouldPublish = (safeAdvisory.harm_signals?.confidence || 0) < 0.7 && 
                         (safeAdvisory.spam_indicators?.confidence || 0) < 0.7;

    if (shouldPublish) {
      const { data: moment, error: momentError } = await supabase
        .from('moments')
        .insert({
          title: generateTitle(message.content),
          content: message.content,
          region: detectRegion(message.content) || 'National',
          category: detectCategory(message.content) || 'Community',
          language: message.language_detected || 'eng',
          status: 'broadcasted',
          broadcasted_at: new Date().toISOString(),
          created_by: 'community',
          content_source: 'community',
          source_message_id: message.id,
          is_sponsored: false,
          urgency_level: safeAdvisory.urgency_level || 'low'
        })
        .select()
        .single();

      if (!momentError && moment) {
        await supabase.from('messages').update({ processed: true }).eq('id', messageId);
        return moment;
      }
    }

    return null;
  } catch (error) {
    console.error('Community processing error:', error);
    return null;
  }
}

// Generate title from content
function generateTitle(content) {
  const words = content.trim().split(' ');
  if (words.length <= 8) return content;
  return words.slice(0, 8).join(' ') + '...';
}

// Simple region detection
function detectRegion(content) {
  const regions = {
    'KZN': ['durban', 'pietermaritzburg', 'kwazulu', 'natal'],
    'WC': ['cape town', 'western cape', 'stellenbosch'],
    'GP': ['johannesburg', 'pretoria', 'soweto', 'gauteng'],
    'EC': ['east london', 'port elizabeth', 'eastern cape'],
    'FS': ['bloemfontein', 'free state'],
    'LP': ['polokwane', 'limpopo'],
    'MP': ['nelspruit', 'mpumalanga'],
    'NC': ['kimberley', 'northern cape'],
    'NW': ['mahikeng', 'north west']
  };

  const lowerContent = content.toLowerCase();
  for (const [region, keywords] of Object.entries(regions)) {
    if (keywords.some(keyword => lowerContent.includes(keyword))) {
      return region;
    }
  }
  return null;
}

// Simple category detection
function detectCategory(content) {
  const categories = {
    'Safety': ['crime', 'police', 'danger', 'theft', 'robbery', 'accident'],
    'Health': ['hospital', 'clinic', 'doctor', 'medicine', 'sick', 'health'],
    'Education': ['school', 'university', 'college', 'learn', 'study', 'education'],
    'Opportunity': ['job', 'work', 'employment', 'business', 'opportunity'],
    'Events': ['event', 'meeting', 'celebration', 'festival', 'gathering'],
    'Culture': ['culture', 'tradition', 'heritage', 'community', 'celebration']
  };

  const lowerContent = content.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerContent.includes(keyword))) {
      return category;
    }
  }
  return 'Community';
}