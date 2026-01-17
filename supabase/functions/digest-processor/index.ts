import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  console.log('📰 Digest processor running...')
  
  const { data: pending } = await supabase
    .from('pending_moments')
    .select('*')
    .eq('sent', false)
    .lte('scheduled_for', new Date().toISOString())
    .limit(1000)
  
  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const grouped: { [key: string]: any[] } = {}
  pending.forEach(item => {
    if (!grouped[item.phone_number]) grouped[item.phone_number] = []
    grouped[item.phone_number].push(item)
  })
  
  let sent = 0
  
  for (const [phone, moments] of Object.entries(grouped)) {
    const message = `📰 Your Daily Moments (${moments.length})\n\n` +
      moments.map((m, i) => `${i + 1}. ${m.moment_title}\n   ${m.moment_content.substring(0, 80)}...`).join('\n\n') +
      `\n\n🌐 moments.unamifoundation.org/moments`
    
    const success = await sendWhatsAppMessage(phone, message)
    
    if (success) {
      const ids = moments.map(m => m.id)
      await supabase.from('pending_moments').update({ sent: true }).in('id', ids)
      sent++
    }
  }
  
  return new Response(JSON.stringify({ processed: sent }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

async function sendWhatsAppMessage(to: string, message: string) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  
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
  
  return response.ok
}
