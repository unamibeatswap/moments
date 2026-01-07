import { supabase } from '../config/supabase.js';

// Use Supabase MCP function instead of external service
export const callMCPAdvisory = async (messageData) => {
  try {
    const { data, error } = await supabase.rpc('mcp_advisory', {
      message_content: messageData.content,
      message_language: messageData.language_detected || 'eng',
      message_type: messageData.message_type,
      from_number: messageData.from_number,
      message_timestamp: messageData.timestamp
    });
    
    if (error) throw error;
    
    return data || {
      action: 'publish',
      cleaned_content: messageData.content,
      should_publish: true,
      is_duplicate: false,
      escalation_suggested: false
    };
    
  } catch (error) {
    console.error('Supabase MCP error:', error.message);
    
    // Safe default when MCP fails
    return {
      action: 'publish',
      cleaned_content: messageData.content,
      should_publish: true,
      is_duplicate: false,
      escalation_suggested: false
    };
  }
};