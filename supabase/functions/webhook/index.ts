import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Region selection helper functions
function isRegionSelection(text: string): boolean {
  const validRegions = ['kzn', 'wc', 'gp', 'ec', 'fs', 'lp', 'mp', 'nc', 'nw']
  const words = text.split(/\s+/)
  return words.length > 0 && words.every(word => validRegions.includes(word.toLowerCase()))
}

function isCategorySelection(text: string): boolean {
  const validCategories = ['edu', 'saf', 'cul', 'opp', 'eve', 'hea', 'tec', 'com', 'all']
  const words = text.split(/\s+/)
  return words.length > 0 && words.every(word => validCategories.includes(word.toLowerCase()))
}

async function handleCategorySelection(phoneNumber: string, categoryString: string, supabase: any) {
  try {
    const categoryCodes = categoryString.toUpperCase().split(/\s+/)
    const categoryMap: { [key: string]: string } = {
      'EDU': 'Education',
      'SAF': 'Safety', 
      'CUL': 'Culture',
      'OPP': 'Opportunity',
      'EVE': 'Events',
      'HEA': 'Health',
      'TEC': 'Technology',
      'COM': 'Community'
    }
    
    let selectedCategories: string[]
    if (categoryCodes.includes('ALL')) {
      selectedCategories = Object.values(categoryMap)
    } else {
      selectedCategories = categoryCodes.map(code => categoryMap[code]).filter(Boolean)
    }
    
    if (selectedCategories.length === 0) {
      await sendWhatsAppMessage(phoneNumber, '❌ Invalid category codes. Reply INTERESTS to see valid options.')
      return
    }
    
    await supabase
      .from('subscriptions')
      .upsert({
        phone_number: phoneNumber,
        categories: selectedCategories,
        last_activity: new Date().toISOString(),
        opted_in: true
      }, { onConflict: 'phone_number' })
    
    const confirmMessage = `✅ Interests updated!\n\nYou'll now receive updates about:\n${selectedCategories.map(cat => `🎯 ${cat}`).join('\n')}`
    
    await sendInteractiveButtons(phoneNumber, confirmMessage, [
      { id: 'see_moments', title: '📰 See Moments' },
      { id: 'add_more_topics', title: '➕ Add More' },
      { id: 'done', title: '✅ Done' }
    ])
    console.log(`User ${phoneNumber} updated categories to: ${selectedCategories.join(', ')}`)
  } catch (error) {
    console.error('Category selection error:', error)
    await sendWhatsAppMessage(phoneNumber, '❌ Error updating interests. Please try again or contact support.')
  }
}

async function handleRegionSelection(phoneNumber: string, regionString: string, supabase: any) {
  try {
    const regionCodes = regionString.toUpperCase().split(/\s+/)
    const regionMap: { [key: string]: string } = {
      'KZN': 'KwaZulu-Natal',
      'WC': 'Western Cape', 
      'GP': 'Gauteng',
      'EC': 'Eastern Cape',
      'FS': 'Free State',
      'LP': 'Limpopo',
      'MP': 'Mpumalanga',
      'NC': 'Northern Cape',
      'NW': 'North West'
    }
    
    const selectedRegions = regionCodes.map(code => regionMap[code]).filter(Boolean)
    
    if (selectedRegions.length === 0) {
      await sendWhatsAppMessage(phoneNumber, '❌ Invalid region codes. Reply REGIONS to see valid options.')
      return
    }
    
    await supabase
      .from('subscriptions')
      .upsert({
        phone_number: phoneNumber,
        regions: selectedRegions,
        last_activity: new Date().toISOString(),
        opted_in: true
      }, { onConflict: 'phone_number' })
    
    const confirmMessage = `✅ Regions updated!\n\nYou'll now receive updates from:\n${selectedRegions.map(region => `📍 ${region}`).join('\n')}`
    
    await sendInteractiveButtons(phoneNumber, confirmMessage, [
      { id: 'see_moments', title: '📰 See Moments' },
      { id: 'add_more_regions', title: '➕ Add More' },
      { id: 'done', title: '✅ Done' }
    ])
    console.log(`User ${phoneNumber} updated regions to: ${selectedRegions.join(', ')}`)
  } catch (error) {
    console.error('Region selection error:', error)
    await sendWhatsAppMessage(phoneNumber, '❌ Error updating regions. Please try again or contact support.')
  }
}

