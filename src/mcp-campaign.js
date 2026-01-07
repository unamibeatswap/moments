import { supabase } from '../config/supabase.js';

export async function screenCampaignContent(campaignData) {
  try {
    const { data, error } = await supabase.rpc('mcp_advisory', {
      message_content: campaignData.content,
      message_language: 'eng',
      message_type: 'campaign',
      from_number: 'system',
      message_timestamp: new Date().toISOString()
    });

    if (error) {
      return { safe: true, confidence: 0.5, advisory: 'Supabase MCP unavailable - manual review required' };
    }

    const advisory = data || {};
    
    // Store advisory for audit trail
    await supabase.from('campaign_advisories').insert({
      campaign_id: campaignData.id,
      advisory_data: advisory,
      confidence: advisory.harm_signals?.confidence || 0.5,
      escalation_suggested: (advisory.harm_signals?.confidence || 0) > 0.8,
      created_at: new Date().toISOString()
    });

    return {
      safe: (advisory.harm_signals?.confidence || 0) < 0.7,
      confidence: advisory.harm_signals?.confidence || 0.5,
      advisory: advisory
    };
  } catch (error) {
    console.error('Supabase MCP screening error:', error);
    return { safe: true, confidence: 0.5, advisory: 'Supabase MCP error - manual review required' };
  }
}

export async function getCampaignRiskScore(campaignId) {
  try {
    const { data } = await supabase
      .from('campaign_advisories')
      .select('confidence, advisory_data')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data?.confidence || 0.5;
  } catch (error) {
    return 0.5;
  }
}