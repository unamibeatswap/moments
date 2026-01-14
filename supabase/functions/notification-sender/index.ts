import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: notifications } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', 3)
    .limit(10)

  for (const notif of notifications || []) {
    try {
      const token = Deno.env.get('WHATSAPP_TOKEN')
      const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
      
      let message = ''
      if (notif.template_name === 'comment_approved') {
        message = `✅ Your comment was approved!\n\nView it at: moments.unamifoundation.org/moments`
      } else if (notif.template_name === 'comment_reply') {
        message = `💬 Someone replied to your comment!\n\nView: moments.unamifoundation.org/moments`
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: notif.phone_number,
          type: 'text',
          text: { body: message }
        })
      })

      if (response.ok) {
        await supabase.from('notification_queue')
          .update({ status: 'sent', last_attempt_at: new Date().toISOString() })
          .eq('id', notif.id)
      } else {
        throw new Error(await response.text())
      }
    } catch (error) {
      await supabase.from('notification_queue')
        .update({ 
          status: 'failed', 
          attempts: notif.attempts + 1,
          error_message: error.message,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', notif.id)
    }
  }

  return new Response(JSON.stringify({ processed: notifications?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
