import axios from 'axios';
import { supabase } from '../config/railway-db.js';

export const callMCPAdvisory = async (messageData) => {
  // Use existing MCP Railway service
  const mcpEndpoint = process.env.MCP_ENDPOINT || 'https://mcp-production.up.railway.app/advisory';
  
  try {
    const response = await axios.post(mcpEndpoint, {
      message: messageData.content,
      language: messageData.language_detected,
      media_type: messageData.message_type,
      from_number: messageData.from_number,
      timestamp: messageData.timestamp
    }, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const advisory = response.data;
    
    // Store advisory results if Supabase is available
    try {
      await supabase.from('advisories').insert([
        {
          message_id: messageData.id,
          advisory_type: 'language',
          confidence: advisory.language_confidence,
          details: { language: messageData.language_detected }
        },
        {
          message_id: messageData.id,
          advisory_type: 'urgency',
          confidence: advisory.urgency_level === 'high' ? 0.9 : advisory.urgency_level === 'medium' ? 0.6 : 0.3,
          details: { level: advisory.urgency_level }
        },
        {
          message_id: messageData.id,
          advisory_type: 'harm',
          confidence: advisory.harm_signals.confidence,
          details: advisory.harm_signals,
          escalation_suggested: advisory.escalation_suggested
        },
        {
          message_id: messageData.id,
          advisory_type: 'spam',
          confidence: advisory.spam_indicators.confidence,
          details: advisory.spam_indicators
        }
      ]);
    } catch (dbError) {
      console.log('Advisory storage skipped:', dbError.message);
    }
    
    return advisory;
    
  } catch (error) {
    console.error('MCP Advisory error:', error.message);
    
    // Return safe default when MCP fails
    return {
      language_confidence: 0.5,
      urgency_level: 'low',
      harm_signals: { detected: false, confidence: 0, type: 'none', context: 'MCP unavailable' },
      spam_indicators: { detected: false, confidence: 0, patterns: [] },
      escalation_suggested: false,
      notes: 'MCP service unavailable - using defaults'
    };
  }
};