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
    
    const confirmMessage = `✅ Interests updated!\n\nYou'll now receive updates about:\n${selectedCategories.map(cat => `🎯 ${cat}`).join('\n')}\n\n💬 Submit moments by messaging here\n🌐 Browse all: moments.unamifoundation.org/moments`
    
    await sendWhatsAppMessage(phoneNumber, confirmMessage)
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
    
    const confirmMessage = `✅ Regions updated!\n\nYou'll now receive community signals from:\n${selectedRegions.map(region => `📍 ${region}`).join('\n')}\n\n💬 Submit moments by messaging here\n🌐 Browse all: moments.unamifoundation.org/moments`
    
    await sendWhatsAppMessage(phoneNumber, confirmMessage)
    console.log(`User ${phoneNumber} updated regions to: ${selectedRegions.join(', ')}`)
  } catch (error) {
    console.error('Region selection error:', error)
    await sendWhatsAppMessage(phoneNumber, '❌ Error updating regions. Please try again or contact support.')
  }
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
            // Store message in database
            const { error: insertError } = await supabase.from('messages').insert({
              whatsapp_id: message.id,
              from_number: message.from,
              message_type: message.type,
              content: message.text?.body || message.caption || '',
              timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
              processed: false
            })

            if (insertError) {
              console.error('Failed to insert message:', insertError)
              continue
            }

            // Handle subscription commands
            const text = (message.text?.body || '').toLowerCase().trim()
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
              
              // WhatsApp compliant welcome message
              const welcomeMsg = `🌟 Welcome to Unami Foundation Moments!\n\nYou'll receive community updates and opportunities across South Africa.\n\nCommands:\n• HELP - Show options\n• STOP - Unsubscribe\n\n🌐 More: moments.unamifoundation.org/moments`
              await sendWhatsAppMessage(message.from, welcomeMsg)
              
              console.log('User subscribed and welcomed:', message.from)
            } else if (['stop', 'unsubscribe', 'quit', 'cancel'].includes(text)) {
              const { error: unsubError } = await supabase
                .from('subscriptions')
                .upsert({
                  phone_number: message.from,
                  opted_in: false,
                  opted_out_at: new Date().toISOString(),
                  last_activity: new Date().toISOString()
                }, { 
                  onConflict: 'phone_number',
                  ignoreDuplicates: false 
                })
              
              if (unsubError) {
                console.error('Unsubscription error:', unsubError)
              } else {
                console.log('✅ User unsubscribed:', message.from)
              }
              
              // WhatsApp compliant goodbye message
              const goodbyeMsg = `✅ You have been unsubscribed successfully.\n\nThank you for being part of our community.\n\n🌐 Visit: moments.unamifoundation.org/moments`
              await sendWhatsAppMessage(message.from, goodbyeMsg)
              
              console.log('User unsubscribed with confirmation:', message.from)
            } else if (['help', 'info', 'menu', '?'].includes(text)) {
              // Enhanced help command with all system commands
              const helpMsg = `📡 Unami Foundation Moments - Command Guide\n\n🔄 START/JOIN - Subscribe to community updates\n🛑 STOP/UNSUBSCRIBE - Unsubscribe from updates\n❓ HELP/INFO - Show this command guide\n📍 REGIONS - Choose your areas of interest\n🏷️ INTERESTS - Manage content categories\n\n🌍 Available Regions:\nKZN (KwaZulu-Natal), WC (Western Cape)\nGP (Gauteng), EC (Eastern Cape)\nFS (Free State), LP (Limpopo)\nMP (Mpumalanga), NC (Northern Cape)\nNW (North West)\n\n📱 How to use:\n• Send any message to share with community\n• Reply with region codes: "KZN WC GP"\n• All content is moderated for safety\n\n🌐 Web: moments.unamifoundation.org/moments\n📧 Support: info@unamifoundation.org\n\nYour community sharing platform 🇿🇦`
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
            } else if (isRegionSelection(text)) {
              // Handle region selection
              await handleRegionSelection(message.from, text, supabase)
              console.log('Region selection processed for:', message.from)
            } else if (isCategorySelection(text)) {
              // Handle category selection
              await handleCategorySelection(message.from, text, supabase)
              console.log('Category selection processed for:', message.from)
            } else {
              // Process as community content with Supabase MCP
              try {
                // Call Supabase MCP function
                const { data: advisory, error: mcpError } = await supabase.rpc('mcp_advisory', {
                  message_content: message.text?.body || '',
                  message_language: 'eng',
                  message_type: 'text',
                  from_number: message.from,
                  message_timestamp: new Date().toISOString()
                })
                
                // Default safe advisory if MCP fails
                const safeAdvisory = advisory || {
                  harm_signals: { confidence: 0 },
                  spam_indicators: { confidence: 0 },
                  urgency_level: 'low'
                }
                
                // Simple moderation logic
                const shouldPublish = (safeAdvisory.harm_signals?.confidence || 0) < 0.7 && 
                                    (safeAdvisory.spam_indicators?.confidence || 0) < 0.7
                
                if (shouldPublish) {
                  const content = message.text?.body || ''
                  const words = content.trim().split(' ')
                  const title = words.length <= 8 ? content : words.slice(0, 8).join(' ') + '...'
                  
                  const { data: moment, error: momentError } = await supabase
                    .from('moments')
                    .insert({
                      title: title,
                      content: content,
                      raw_content: content,
                      region: 'National',
                      category: 'Community',
                      status: 'draft',
                      created_by: 'community',
                      content_source: 'community',
                      is_sponsored: false,
                      urgency_level: safeAdvisory.urgency_level || 'low'
                    })
                    .select()
                    .single()
                  
                  if (!momentError && moment) {
                    console.log('Community moment created:', moment.title)
                    
                    // Queue for async broadcast (remove blocking broadcast)
                    await supabase
                      .from('moments')
                      .update({ 
                        status: 'pending_broadcast',
                        created_at: new Date().toISOString()
                      })
                      .eq('id', moment.id)
                    
                    const ackMsg = `📝 Thank you for sharing.\n\nYour message has been received and will be reviewed for publication.\n\n🌐 View community moments: moments.unamifoundation.org/moments`
                    await sendWhatsAppMessage(message.from, ackMsg)
                  }
                } else {
                  console.log('Message blocked by MCP moderation')
                }
              } catch (error) {
                console.error('Community processing failed:', error)
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