// Authority lookup function (Phase 2: Webhook Integration)
async function lookupAuthority(userIdentifier: string, supabase: any) {
  if (!userIdentifier) return null;
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase.rpc('lookup_authority', {
      p_user_identifier: userIdentifier
    });
    
    const lookupTime = Date.now() - startTime;
    
    if (error) {
      console.warn(`Authority lookup error for ${userIdentifier} (${lookupTime}ms):`, error.message);
      return null; // Fail-open
    }
    
    const authorityData = data && data.length > 0 ? data[0] : null;
    console.log(`Authority lookup for ${userIdentifier}: ${authorityData ? 'found' : 'none'} (${lookupTime}ms)`);
    
    return authorityData;
  } catch (error) {
    console.error(`Authority lookup exception for ${userIdentifier}:`, error.message);
    return null; // Fail-open
  }
}

// Rule-based analysis (fallback)
function ruleBasedAnalysis(content: string) {
  const lowerContent = content.toLowerCase()
  let confidence = 0.2
  const harm_signals: any = {}
  const spam_indicators: any = {}
  
  if (content.includes('http') || content.includes('www.')) {
    confidence += 0.3
    spam_indicators.links = true
  }
  
  if (content.length < 10) {
    confidence += 0.2
    spam_indicators.too_short = true
  }
  
  const harmWords = ['kill', 'attack', 'bomb', 'weapon', 'violence', 'threat']
  if (harmWords.some(word => lowerContent.includes(word))) {
    confidence += 0.5
    harm_signals.violence = true
  }
  
  const spamWords = ['buy now', 'click here', 'limited time', 'act now', 'free money']
  if (spamWords.some(phrase => lowerContent.includes(phrase))) {
    confidence += 0.3
    spam_indicators.promotional = true
  }
  
  return {
    confidence: Math.min(confidence, 1.0),
    harm_signals,
    spam_indicators,
    urgency_level: confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low'
  }
}

// Claude API analysis
async function claudeAnalysis(content: string) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyze this South African community message for moderation. Return ONLY valid JSON with: confidence (0-1 risk score where 0=safe, 1=harmful), harm_signals (object with violence/harassment/scam booleans), spam_indicators (object with promotional/repetitive/links booleans), urgency_level (low/medium/high).

Message: "${content.replace(/"/g, '\\"')}"

