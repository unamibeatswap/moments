#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function retryFailedBatches(broadcastId) {
  try {
    console.log('🔄 Checking for failed batches to retry...');
    
    // Find batches that need retry
    const { data: failedBatches } = await supabase
      .from('broadcast_batches')
      .select('*')
      .eq('broadcast_id', broadcastId)
      .eq('status', 'pending')
      .gt('retry_count', 0);
    
    if (!failedBatches || failedBatches.length === 0) {
      console.log('✅ No batches need retry');
      return;
    }
    
    console.log(`📦 Found ${failedBatches.length} batches to retry`);
    
    // Get the original message from broadcast
    const { data: broadcast } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .single();
    
    if (!broadcast) {
      console.error('❌ Broadcast not found');
      return;
    }
    
    // Retry each batch with only failed recipients
    for (const batch of failedBatches) {
      if (batch.failed_recipients && batch.failed_recipients.length > 0) {
        console.log(`🔄 Retrying batch ${batch.batch_number} with ${batch.failed_recipients.length} recipients`);
        
        // Update batch to use only failed recipients
        await supabase
          .from('broadcast_batches')
          .update({
            recipients: batch.failed_recipients,
            status: 'pending'
          })
          .eq('id', batch.id);
        
        // Trigger batch processor
        const processorUrl = `${process.env.SUPABASE_URL}/functions/v1/broadcast-batch-processor`;
        
        const response = await fetch(processorUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            batch_id: batch.id,
            message: 'Retry message' // You'd get this from the original broadcast
          })
        });
        
        if (response.ok) {
          console.log(`✅ Retry triggered for batch ${batch.batch_number}`);
        } else {
          console.error(`❌ Retry failed for batch ${batch.batch_number}`);
        }
      }
    }
    
    console.log('✅ Retry process completed');
    
  } catch (error) {
    console.error('❌ Retry error:', error.message);
  }
}

// Example usage
if (process.argv[2]) {
  retryFailedBatches(process.argv[2]);
} else {
  console.log('Usage: node retry-failed-batches.js <broadcast_id>');
}

export { retryFailedBatches };