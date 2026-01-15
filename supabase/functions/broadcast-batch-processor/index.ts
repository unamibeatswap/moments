import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('🚀 broadcast-batch-processor function initializing...')

// Create Supabase client once
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

// WhatsApp API helper function
async function sendWhatsAppMessage(to: string, message: string, attempt = 1): Promise<boolean> {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  const maxRetries = 3

  if (!token || !phoneId) {
    console.error('❌ WhatsApp credentials missing')
    return false
  }

  // Normalize phone number for South Africa (+27)
  let normalizedPhone = to.replace(/\D/g, '')
  if (normalizedPhone.startsWith('27')) {
    // Already has country code
  } else if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '27' + normalizedPhone.substring(1)
  } else if (normalizedPhone.length === 9) {
    normalizedPhone = '27' + normalizedPhone
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
        to: normalizedPhone,
        type: 'text',
        text: { body: message }
      })
    })

    if (response.ok) {
      return true
    } else {
      // Retry on server errors with exponential backoff
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        return sendWhatsAppMessage(to, message, attempt + 1)
      }
      return false
    }
  } catch (error) {
    // Retry on network errors with exponential backoff
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendWhatsAppMessage(to, message, attempt + 1)
    }
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Only POST method allowed' }), {
        status: 405,
        headers: corsHeaders
      })
    }

    const { batch_id, message } = await req.json()

    if (!batch_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing batch_id or message' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Get batch details
    const { data: batch, error: batchError } = await supabase
      .from('broadcast_batches')
      .select('*')
      .eq('id', batch_id)
      .single()

    if (batchError || !batch) {
      return new Response(JSON.stringify({ error: 'Batch not found' }), {
        status: 404,
        headers: corsHeaders
      })
    }

    console.log(`📦 Processing batch ${batch.batch_number} with ${batch.recipients.length} recipients`)

    // Update batch status to processing
    await supabase
      .from('broadcast_batches')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', batch_id)

    let successCount = 0
    let failureCount = 0
    const failedRecipients = []
    let currentRateLimit = 200 // Start with 200ms (5 msg/sec)
    let consecutiveFailures = 0

    // Process recipients with adaptive rate limiting
    for (let i = 0; i < batch.recipients.length; i++) {
      const recipient = batch.recipients[i]
      
      try {
        const success = await sendWhatsAppMessage(recipient, message)
        if (success) {
          successCount++
          consecutiveFailures = 0
          // Speed up if successful
          if (currentRateLimit > 150) {
            currentRateLimit = Math.max(150, currentRateLimit - 10)
          }
        } else {
          failureCount++
          failedRecipients.push(recipient)
          consecutiveFailures++
          // Slow down if failing
          if (consecutiveFailures > 3) {
            currentRateLimit = Math.min(500, currentRateLimit + 50)
            console.log(`⚠️ Adaptive rate limiting: increased to ${currentRateLimit}ms`)
          }
        }
      } catch (error) {
        failureCount++
        failedRecipients.push(recipient)
        consecutiveFailures++
      }

      // Adaptive rate limiting
      if (i < batch.recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, currentRateLimit))
      }
    }

    // Update batch results with retry info
    const retryCount = batch.retry_count || 0
    const shouldRetry = failureCount > 0 && retryCount < 2 && failedRecipients.length < batch.recipients.length * 0.5
    
    await supabase
      .from('broadcast_batches')
      .update({
        status: shouldRetry ? 'pending' : 'completed',
        success_count: successCount,
        failure_count: failureCount,
        failed_recipients: failedRecipients,
        retry_count: retryCount + (shouldRetry ? 1 : 0),
        completed_at: shouldRetry ? null : new Date().toISOString()
      })
      .eq('id', batch_id)

    if (shouldRetry) {
      console.log(`🔄 Batch ${batch.batch_number} will retry ${failedRecipients.length} failed recipients`)
    }

    // Update broadcast progress
    const { data: broadcast } = await supabase
      .from('broadcasts')
      .select('batches_total, batches_completed')
      .eq('id', batch.broadcast_id)
      .single()

    if (broadcast) {
      const newCompleted = (broadcast.batches_completed || 0) + 1
      const progress = (newCompleted / broadcast.batches_total) * 100
      
      await supabase
        .from('broadcasts')
        .update({
          batches_completed: newCompleted,
          progress_percentage: progress
        })
        .eq('id', batch.broadcast_id)
    }

    console.log(`✅ Batch ${batch.batch_number} completed: ${successCount} success, ${failureCount} failed`)

    return new Response(JSON.stringify({
      success: true,
      batch_id,
      success_count: successCount,
      failure_count: failureCount,
      total_recipients: batch.recipients.length
    }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error(`❌ Batch processor error: ${error.message}`)
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
})