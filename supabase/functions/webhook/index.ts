import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
              raw_data: message,
              processed: false
            })

            if (insertError) {
              console.error('Failed to insert message:', insertError)
              continue
            }

            // Handle subscription commands
            const text = (message.text?.body || '').toLowerCase().trim()
            if (['start', 'join', 'subscribe'].includes(text)) {
              await supabase.from('subscriptions').upsert({
                phone_number: message.from,
                opted_in: true,
                opted_in_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
              }, { onConflict: 'phone_number' })
              
              console.log('User subscribed:', message.from)
            } else if (['stop', 'unsubscribe', 'quit'].includes(text)) {
              await supabase.from('subscriptions').upsert({
                phone_number: message.from,
                opted_in: false,
                opted_out_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
              }, { onConflict: 'phone_number' })
              
              console.log('User unsubscribed:', message.from)
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