JSON only, no explanation:`
      }]
    })
  })
  
  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }
  
  const result = await response.json()
  const text = result.content[0].text.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  
  return {
    confidence: analysis.confidence || 0.5,
    harm_signals: analysis.harm_signals || {},
    spam_indicators: analysis.spam_indicators || {},
    urgency_level: analysis.urgency_level || 'low'
  }
}

// Hybrid MCP Analysis
async function analyzeMCPContent(content: string, phoneNumber: string) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  
  // Try Claude API if key exists
  if (apiKey) {
    try {
      const result = await claudeAnalysis(content)
      console.log(`🤖 Claude analysis: confidence=${result.confidence.toFixed(2)}`)
      return result
    } catch (error) {
      console.warn(`⚠️ Claude API failed, using rules: ${error.message}`)
    }
  }
  
  // Fallback to rule-based
  const result = ruleBasedAnalysis(content)
  console.log(`📋 Rule-based analysis: confidence=${result.confidence.toFixed(2)}`)
  return result
}

// WhatsApp API helper function
async function sendWhatsAppMessage(to: string, message: string) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  
  if (!token || !phoneId) {
    console.error('WhatsApp credentials missing')
    return false
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    })

    if (response.ok) {
      console.log('WhatsApp message sent successfully to', to)
      return true
    } else {
      const error = await response.text()
      console.error('WhatsApp API error:', error)
      return false
    }
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error)
    return false
  }
}

// NEW: Interactive buttons helper (max 3 buttons)
async function sendInteractiveButtons(to: string, bodyText: string, buttons: Array<{id: string, title: string}>) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  
  if (!token || !phoneId) {
    console.error('WhatsApp credentials missing')
    return false
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.slice(0, 3).map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title.substring(0, 20) }
            }))
          }
        }
      })
    })

    if (response.ok) {
      console.log('✅ Interactive buttons sent to', to)
      return true
    } else {
      const error = await response.text()
      console.error('❌ Interactive buttons error:', error)
      // Fallback to text message
      return await sendWhatsAppMessage(to, bodyText)
    }
  } catch (error) {
    console.error('Failed to send interactive buttons:', error)
    // Fallback to text message
    return await sendWhatsAppMessage(to, bodyText)
  }
}

// NEW: Interactive list helper (for more than 3 options)
async function sendInteractiveList(to: string, bodyText: string, buttonText: string, sections: any[]) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  
  if (!token || !phoneId) {
    console.error('WhatsApp credentials missing')
    return false
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonText.substring(0, 20),
            sections: sections
          }
        }
      })
    })

    if (response.ok) {
      console.log('✅ Interactive list sent to', to)
      return true
    } else {
      const error = await response.text()
      console.error('❌ Interactive list error:', error)
      // Fallback to text message
      return await sendWhatsAppMessage(to, bodyText)
    }
  } catch (error) {
    console.error('Failed to send interactive list:', error)
    // Fallback to text message
    return await sendWhatsAppMessage(to, bodyText)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'GET') {
      // WhatsApp webhook verification
      const url = new URL(req.url)
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      // Use multiple possible verify tokens for production
      const validTokens = [
        Deno.env.get('WEBHOOK_VERIFY_TOKEN'),
        'whatsapp_gateway_verify_2024_secure',
        'unami_moments_webhook_2024',
        'moments_verify_token'
      ].filter(Boolean)

      if (mode === 'subscribe' && validTokens.includes(token)) {
        console.log('Webhook verified successfully')
        return new Response(challenge, { 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        })
      }
      
      console.log('Webhook verification failed:', { mode, token })
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      console.log('Webhook received:', JSON.stringify(body, null, 2))
      
      // Process WhatsApp webhook
      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const messages = body.entry[0].changes[0].value.messages
        
        for (const message of messages) {
          try {
            // NEW: Handle interactive button/list responses
            if (message.type === 'interactive') {
              const buttonId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id
              console.log(`🔘 Button tapped: ${buttonId} by ${message.from}`)
              
              // Handle button as if it were text command
              if (buttonId === 'btn_regions') {
                await sendInteractiveList(message.from,
                  '📍 Choose your regions:',
                  'Select Regions',
                  [{
                    title: 'Provinces',
                    rows: [
                      { id: 'KZN', title: '🏖️ KwaZulu-Natal', description: 'KZN' },
                      { id: 'WC', title: '🍷 Western Cape', description: 'WC' },
                      { id: 'GP', title: '🏙️ Gauteng', description: 'GP' },
                      { id: 'EC', title: '🌊 Eastern Cape', description: 'EC' },
                      { id: 'FS', title: '🌾 Free State', description: 'FS' },
                      { id: 'LP', title: '🌳 Limpopo', description: 'LP' },
                      { id: 'MP', title: '⛰️ Mpumalanga', description: 'MP' },
                      { id: 'NC', title: '🏜️ Northern Cape', description: 'NC' },
                      { id: 'NW', title: '💎 North West', description: 'NW' }
                    ]
                  }]
                )
                continue
              }
              
              if (buttonId === 'btn_interests') {
                await sendInteractiveList(message.from,
                  '🏷️ Choose your interests:',
                  'Select Topics',
                  [{
                    title: 'Categories',
                    rows: [
                      { id: 'EDU', title: '🎓 Education', description: 'Learning' },
                      { id: 'SAF', title: '🛡️ Safety', description: 'Security' },
                      { id: 'OPP', title: '💼 Opportunities', description: 'Jobs' },
                      { id: 'HEA', title: '⚕️ Health', description: 'Wellness' },
                      { id: 'EVE', title: '🎉 Events', description: 'Gatherings' },
                      { id: 'CUL', title: '🎭 Culture', description: 'Arts' },
                      { id: 'TEC', title: '📱 Technology', description: 'Digital' },
                      { id: 'COM', title: '🏠 Community', description: 'News' }
                    ]
                  }]
                )
                continue
              }
              
              // Handle region/category selections from list
              if (['KZN', 'WC', 'GP', 'EC', 'FS', 'LP', 'MP', 'NC', 'NW'].includes(buttonId)) {
                await handleRegionSelection(message.from, buttonId, supabase)
                continue
              }
              
              if (['EDU', 'SAF', 'OPP', 'HEA', 'EVE', 'CUL', 'TEC', 'COM'].includes(buttonId)) {
                await handleCategorySelection(message.from, buttonId, supabase)
                continue
              }
              
              // Handle unsubscribe confirmation
              if (buttonId === 'btn_confirm_unsub') {
                await supabase.from('subscriptions').update({
                  opted_in: false,
                  opted_out_at: new Date().toISOString(),
                  last_activity: new Date().toISOString()
                }).eq('phone_number', message.from)
                
                await sendWhatsAppMessage(message.from, '✅ Unsubscribed successfully.\n\nThank you for being part of Unami Foundation Moments App.\n\n🌐 moments.unamifoundation.org/moments')
                continue
              }
              
              if (buttonId === 'btn_pause_instead') {
                await supabase.from('subscriptions').update({
                  paused_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  last_activity: new Date().toISOString()
                }).eq('phone_number', message.from)
                
                await sendWhatsAppMessage(message.from, '⏸️ Paused for 7 days.\n\nUnami Foundation Moments App\n\nWe\'ll resume sending updates next week.')
                continue
              }
              
              if (buttonId === 'btn_cancel') {
                await sendWhatsAppMessage(message.from, '✅ Cancelled.\n\nUnami Foundation Moments App\n\nYou\'re still subscribed!')
                continue
              }
              
              // Handle language selection
              if (['lang_en', 'lang_zu', 'lang_xh'].includes(buttonId)) {
                const langMap = { lang_en: 'eng', lang_zu: 'zul', lang_xh: 'xho' }
                const langNames = { lang_en: 'English', lang_zu: 'isiZulu', lang_xh: 'isiXhosa' }
                
                await supabase.from('subscriptions').update({
                  language_preference: langMap[buttonId],
                  last_activity: new Date().toISOString()
                }).eq('phone_number', message.from)
                
                await sendWhatsAppMessage(message.from, `✅ Language: ${langNames[buttonId]}\n\nUnami Foundation Moments App\n\n🌐 moments.unamifoundation.org/moments`)
                continue
              }
              
              if (buttonId.startsWith('submit_')) {
                await sendWhatsAppMessage(message.from, '📝 Great! Now send your message.\n\nUnami Foundation Moments App\nDigital Notice Board')
                continue
              }
              
              if (buttonId.startsWith('report_') || buttonId.startsWith('feedback_')) {
                await sendWhatsAppMessage(message.from, '✅ Thank you!\n\nUnami Foundation Moments App\nDigital Notice Board')
                continue
              }
              
              if (['see_moments', 'done', 'add_more_regions', 'add_more_topics'].includes(buttonId)) {
                if (buttonId === 'see_moments') {
                  const { data: m } = await supabase.from('moments').select('title,region').eq('status','broadcasted').order('broadcasted_at',{ascending:false}).limit(3)
                  if (m?.length) await sendWhatsAppMessage(message.from, `📰 Latest:\n\n${m.map((x,i)=>`${i+1}. ${x.title}\n   📍 ${x.region}`).join('\n\n')}\n\n🌐 moments.unamifoundation.org/moments`)
                } else if (buttonId === 'done') {
                  await sendWhatsAppMessage(message.from, '✅ All set!\n\nUnami Foundation Moments App\nDigital Notice Board\n\n🌐 moments.unamifoundation.org/moments')
                }
                continue
              }
            }
            
            // Check if message is a command first
            const text = (message.text?.body || '').toLowerCase().trim()
            const isCommand = ['start', 'join', 'subscribe', 'stop', 'unsubscribe', 'quit', 'cancel',
                               'help', 'info', 'menu', '?', 'moments', 'share', 'submit', 'status', 'settings', 'language',
                               'recent', 'report', 'feedback',
                               'regions', 'region', 'areas', 'interests', 'categories', 'topics'].includes(text) ||
                              isRegionSelection(text) || isCategorySelection(text)
            
            // DON'T store commands in messages table
            if (!isCommand) {
              // Phase 2: Authority lookup (non-blocking)
              let authorityContext = null;
              try {
                const authority = await lookupAuthority(message.from, supabase);
                if (authority) {
                  authorityContext = {
                    has_authority: true,
                    level: authority.authority_level || 1,
                    role: authority.role_label || 'community_member',
                    scope: authority.scope || 'community',
                    scope_identifier: authority.scope_identifier,
                    approval_mode: authority.approval_mode || 'ai_review',
                    blast_radius: authority.blast_radius || 100,
                    risk_threshold: authority.risk_threshold || 0.7,
                    lookup_timestamp: new Date().toISOString()
                  };
                }
              } catch (authorityError) {
                console.warn('Authority lookup failed (non-blocking):', authorityError.message);
                // Fail-open: Continue processing without authority context
              }

              const { data: messageRecord, error: insertError } = await supabase.from('messages').insert({
                whatsapp_id: message.id,
                from_number: message.from,
                message_type: message.type,
                content: message.text?.body || message.caption || '',
                timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                processed: false,
                authority_context: authorityContext // Store authority context
              }).select().single()

              if (insertError) {
                console.error('Failed to insert message:', insertError)
                continue
              }
              
              // MCP Analysis with Authority Integration
              try {
                const content = message.text?.body || message.caption || ''
                const mcpAnalysis = await analyzeMCPContent(content, message.from)
                
                await supabase.from('advisories').insert({
                  message_id: messageRecord.id,
                  advisory_type: 'content_quality',
                  confidence: mcpAnalysis.confidence,
                  harm_signals: mcpAnalysis.harm_signals,
                  spam_indicators: mcpAnalysis.spam_indicators,
                  urgency_level: mcpAnalysis.urgency_level,
                  escalation_suggested: mcpAnalysis.confidence > 0.7
                })
                
                console.log(`🔍 MCP Analysis: confidence=${mcpAnalysis.confidence.toFixed(2)}, urgency=${mcpAnalysis.urgency_level}`)
                
                // Authority-based auto-approval
                const threshold = authorityContext?.risk_threshold || 0.3
                const autoApprove = mcpAnalysis.confidence < threshold
                
                if (autoApprove) {
                  await supabase.from('messages').update({
                    moderation_status: 'approved',
                    authority_context: {
                      ...authorityContext,
                      mcp_confidence: mcpAnalysis.confidence,
                      auto_approved: true,
                      threshold_used: threshold
                    }
                  }).eq('id', messageRecord.id)
                  
                  const { data: autoMoment } = await supabase.from('moments').insert({
                    title: content.substring(0, 50),
                    content: content,
                    region: 'National',
                    category: 'Community',
                    status: 'draft',
                    created_by: 'auto_moderation',
                    content_source: 'whatsapp'
                  }).select().single()
                  
                  console.log(`✅ Auto-approved (threshold=${threshold}): message ${messageRecord.id}, moment ${autoMoment?.id}`)
                }
              } catch (mcpError) {
                console.error('MCP analysis failed:', mcpError)
              }
              
              // Handle media download
              if (message.type === 'image' || message.type === 'video' || message.type === 'audio') {
                try {
                  const mediaId = message.image?.id || message.video?.id || message.audio?.id
                  if (mediaId) {
                    // Get media URL from WhatsApp
                    const mediaResponse = await fetch(
                      `https://graph.facebook.com/v18.0/${mediaId}`,
                      { headers: { 'Authorization': `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}` } }
                    )
                    const mediaData = await mediaResponse.json()
                    
                    if (mediaData.url) {
                      // Download media
                      const mediaFile = await fetch(mediaData.url, {
                        headers: { 'Authorization': `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}` }
                      })
                      const mediaBlob = await mediaFile.blob()
                      
                      // Upload to Supabase Storage
                      const fileName = `whatsapp/${Date.now()}_${message.from}_${mediaId}`
                      const { data: uploadData } = await supabase.storage
                        .from('media')
                        .upload(fileName, mediaBlob, { contentType: message.type })
                      
                      if (uploadData) {
                        // Get public URL
                        const { data: publicUrl } = supabase.storage
                          .from('media')
                          .getPublicUrl(fileName)
                        
                        // Store in media table
                        await supabase.from('media').insert({
                          message_id: messageRecord.id,
                          whatsapp_media_id: mediaId,
                          media_type: message.type,
                          original_url: mediaData.url,
                          storage_path: fileName,
                          file_size: mediaBlob.size,
                          mime_type: mediaBlob.type,
                          processed: true
                        })
                        
                        // Update message with media URL
                        await supabase.from('messages')
                          .update({ media_url: publicUrl.publicUrl })
                          .eq('id', messageRecord.id)
                      }
                    }
                  }
                } catch (error) {
                  console.error('Media download failed:', error)
                }
              }
            }

            // Handle subscription commands
            if (['start', 'join', 'subscribe'].includes(text)) {
              const { data: existingSub } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('phone_number', message.from)
                .single()
              
              const subscriptionData = {
                phone_number: message.from,
                opted_in: true,
                opted_in_at: new Date().toISOString(),
                last_activity: new Date().toISOString(),
                regions: existingSub?.regions || ['National']
              }
              
              const { error: subError } = await supabase
                .from('subscriptions')
                .upsert(subscriptionData, { 
                  onConflict: 'phone_number',
                  ignoreDuplicates: false 
                })
              
              if (subError) {
                console.error('Subscription error:', subError)
              } else {
                console.log('✅ User subscribed:', message.from)
              }
              
              // Send with buttons
              await sendInteractiveButtons(message.from,
                '🌟 Welcome to Unami Foundation Moments App!\n\nYour Digital Notice Board for South Africa.\n\nChoose an option:',
                [
                  { id: 'btn_regions', title: '📍 Choose Regions' },
                  { id: 'btn_interests', title: '🏷️ Choose Interests' },
                  { id: 'btn_help', title: '❓ Help' }
                ]
              )
              
              console.log('User subscribed and welcomed:', message.from)
            } else if (['stop', 'unsubscribe', 'quit', 'cancel'].includes(text)) {
              // Show confirmation with pause option
              await sendInteractiveButtons(message.from,
                '⚠️ Unami Foundation Moments App\n\nAre you sure you want to unsubscribe?\n\nYou\'ll stop receiving community updates.',
                [
                  { id: 'btn_pause_instead', title: '⏸️ Pause 7 Days' },
                  { id: 'btn_confirm_unsub', title: '✅ Yes, Unsubscribe' },
                  { id: 'btn_cancel', title: '❌ Cancel' }
                ]
              )
              
              console.log('Unsubscribe confirmation sent to:', message.from)
            } else if (['moments', 'share', 'submit'].includes(text)) {
              // New MOMENTS command - explain what qualifies
              const momentsMsg = `📝 Share Your Community Moments\n\n✅ What we welcome:\n🏫 Local education & training opportunities\n🛡️ Safety alerts & community warnings\n🎭 Cultural events & celebrations\n💼 Job opportunities & skills programs\n🏥 Health services & wellness events\n🌱 Environmental & sustainability initiatives\n\n❌ What we don't accept:\n• Political campaigns or endorsements\n• Financial products or investments\n• Medical advice or treatments\n• Gambling or betting content\n• Personal disputes or complaints\n\n📱 How to share: Simply message us your community update and we'll review it for publication.\n\n🌐 View all: moments.unamifoundation.org/moments`
              await sendWhatsAppMessage(message.from, momentsMsg)
              
              console.log('Moments guide sent to:', message.from)
            } else if (['help', 'info', 'menu', '?'].includes(text)) {
              // Enhanced help command with all system commands
              const helpMsg = `📡 Unami Foundation Moments App\nYour Digital Notice Board\n\n🔄 START - Subscribe\n🛑 STOP - Unsubscribe\n⚙️ STATUS - View settings\n📍 REGIONS - Choose areas\n🏷️ INTERESTS - Manage topics\n🌍 LANGUAGE - Change language\n📰 RECENT - Latest moments\n📝 SUBMIT - Share content\n\n🌐 moments.unamifoundation.org/moments\n📧 info@unamifoundation.org\n\nYour Digital Notice Board 🇿🇦`
              await sendWhatsAppMessage(message.from, helpMsg)
              
              console.log('Help sent to:', message.from)
            } else if (['regions', 'region', 'areas'].includes(text)) {
              // Regions command
              const regionsMsg = `📍 Choose your regions (reply with region codes):\n\n🏖️ KZN - KwaZulu-Natal\n🍷 WC - Western Cape\n🏙️ GP - Gauteng\n🌊 EC - Eastern Cape\n🌾 FS - Free State\n🌳 LP - Limpopo\n⛰️ MP - Mpumalanga\n🏜️ NC - Northern Cape\n💎 NW - North West\n\nReply with codes like: KZN WC GP`
              await sendWhatsAppMessage(message.from, regionsMsg)
              
              console.log('Regions sent to:', message.from)
            } else if (['interests', 'categories', 'topics'].includes(text)) {
              // Interests/Categories command
              const interestsMsg = `🏷️ Choose your interests (reply with category codes):\n\n🎓 EDU - Education & Learning\n🛡️ SAF - Safety & Security\n🎭 CUL - Culture & Arts\n💼 OPP - Opportunities & Jobs\n🎉 EVE - Events & Gatherings\n⚕️ HEA - Health & Wellness\n📱 TEC - Technology & Digital\n🏠 COM - Community News\n\nReply with codes like: EDU SAF OPP\nOr reply ALL for everything`
              await sendWhatsAppMessage(message.from, interestsMsg)
              
              console.log('Interests sent to:', message.from)
            } else if (['status', 'settings'].includes(text)) {
              // STATUS command - show current settings
              const { data: sub } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('phone_number', message.from)
                .single()
              
              if (sub) {
                const regions = sub.regions?.join(', ') || 'None'
                const topics = sub.categories?.join(', ') || 'None'
                const status = sub.opted_in ? 'Active' : 'Inactive'
                
                await sendInteractiveButtons(message.from,
                  `⚙️ Unami Foundation Moments App\n\nYour Settings:\n📍 Regions: ${regions}\n🏷️ Topics: ${topics}\n🔔 Status: ${status}`,
                  [
                    { id: 'btn_regions', title: '📍 Change Regions' },
                    { id: 'btn_interests', title: '🏷️ Change Topics' },
                    { id: 'btn_help', title: '❓ Help' }
                  ]
                )
              } else {
                await sendWhatsAppMessage(message.from, '❌ No subscription found. Reply START to subscribe.')
              }
              
              console.log('Status sent to:', message.from)
            } else if (text === 'language') {
              // LANGUAGE command
              await sendInteractiveButtons(message.from,
                '🌍 Unami Foundation Moments App\n\nChoose your language:',
                [
                  { id: 'lang_en', title: '🇬🇧 English' },
                  { id: 'lang_zu', title: '🇿🇦 isiZulu' },
                  { id: 'lang_xh', title: '🇿🇦 isiXhosa' }
                ]
              )
              
              console.log('Language selector sent to:', message.from)
            } else if (text === 'recent') {
              const { data: moments } = await supabase
                .from('moments')
                .select('title, region')
                .eq('status', 'broadcasted')
                .order('broadcasted_at', { ascending: false })
                .limit(5)
              
              if (moments && moments.length > 0) {
                const list = moments.map((m, i) => `${i+1}. ${m.title}\n   📍 ${m.region}`).join('\n\n')
                await sendWhatsAppMessage(message.from, `📰 Unami Foundation Moments App\nDigital Notice Board\n\nRecent moments:\n\n${list}\n\n🌐 moments.unamifoundation.org/moments`)
              } else {
                await sendWhatsAppMessage(message.from, '📰 No recent moments.\n\nUnami Foundation Moments App\n\n🌐 moments.unamifoundation.org/moments')
              }
            } else if (text === 'submit') {
              await sendInteractiveList(message.from,
                '📝 Unami Foundation Moments App\nDigital Notice Board\n\nWhat type of moment?',
                'Select Category',
                [{
                  title: 'Categories',
                  rows: [
                    { id: 'submit_edu', title: '🎓 Education', description: 'Training' },
                    { id: 'submit_saf', title: '🛡️ Safety', description: 'Alerts' },
                    { id: 'submit_opp', title: '💼 Opportunity', description: 'Jobs' },
                    { id: 'submit_eve', title: '🎉 Event', description: 'Gatherings' },
                    { id: 'submit_other', title: '✏️ Other', description: 'General' }
                  ]
                }]
              )
            } else if (text === 'report') {
              await sendInteractiveButtons(message.from,
                '🚨 Unami Foundation Moments App\n\nReport content:',
                [
                  { id: 'report_spam', title: '📢 Spam' },
                  { id: 'report_inappropriate', title: '⚠️ Inappropriate' },
                  { id: 'report_wrong', title: '❌ Wrong Info' }
                ]
              )
            } else if (text === 'feedback') {
              await sendInteractiveButtons(message.from,
                '💬 Unami Foundation Moments App\nDigital Notice Board\n\nYour feedback:',
                [
                  { id: 'feedback_good', title: '👍 Love it' },
                  { id: 'feedback_suggest', title: '💡 Suggestion' },
                  { id: 'feedback_issue', title: '🐛 Issue' }
                ]
              )
            } else if (isRegionSelection(text)) {
              // Handle region selection
              await handleRegionSelection(message.from, text, supabase)
              console.log('Region selection processed for:', message.from)
            } else if (isCategorySelection(text)) {
              // Handle category selection
              await handleCategorySelection(message.from, text, supabase)
              console.log('Category selection processed for:', message.from)
            } else if (message.context?.id) {
              // Reply to a moment - create comment
              const replyToMsgId = message.context.id
              const { data: whatsappComment } = await supabase
                .from('whatsapp_comments')
                .select('moment_id')
                .eq('whatsapp_message_id', replyToMsgId)
                .single()
              
              if (whatsappComment?.moment_id) {
                const { data: comment } = await supabase.from('comments').insert({
                  moment_id: whatsappComment.moment_id,
                  from_number: message.from,
                  content: message.text?.body || ''
                }).select().single()
                
                if (comment) {
                  await supabase.from('whatsapp_comments').insert({
                    whatsapp_message_id: message.id,
                    comment_id: comment.id,
                    from_number: message.from,
                    moment_id: whatsappComment.moment_id,
                    reply_to_message_id: replyToMsgId,
                    media_type: 'text'
                  })
                  
                  await sendWhatsAppMessage(message.from, '✅ Comment published! View at moments.unamifoundation.org/moments')
                  console.log('Comment auto-approved and published')
                }
              }
            } else {
              // Process as community content
              const content = message.text?.body || ''
              const words = content.trim().split(' ')
              const title = words.length <= 8 ? content : words.slice(0, 8).join(' ') + '...'
              
              const { data: moment } = await supabase.from('moments').insert({
                title,
                content,
                region: 'National',
                category: 'Community',
                status: 'draft',
                created_by: 'community',
                content_source: 'whatsapp'
              }).select().single()
              
              if (moment) {
                await supabase.from('whatsapp_comments').insert({
                  whatsapp_message_id: message.id,
                  from_number: message.from,
                  moment_id: moment.id,
                  media_type: 'text'
                })
                
                await sendWhatsAppMessage(message.from, '📝 Thank you! Your message will be reviewed for publication.\n\n🌐 moments.unamifoundation.org/moments')
              }
            }

            // Mark message as processed
            await supabase.from('messages')
              .update({ processed: true })
              .eq('whatsapp_id', message.id)

          } catch (msgError) {
            console.error('Error processing message:', msgError)
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})