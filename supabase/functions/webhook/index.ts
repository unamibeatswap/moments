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
            // Check if message is a command first
            const text = (message.text?.body || '').toLowerCase().trim()
            const isCommand = ['start', 'join', 'subscribe', 'stop', 'unsubscribe', 'quit', 'cancel',
                               'help', 'info', 'menu', '?', 'moments', 'share', 'submit',
                               'regions', 'region', 'areas', 'interests', 'categories', 'topics'].includes(text) ||
                              isRegionSelection(text) || isCategorySelection(text)
            
            // DON'T store commands in messages table
            if (!isCommand) {
              const { data: messageRecord, error: insertError } = await supabase.from('messages').insert({
                whatsapp_id: message.id,
                from_number: message.from,
                message_type: message.type,
                content: message.text?.body || message.caption || '',
                timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                processed: false
              }).select().single()

              if (insertError) {
                console.error('Failed to insert message:', insertError)
                continue
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
              
              // WhatsApp compliant welcome message
              const welcomeMsg = `🌟 Welcome to Unami Foundation Moments!\n\nYou'll receive community updates and opportunities across South Africa.\n\n📝 What qualifies as a moment:\n• Local opportunities & events\n• Safety alerts & community news\n• Educational resources & workshops\n• Cultural celebrations & initiatives\n\nCommands:\n• HELP - Show all options\n• MOMENTS - Learn about sharing\n• REGIONS - Choose your areas\n• INTERESTS - Select categories\n• STOP - Unsubscribe\n\n🌐 More: moments.unamifoundation.org/moments`
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
            } else if (['moments', 'share', 'submit'].includes(text)) {
              // New MOMENTS command - explain what qualifies
              const momentsMsg = `📝 Share Your Community Moments\n\n✅ What we welcome:\n🏫 Local education & training opportunities\n🛡️ Safety alerts & community warnings\n🎭 Cultural events & celebrations\n💼 Job opportunities & skills programs\n🏥 Health services & wellness events\n🌱 Environmental & sustainability initiatives\n\n❌ What we don't accept:\n• Political campaigns or endorsements\n• Financial products or investments\n• Medical advice or treatments\n• Gambling or betting content\n• Personal disputes or complaints\n\n📱 How to share: Simply message us your community update and we'll review it for publication.\n\n🌐 View all: moments.unamifoundation.org/moments`
              await sendWhatsAppMessage(message.from, momentsMsg)
              
              console.log('Moments guide sent to:', message.from)
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